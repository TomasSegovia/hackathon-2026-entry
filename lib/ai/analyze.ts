import 'server-only'
import { gateway, generateText, Output } from 'ai'
import { z } from 'zod'
import type { WebSource } from '@/lib/types'

const MODEL = 'anthropic/claude-haiku-4.5'

const itemsSchema = z.object({
  items: z
    .array(
      z.object({
        statement: z
          .string()
          .describe('Enunciado del punto, copiado o resumido fielmente'),
        topic: z
          .string()
          .describe('Tema o concepto teórico que hay que conocer, en pocas palabras'),
      }),
    )
    .max(30),
})

export async function splitExercise(content: string, subjectName: string) {
  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: itemsSchema }),
    system: [
      'Sos un asistente que ayuda a estudiantes a entender qué teoría necesitan para resolver una consigna.',
      'Dividí el texto en puntos independientes (ejercicios, incisos o preguntas).',
      'Para cada uno, indicá el tema teórico principal. No resuelvas nada.',
      'Respondé en el mismo idioma del texto. Si el texto es una sola consigna, devolvé un solo punto.',
    ].join(' '),
    prompt: `Materia: ${subjectName}\n\nTexto:\n${content.slice(0, 20000)}`,
  })

  return output.items
}

export async function searchWebForTopic(
  topic: string,
  statement: string,
  subjectName: string,
): Promise<WebSource[]> {
  const result = await generateText({
    model: MODEL,
    tools: { perplexity_search: gateway.tools.perplexitySearch() },
    prompt: [
      `Buscá material de estudio confiable (apuntes universitarios, libros, documentación oficial) sobre: "${topic}".`,
      `Materia: ${subjectName}. Contexto de la consigna: ${statement.slice(0, 600)}`,
      'Necesito fuentes para aprender el tema, no la resolución del ejercicio.',
    ].join('\n'),
  })

  const seen = new Set<string>()
  const sources: WebSource[] = []
  for (const source of result.sources) {
    if (source.sourceType !== 'url' || seen.has(source.url)) continue
    seen.add(source.url)
    sources.push({ title: source.title ?? new URL(source.url).hostname, url: source.url })
  }
  return sources.slice(0, 6)
}
