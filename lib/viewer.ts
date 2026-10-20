export const ORIGINAL_FILE_KEY = /^fceia:(material|exam):(\d+)$/

export function viewerHref(subjectId: string, materialId: string, pages: number[] = []) {
  const params = new URLSearchParams()
  if (pages.length > 0) params.set('paginas', pages.join(','))
  const query = params.toString()
  return `/materias/${subjectId}/visor/${materialId}${query ? `?${query}` : ''}`
}

export function parsePages(value: string | string[] | undefined): number[] {
  const raw = Array.isArray(value) ? value.join(',') : (value ?? '')
  const pages = raw
    .split(',')
    .map((part) => Number.parseInt(part, 10))
    .filter((page) => Number.isInteger(page) && page >= 1 && page <= 5000)
  return [...new Set(pages)].sort((a, b) => a - b).slice(0, 40)
}
