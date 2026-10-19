import 'server-only'
import { and, eq, isNotNull } from 'drizzle-orm'
import { embedTexts } from '@/lib/ai/retrieve'
import { chunkText, extractTextFromFile } from '@/lib/ai/text'
import { db } from '@/lib/db'
import { chunks, materials, subjects } from '@/lib/db/schema'
import {
  getExamText,
  getMaterialText,
  getOverview,
  listBibliography,
  listExams,
  listMaterials,
  type FceiaBibliography,
  type FceiaOverview,
} from '@/lib/fceia/client'
import type { MaterialKind } from '@/lib/types'

/** Documents imported per run, so a single request never exceeds the server time limit. */
const BATCH_SIZE = 12
const CONCURRENCY = 3
const MAX_DOCUMENT_CHARS = 60_000
const MIN_DOCUMENT_CHARS = 100
const MAX_PROGRAM_CHARS = 30_000
const BIBLIOGRAPHY_KEY = 'fceia:bibliography'

export type ImportOptions = {
  program: boolean
  materials: boolean
  exams: boolean
  bibliography: boolean
}

type Candidate = {
  key: string
  title: string
  kind: MaterialKind
  loadText: () => Promise<string>
}

type NewDocument = {
  userId: string
  subjectId: string
  key: string
  title: string
  kind: MaterialKind
  content: string
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

async function saveDocument({ userId, subjectId, key, title, kind, content }: NewDocument) {
  const pieces = chunkText(content)
  if (pieces.length === 0) return false
  const embeddings = await embedTexts(pieces)

  await db.transaction(async (tx) => {
    const [material] = await tx
      .insert(materials)
      .values({
        userId,
        subjectId,
        title: title.slice(0, 160),
        kind,
        content,
        sourceName: 'FCEIA',
        externalKey: key,
        chunkCount: pieces.length,
      })
      .returning({ id: materials.id })

    await tx.insert(chunks).values(
      pieces.map((piece, position) => ({
        userId,
        subjectId,
        materialId: material.id,
        position,
        content: piece,
        embedding: embeddings[position],
      })),
    )
  })
  return true
}

async function readSyllabusPdf(url: string) {
  if (!/\.pdf(\?|$)/i.test(url)) return ''
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) return ''
  const buffer = await response.arrayBuffer()
  const file = new File([buffer], 'programa.pdf', { type: 'application/pdf' })
  return extractTextFromFile(file)
}

async function buildProgram(overview: FceiaOverview) {
  let syllabus = ''
  if (overview.syllabus_pdf_url) {
    try {
      syllabus = await readSyllabusPdf(overview.syllabus_pdf_url)
    } catch (error) {
      console.error('[fceia] syllabus unreadable', error)
    }
  }
  const parts = [overview.name, overview.description?.trim() ?? '', syllabus].filter(Boolean)
  const program = parts.join('\n\n')
  // Without the syllabus PDF only the name and a short description remain, which is too thin.
  return syllabus ? program.slice(0, MAX_PROGRAM_CHARS) : ''
}

function formatBibliography(entries: FceiaBibliography[]) {
  return entries
    .map((entry) => {
      const details = [entry.author, entry.year, entry.editorial].filter(Boolean).join(', ')
      const role = entry.kind ? ` (bibliografía ${entry.kind})` : ''
      return `${entry.title}${details ? ` — ${details}` : ''}${role}`
    })
    .join('\n\n')
}

function interleave<T>(first: T[], second: T[]) {
  const merged: T[] = []
  for (let index = 0; index < Math.max(first.length, second.length); index++) {
    if (index < first.length) merged.push(first[index])
    if (index < second.length) merged.push(second[index])
  }
  return merged
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

/** Imports the official content of a FCEIA subject and returns a summary for the user. */
export async function importPreset(params: {
  userId: string
  subjectId: string
  fceiaSubjectId: number
  include: ImportOptions
}) {
  const { userId, subjectId, fceiaSubjectId, include } = params
  const notes: string[] = []

  const overview = await getOverview(fceiaSubjectId)

  const [current] = await db
    .select({ program: subjects.program })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))

  await db
    .update(subjects)
    .set({ fceiaSubjectId })
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))

  if (include.program) {
    if (current?.program?.trim()) {
      notes.push('Mantuve el programa que ya habías cargado.')
    } else {
      const program = await buildProgram(overview)
      if (program) {
        await db
          .update(subjects)
          .set({ program })
          .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
        notes.push('Cargué el programa oficial.')
      } else {
        notes.push('No pude leer el programa oficial; pegalo o subilo a mano.')
      }
    }
  }

  const existing = await db
    .select({ key: materials.externalKey })
    .from(materials)
    .where(
      and(
        eq(materials.subjectId, subjectId),
        eq(materials.userId, userId),
        isNotNull(materials.externalKey),
      ),
    )
  const known = new Set(existing.map((row) => row.key))

  const [materialList, examList] = await Promise.all([
    include.materials ? listMaterials(fceiaSubjectId) : Promise.resolve([]),
    include.exams ? listExams(fceiaSubjectId) : Promise.resolve([]),
  ])

  const withoutText =
    materialList.filter((item) => !item.has_text).length +
    examList.filter((item) => !item.has_text).length

  const studyCandidates: Candidate[] = materialList
    .filter((item) => item.has_text)
    .map((item) => ({
      key: `fceia:material:${item.id}`,
      title: item.title.replace(/\.pdf$/i, ''),
      kind: item.kind === 'practica' ? 'practica' : 'apunte',
      loadText: () => getMaterialText(item.id),
    }))

  const examCandidates: Candidate[] = examList
    .filter((item) => item.has_text)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .map((item) => ({
      key: `fceia:exam:${item.id}`,
      title: item.title,
      kind: 'examen_anterior',
      loadText: () => getExamText(item.id),
    }))

  const pending = interleave(studyCandidates, examCandidates).filter(
    (candidate) => !known.has(candidate.key),
  )
  const batch = pending.slice(0, BATCH_SIZE)

  const outcomes = await mapWithLimit(batch, CONCURRENCY, async (candidate) => {
    try {
      const text = (await candidate.loadText()).slice(0, MAX_DOCUMENT_CHARS).trim()
      if (text.length < MIN_DOCUMENT_CHARS) return 'empty' as const
      const saved = await saveDocument({
        userId,
        subjectId,
        key: candidate.key,
        title: candidate.title,
        kind: candidate.kind,
        content: text,
      })
      return saved ? ('saved' as const) : ('empty' as const)
    } catch (error) {
      console.error('[fceia] document import failed', candidate.key, error)
      return 'failed' as const
    }
  })

  const saved = outcomes.filter((outcome) => outcome === 'saved').length
  const failed = outcomes.filter((outcome) => outcome === 'failed').length

  if (include.materials || include.exams) {
    if (saved > 0) notes.push(`Importé ${plural(saved, 'documento', 'documentos')}.`)
    else if (batch.length === 0) notes.push('Ya tenías todo el material disponible importado.')

    const remaining = pending.length - batch.length
    if (remaining > 0) {
      notes.push(
        `Quedan ${plural(remaining, 'documento', 'documentos')} por importar: volvé a importar para continuar.`,
      )
    }
    if (failed > 0) notes.push(`${plural(failed, 'documento falló', 'documentos fallaron')}; se reintentan al importar de nuevo.`)
    if (withoutText > 0) {
      notes.push(`${plural(withoutText, 'documento', 'documentos')} sin texto extraíble (escaneos) quedaron afuera.`)
    }
  }

  if (include.bibliography && !known.has(BIBLIOGRAPHY_KEY)) {
    try {
      const entries = await listBibliography(fceiaSubjectId)
      const content = formatBibliography(entries)
      if (content) {
        await saveDocument({
          userId,
          subjectId,
          key: BIBLIOGRAPHY_KEY,
          title: 'Bibliografía oficial',
          kind: 'bibliografia',
          content,
        })
        notes.push(`Agregué la bibliografía oficial (${plural(entries.length, 'obra', 'obras')}).`)
      }
    } catch (error) {
      console.error('[fceia] bibliography import failed', error)
      notes.push('No pude importar la bibliografía.')
    }
  }

  return notes.join(' ') || 'No había nada nuevo para importar.'
}
