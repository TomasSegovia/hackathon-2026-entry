export const MATERIAL_KINDS = {
  bibliografia: 'Bibliografía',
  apunte: 'Apunte',
  practica: 'Práctica',
  examen_anterior: 'Examen anterior',
  otro: 'Otro',
} as const

export type MaterialKind = keyof typeof MATERIAL_KINDS

/** Materials that provide exercises instead of theory. */
export const PRACTICE_KINDS: readonly MaterialKind[] = ['practica', 'examen_anterior']

export const PROGRESS_STATUSES = ['pending', 'learning', 'done'] as const
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number]

export const STATUS_LABELS: Record<ProgressStatus, string> = {
  pending: 'Por ver',
  learning: 'En curso',
  done: 'Visto',
}

export type Source = {
  materialId: string
  materialTitle: string
  materialKind: string
  /** Pages of the document where the topic is covered; empty when the document has no pagination. */
  pages?: number[]
  score: number
}

export type TopicData = {
  id: string
  title: string
  summary: string
  position: number
  prerequisites: string[]
  status: ProgressStatus
}

export type SubtopicData = {
  id: string
  topicId: string
  title: string
  position: number
  status: ProgressStatus
  sources: Source[]
}

export type ExerciseData = {
  id: string
  topicId: string
  subtopicId: string
  statement: string
  done: boolean
  materialId: string | null
  materialTitle: string | null
  materialKind: string | null
  /** Numbering of the exercise as it appears in its document, e.g. "Ejercicio 3 b)". */
  label: string | null
  page: number | null
}

export function isMaterialKind(value: string): value is MaterialKind {
  return value in MATERIAL_KINDS
}

export function isProgressStatus(value: unknown): value is ProgressStatus {
  return typeof value === 'string' && (PROGRESS_STATUSES as readonly string[]).includes(value)
}
