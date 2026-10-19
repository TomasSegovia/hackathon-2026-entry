import 'server-only'

const BASE_URL = 'https://fceia-api.ariloc.ar/api/v1'
const REQUEST_TIMEOUT_MS = 25_000

export type FceiaCareer = {
  id: number
  name: string
  level: string
  subject_count: number
}

export type FceiaSubject = {
  id: number
  career_id: number
  code: string
  name: string
  year: number | null
  term: number | null
  kind: string
  syllabus_pdf_url: string | null
}

export type FceiaOverview = FceiaSubject & {
  description: string | null
  material_count: number
  exam_count: number
}

export type FceiaMaterial = {
  id: number
  title: string
  kind: string
  url: string | null
  has_text: boolean
}

export type FceiaExam = {
  id: number
  title: string
  category: string
  date: string | null
  file_url: string | null
  has_text: boolean
}

export type FceiaBibliography = {
  id: number
  title: string
  author: string | null
  year: number | null
  editorial: string | null
  kind: string | null
}

type Page<T> = { items: T[]; total: number }

async function request<T>(path: string, options: { cache?: boolean } = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...(options.cache ? { next: { revalidate: 3600 } } : { cache: 'no-store' as const }),
  })
  if (!response.ok) {
    throw new Error(`FCEIA API ${response.status} en ${path}`)
  }
  return (await response.json()) as T
}

export async function listCareers() {
  const { items } = await request<Page<FceiaCareer>>('/careers?limit=200', { cache: true })
  return items
}

export async function listSubjects(careerId: number) {
  const { items } = await request<Page<FceiaSubject>>(
    `/subjects?career_id=${careerId}&limit=200`,
    { cache: true },
  )
  return items
}

export function getOverview(subjectId: number) {
  return request<FceiaOverview>(`/subjects/${subjectId}/overview`, { cache: true })
}

export async function listMaterials(subjectId: number) {
  const { items } = await request<Page<FceiaMaterial>>(
    `/materials?subject_id=${subjectId}&limit=200`,
    { cache: true },
  )
  return items
}

export async function listExams(subjectId: number) {
  const { items } = await request<Page<FceiaExam>>(
    `/exams?subject_id=${subjectId}&limit=200`,
    { cache: true },
  )
  return items
}

export async function listBibliography(subjectId: number) {
  const { items } = await request<Page<FceiaBibliography>>(
    `/subjects/${subjectId}/bibliography?limit=200`,
    { cache: true },
  )
  return items
}

const ORIGIN = 'https://fceia-api.ariloc.ar'

function absoluteUrl(path: string) {
  return new URL(path, ORIGIN).href
}

/** Size in bytes of an original file, or null when the server does not report it. */
export async function getFileSize(path: string): Promise<number | null> {
  try {
    const response = await fetch(absoluteUrl(path), {
      method: 'HEAD',
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 3600 },
    })
    const length = Number(response.headers.get('content-length'))
    return response.ok && Number.isFinite(length) && length > 0 ? length : null
  } catch {
    return null
  }
}

/** Downloads an original PDF; returns null when it is not a PDF or exceeds the size limit. */
export async function downloadPdf(
  path: string,
  options: { maxBytes: number; timeoutMs: number },
): Promise<Uint8Array | null> {
  if (!/\.pdf(\?|$)/i.test(path)) return null
  const response = await fetch(absoluteUrl(path), {
    signal: AbortSignal.timeout(options.timeoutMs),
    cache: 'no-store',
  })
  if (!response.ok) return null

  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > options.maxBytes) return null

  const bytes = new Uint8Array(await response.arrayBuffer())
  return bytes.byteLength > options.maxBytes ? null : bytes
}

export async function getMaterialText(materialId: number) {
  const { text } = await request<{ text: string }>(`/materials/${materialId}/text`)
  return text ?? ''
}

export async function getExamText(examId: number) {
  const { text } = await request<{ text: string }>(`/exams/${examId}/text`)
  return text ?? ''
}
