/** A book file is flagged as heavy above this size: it takes minutes to download and index. */
export const HEAVY_BOOK_BYTES = 10 * 1024 * 1024
/** Files above this size cannot be processed within a request. */
export const MAX_BOOK_BYTES = 40 * 1024 * 1024
/** Characters indexed per book (about the first 250 pages). */
export const MAX_BOOK_CHARS = 500_000

export type BookFile = {
  id: number
  title: string
  sizeBytes: number | null
  heavy: boolean
  tooLarge: boolean
}

export type BookEntry = {
  id: number
  title: string
  author: string | null
  year: number | null
  kind: string | null
  files: BookFile[]
}

export type BookCatalog = {
  entries: BookEntry[]
  looseBooks: BookFile[]
}

export function formatBytes(bytes: number | null) {
  if (bytes === null) return 'tamaño desconocido'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
