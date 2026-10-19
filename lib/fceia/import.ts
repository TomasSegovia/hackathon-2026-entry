import 'server-only'
import { and, eq, isNotNull } from 'drizzle-orm'
import { saveMaterial } from '@/lib/ai/ingest'
import { extractPdfPages, extractTextFromFile, truncatePages } from '@/lib/ai/text'
import { db } from '@/lib/db'
import { chunks, materials, subjects } from '@/lib/db/schema'
import { classifyBooks } from '@/lib/fceia/books'
import {
  downloadPdf,
  getExamText,
  getMaterialText,
  getOverview,
  listBibliography,
  listExams,
  listMaterials,
  type FceiaBibliography,
  type FceiaOverview,
} from '@/lib/fceia/client'
import { MAX_BOOK_BYTES, MAX_BOOK_CHARS } from '@/lib/fceia/types'
import type { MaterialKind } from '@/lib/types'

/** Weight budget per request, so a single request never exceeds the server time limit. */
const BATCH_BUDGET = 12
const BOOK_WEIGHT = 6
const CONCURRENCY = 3
const MAX_DOCUMENT_CHARS = 60_000
const MAX_DOCUMENT_PDF_BYTES = 25 * 1024 * 1024
const MIN_DOCUMENT_CHARS = 100
const MAX_PROGRAM_CHARS = 30_000
const BIBLIOGRAPHY_KEY = 'fceia:bibliography'

export type ImportInput = {
  userId: string
  subjectId: string
  fceiaSubjectId: number
  include: { program: boolean; materials: boolean; exams: boolean }
  bibliographyIds: number[]
  bookIds: number[]
  /** Documents already settled (failed or empty) in earlier batches of this run. */
  skipKeys: string[]
  /** True for the first batch, which also handles the program and the bibliography. */
  initial: boolean
}

export type BatchResult = {
  saved: number
  failed: number
  empty: number
  remaining: number
  settledKeys: string[]
  notes: string[]
  withoutText: number
}

type LoadedDocument = { text: string; pages: string[] | null }

type Candidate = {
  key: string
  title: string
  kind: MaterialKind
  weight: number
  load: () => Promise<LoadedDocument>
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

/**
 * Prefers the original PDF to keep real page numbers. Falls back to the API text when the PDF
 * is unavailable, too large, or has a thinner text layer than the API's own extraction.
 */
async function loadDocument(options: {
  filePath: string | null
  apiText: () => Promise<string>
  maxChars: number
  maxBytes: number
  timeoutMs: number
}): Promise<LoadedDocument> {
  const apiText = (await options.apiText()).trim()

  if (options.filePath) {
    try {
      const bytes = await downloadPdf(options.filePath, {
        maxBytes: options.maxBytes,
        timeoutMs: options.timeoutMs,
      })
      if (bytes) {
        const pages = truncatePages(await extractPdfPages(bytes), options.maxChars)
        const text = pages.join('\n\n').trim()
        const comparable = Math.min(apiText.length, options.maxChars)
        if (text.length >= MIN_DOCUMENT_CHARS && text.length >= comparable * 0.5) {
          return { text, pages }
        }
      }
    } catch (error) {
      console.error('[fceia] pdf unreadable, using api text', options.filePath, error)
    }
  }

  return { text: apiText.slice(0, options.maxChars), pages: null }
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

function pickBatch(pending: Candidate[]) {
  const batch: Candidate[] = []
  let used = 0
  for (const candidate of pending) {
    if (batch.length > 0 && used + candidate.weight > BATCH_BUDGET) break
    batch.push(candidate)
    used += candidate.weight
  }
  return batch
}

async function importProgram(input: ImportInput, notes: string[]) {
  const { userId, subjectId, fceiaSubjectId } = input

  const [current] = await db
    .select({ program: subjects.program })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))

  await db
    .update(subjects)
    .set({ fceiaSubjectId })
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))

  if (!input.include.program) return
  if (current?.program?.trim()) {
    notes.push('Mantuve el programa que ya habías cargado.')
    return
  }

  const program = await buildProgram(await getOverview(fceiaSubjectId))
  if (!program) {
    notes.push('No pude leer el programa oficial; pegalo o subilo a mano.')
    return
  }
  await db
    .update(subjects)
    .set({ program })
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
  notes.push('Cargué el programa oficial.')
}

async function importBibliography(
  input: ImportInput,
  entries: FceiaBibliography[],
  notes: string[],
) {
  const { userId, subjectId } = input
  const chosen = entries.filter((entry) => input.bibliographyIds.includes(entry.id))
  if (chosen.length === 0) return

  try {
    // The selection can change between runs, so the reference sheet is always rebuilt.
    const previous = await db
      .select({ id: materials.id })
      .from(materials)
      .where(
        and(
          eq(materials.subjectId, subjectId),
          eq(materials.userId, userId),
          eq(materials.externalKey, BIBLIOGRAPHY_KEY),
        ),
      )
    for (const { id } of previous) {
      await db.delete(chunks).where(and(eq(chunks.materialId, id), eq(chunks.userId, userId)))
      await db.delete(materials).where(and(eq(materials.id, id), eq(materials.userId, userId)))
    }

    await saveMaterial({
      userId,
      subjectId,
      title: 'Bibliografía oficial',
      kind: 'bibliografia',
      text: formatBibliography(chosen),
      pages: null,
      sourceName: 'FCEIA',
      externalKey: BIBLIOGRAPHY_KEY,
    })
    notes.push(
      `Agregué la ficha de ${chosen.length} ${chosen.length === 1 ? 'obra' : 'obras'} de la bibliografía.`,
    )
  } catch (error) {
    console.error('[fceia] bibliography import failed', error)
    notes.push('No pude importar la bibliografía.')
  }
}

/** Imports one batch of FCEIA documents; the client repeats it until nothing remains. */
export async function importBatch(input: ImportInput): Promise<BatchResult> {
  const { userId, subjectId, fceiaSubjectId, include } = input
  const notes: string[] = []

  if (input.initial) await importProgram(input, notes)

  const [materialList, examList, bibliography] = await Promise.all([
    include.materials || input.bookIds.length > 0
      ? listMaterials(fceiaSubjectId)
      : Promise.resolve([]),
    include.exams ? listExams(fceiaSubjectId) : Promise.resolve([]),
    listBibliography(fceiaSubjectId),
  ])

  if (input.initial) await importBibliography(input, bibliography, notes)

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
  const unavailable = new Set<string | null>([...existing.map((row) => row.key), ...input.skipKeys])

  const { bookIds } = classifyBooks(
    materialList.filter((item) => item.has_text),
    bibliography,
  )

  const withoutText = input.initial
    ? materialList.filter((item) => !item.has_text && !bookIds.has(item.id)).length +
      examList.filter((item) => !item.has_text).length
    : 0

  const studyCandidates: Candidate[] = include.materials
    ? materialList
        .filter((item) => item.has_text && !bookIds.has(item.id))
        .map((item) => ({
          key: `fceia:material:${item.id}`,
          title: item.title.replace(/\.pdf$/i, ''),
          kind: item.kind === 'practica' ? ('practica' as const) : ('apunte' as const),
          weight: 1,
          load: () =>
            loadDocument({
              filePath: item.url,
              apiText: () => getMaterialText(item.id),
              maxChars: MAX_DOCUMENT_CHARS,
              maxBytes: MAX_DOCUMENT_PDF_BYTES,
              timeoutMs: 25_000,
            }),
        }))
    : []

  const examCandidates: Candidate[] = examList
    .filter((item) => item.has_text)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .map((item) => ({
      key: `fceia:exam:${item.id}`,
      title: item.title,
      kind: 'examen_anterior' as const,
      weight: 1,
      load: () =>
        loadDocument({
          filePath: item.file_url,
          apiText: () => getExamText(item.id),
          maxChars: MAX_DOCUMENT_CHARS,
          maxBytes: MAX_DOCUMENT_PDF_BYTES,
          timeoutMs: 25_000,
        }),
    }))

  const bookCandidates: Candidate[] = materialList
    .filter((item) => item.has_text && input.bookIds.includes(item.id))
    .map((item) => ({
      key: `fceia:material:${item.id}`,
      title: item.title.replace(/\.pdf$/i, ''),
      kind: 'bibliografia' as const,
      weight: BOOK_WEIGHT,
      load: () =>
        loadDocument({
          filePath: item.url,
          apiText: () => getMaterialText(item.id),
          maxChars: MAX_BOOK_CHARS,
          maxBytes: MAX_BOOK_BYTES,
          timeoutMs: 90_000,
        }),
    }))

  const pending = [...interleave(studyCandidates, examCandidates), ...bookCandidates].filter(
    (candidate) => !unavailable.has(candidate.key),
  )
  const batch = pickBatch(pending)

  const outcomes = await mapWithLimit(batch, CONCURRENCY, async (candidate) => {
    try {
      const document = await candidate.load()
      if (document.text.length < MIN_DOCUMENT_CHARS) return 'empty' as const
      const saved = await saveMaterial({
        userId,
        subjectId,
        title: candidate.title,
        kind: candidate.kind,
        text: document.text,
        pages: document.pages,
        sourceName: 'FCEIA',
        externalKey: candidate.key,
      })
      return saved ? ('saved' as const) : ('empty' as const)
    } catch (error) {
      console.error('[fceia] document import failed', candidate.key, error)
      return 'failed' as const
    }
  })

  return {
    saved: outcomes.filter((outcome) => outcome === 'saved').length,
    failed: outcomes.filter((outcome) => outcome === 'failed').length,
    empty: outcomes.filter((outcome) => outcome === 'empty').length,
    remaining: pending.length - batch.length,
    settledKeys: batch
      .filter((_, index) => outcomes[index] !== 'saved')
      .map((candidate) => candidate.key),
    notes,
    withoutText,
  }
}
