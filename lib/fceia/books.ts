import 'server-only'
import {
  getFileSize,
  listBibliography,
  listMaterials,
  type FceiaBibliography,
  type FceiaMaterial,
} from '@/lib/fceia/client'
import {
  HEAVY_BOOK_BYTES,
  MAX_BOOK_BYTES,
  type BookCatalog,
  type BookEntry,
  type BookFile,
} from '@/lib/fceia/types'

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function authorSurnames(author: string | null) {
  if (!author) return []
  return author
    .split(/;|&|\sy\s|\s-\s|\/|\se\s/)
    .map((part) => normalize(part.split(',')[0] ?? '').replace(/[^a-z\s]/g, '').trim())
    .filter((surname) => surname.length >= 4)
}

function mentionsSurname(title: string, surnames: string[]) {
  const text = normalize(title)
  return surnames.some((surname) => new RegExp(`(^|[^a-z])${surname}([^a-z]|$)`).test(text))
}

export type BookClassification = {
  /** Material ids matched to each bibliography entry, by author surname. */
  byEntry: Map<number, FceiaMaterial[]>
  /** Material files of kind "libro" that match no bibliography entry. */
  loose: FceiaMaterial[]
  /** Every material that must be imported only when the user picks it as a book. */
  bookIds: Set<number>
}

/** Splits subject materials into regular study files and books linked to the bibliography. */
export function classifyBooks(
  materials: FceiaMaterial[],
  entries: FceiaBibliography[],
): BookClassification {
  const byEntry = new Map<number, FceiaMaterial[]>()
  const loose: FceiaMaterial[] = []
  const bookIds = new Set<number>()
  const surnamesByEntry = entries.map((entry) => ({
    id: entry.id,
    surnames: authorSurnames(entry.author),
  }))

  for (const material of materials) {
    const entry = surnamesByEntry.find((candidate) =>
      mentionsSurname(material.title, candidate.surnames),
    )
    if (entry) {
      byEntry.set(entry.id, [...(byEntry.get(entry.id) ?? []), material])
      bookIds.add(material.id)
    } else if (material.kind === 'libro') {
      loose.push(material)
      bookIds.add(material.id)
    }
  }

  return { byEntry, loose, bookIds }
}

async function toBookFile(material: FceiaMaterial): Promise<BookFile> {
  const sizeBytes = material.url ? await getFileSize(material.url) : null
  return {
    id: material.id,
    title: material.title.replace(/\.pdf$/i, ''),
    sizeBytes,
    heavy: sizeBytes !== null && sizeBytes >= HEAVY_BOOK_BYTES,
    tooLarge: sizeBytes !== null && sizeBytes > MAX_BOOK_BYTES,
  }
}

export async function getBookCatalog(fceiaSubjectId: number): Promise<BookCatalog> {
  const [materials, bibliography] = await Promise.all([
    listMaterials(fceiaSubjectId),
    listBibliography(fceiaSubjectId),
  ])

  const { byEntry, loose } = classifyBooks(
    materials.filter((material) => material.has_text),
    bibliography,
  )

  const entries: BookEntry[] = await Promise.all(
    bibliography.map(async (entry) => ({
      id: entry.id,
      title: entry.title,
      author: entry.author,
      year: entry.year,
      kind: entry.kind,
      files: await Promise.all((byEntry.get(entry.id) ?? []).map(toBookFile)),
    })),
  )

  return { entries, looseBooks: await Promise.all(loose.map(toBookFile)) }
}
