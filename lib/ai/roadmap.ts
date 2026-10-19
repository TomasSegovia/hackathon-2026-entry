import 'server-only'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { exerciseModel, structureModel } from '@/lib/ai/provider'
import { truncateKeepingMath } from '@/lib/math'

const topicsSchema = z.object({
  topics: z
    .array(
      z.object({
        key: z.string().describe('Identificador corto y único, por ejemplo "t1"'),
        title: z.string().describe('Título breve del tema, máximo 60 caracteres'),
        summary: z.string().describe('Una frase que explica qué se aprende en este tema'),
        prerequisites: z
          .array(z.string())
          .describe('Keys de los temas cuyas bases son necesarias antes de este'),
        subtopics: z
          .array(z.string())
          .describe('Subtemas mínimos y concretos, entre 2 y 8, en orden de estudio'),
      }),
    )
    .max(30),
})

export type DraftTopic = {
  key: string
  title: string
  summary: string
  prerequisites: string[]
  subtopics: string[]
}

export async function draftTopics(input: {
  subjectName: string
  program: string
  library: { title: string; kind: string; excerpt: string }[]
}): Promise<DraftTopic[]> {
  const libraryLines = input.library
    .map((item) => `- [${item.kind}] ${item.title}: ${item.excerpt.replace(/\s+/g, ' ')}`)
    .join('\n')

  const { output } = await generateText({
    model: structureModel,
    output: Output.object({ schema: topicsSchema }),
    system: [
      'Sos un diseñador curricular. Convertís el programa de una materia universitaria en un mapa de aprendizaje con dependencias.',
      'Reglas:',
      '1. Cada tema del programa es un nodo. Podés unir o dividir temas solo si hace falta para que cada nodo sea coherente.',
      '2. CRITERIO DE DEPENDENCIA. El tema B depende de A solo si, para entender las definiciones o demostraciones de B, o para resolver sus ejercicios típicos, hace falta usar un concepto, resultado o técnica que se introduce en A. Prueba: "¿se pueden resolver los ejercicios de B sin haber estudiado A?". Si la respuesta es sí, no hay dependencia.',
      '3. NO son dependencias: que A aparezca antes en el programa, que sean del mismo capítulo o tengan relación temática, ni que A se use apenas como ejemplo o aplicación de B.',
      '4. Solo dependencias directas: si C depende de B y B de A, no pongas A en los prerrequisitos de C salvo que C use A por sí mismo. Preferí pocas dependencias por tema (lo normal es de 0 a 2). Los temas de base (lógica, conjuntos, conceptos iniciales) no tienen prerrequisitos.',
      '5. Evitá cadenas lineales artificiales: los temas independientes entre sí deben quedar en ramas paralelas. Nunca crees ciclos. Referenciá los prerrequisitos únicamente por su "key".',
      '6. Dividí cada tema en sus subtemas mínimos: cada uno debe poder aprenderse en una sola sesión de estudio (por ejemplo, en "Sistema binario": "Conversión decimal-binario", "Suma binaria", "Resta binaria").',
      '7. Respondé en el idioma del programa.',
      '8. Los títulos de temas y de subtemas van en texto plano, cortos (máximo 70 caracteres) y SIN fórmulas ni símbolos matemáticos: nombrá los conceptos con palabras ("conectivos lógicos", no una lista de símbolos). Solo el resumen puede llevar notación matemática, en LaTeX entre signos de dólar ($x^2$ en línea, $$...$$ en bloque), nunca como texto plano ni con símbolos sueltos.',
      'Usá la lista de materiales solo para ajustar nombres y nivel de detalle. No inventes temas que no estén en el programa.',
    ].join('\n'),
    prompt: [
      `Materia: ${input.subjectName}`,
      `Programa:\n${input.program.slice(0, 20000)}`,
      libraryLines ? `Materiales cargados:\n${libraryLines}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  })

  const usedKeys = new Set<string>()
  return output.topics
    .map((topic, index) => {
      let key = topic.key.trim() || `t${index + 1}`
      while (usedKeys.has(key)) key = `${key}_${index}`
      usedKeys.add(key)

      const subtopics = topic.subtopics
        .map((subtopic) => truncateKeepingMath(subtopic, 120))
        .filter(Boolean)
        .slice(0, 8)

      const title = truncateKeepingMath(topic.title, 80)
      return {
        key,
        title,
        summary: truncateKeepingMath(topic.summary, 300),
        prerequisites: topic.prerequisites,
        subtopics: subtopics.length > 0 ? subtopics : [title],
      }
    })
    .filter((topic) => topic.title)
}

const exercisesSchema = z.object({
  exercises: z
    .array(
      z.object({
        statement: z.string().describe('Enunciado completo del ejercicio, copiado fielmente'),
        subtopicIndex: z
          .number()
          .int()
          .describe('Índice del subtema del catálogo que mejor corresponde al ejercicio'),
      }),
    )
    .max(40),
})

export type CatalogEntry = { index: number; label: string }

export async function extractExercises(input: {
  title: string
  content: string
  catalog: CatalogEntry[]
}): Promise<{ statement: string; subtopicIndex: number }[]> {
  const { output } = await generateText({
    model: exerciseModel,
    output: Output.object({ schema: exercisesSchema }),
    system: [
      'Extraés los ejercicios de una guía de práctica o de un examen de una materia universitaria.',
      'Cada ejercicio o inciso independiente es un elemento. Copiá el enunciado fielmente, sin resolverlo y sin agregar pistas.',
      'Asigná cada ejercicio al subtema del catálogo que representa el concepto principal que hay que dominar para resolverlo.',
      'Ignorá resoluciones, soluciones, encabezados y texto que no sea un ejercicio.',
      'Reescribí toda fórmula o expresión matemática del enunciado en LaTeX entre signos de dólar ($x^2$ en línea, $$...$$ en bloque), reconstruyendo fracciones, potencias, sumatorias y símbolos que el texto extraído del PDF haya desarmado.',
    ].join(' '),
    prompt: [
      `Catálogo de subtemas:\n${input.catalog.map((entry) => `[${entry.index}] ${entry.label}`).join('\n')}`,
      `Documento "${input.title}":\n${input.content.slice(0, 30000)}`,
    ].join('\n\n'),
  })

  return output.exercises
    .map((exercise) => ({
      statement: exercise.statement.trim().slice(0, 2000),
      subtopicIndex: exercise.subtopicIndex,
    }))
    .filter((exercise) => exercise.statement.length > 5)
}
