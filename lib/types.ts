export const MATERIAL_KINDS = {
  apunte: 'Apunte',
  examen_anterior: 'Examen anterior',
  bibliografia: 'Bibliografía',
  otro: 'Otro',
} as const

export const EXERCISE_KINDS = {
  ejercicio: 'Ejercicio',
  practica: 'Práctica',
  examen: 'Examen',
} as const

export type MaterialKind = keyof typeof MATERIAL_KINDS
export type ExerciseKind = keyof typeof EXERCISE_KINDS

export type ItemStatus = 'found' | 'weak' | 'not_found'
export type WebStatus = 'none' | 'declined' | 'done' | 'error'

export type Source = {
  materialId: string
  materialTitle: string
  materialKind: string
  snippet: string
  score: number
}

export type WebSource = {
  title: string
  url: string
}

export function isMaterialKind(value: string): value is MaterialKind {
  return value in MATERIAL_KINDS
}

export function isExerciseKind(value: string): value is ExerciseKind {
  return value in EXERCISE_KINDS
}
