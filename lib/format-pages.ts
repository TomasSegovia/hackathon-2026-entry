/** Formats page numbers as "págs. 3–5, 9". */
export function formatPages(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b)
  if (sorted.length === 0) return ''

  const ranges: string[] = []
  let start = sorted[0]
  let previous = sorted[0]
  for (const page of [...sorted.slice(1), Number.POSITIVE_INFINITY]) {
    if (page === previous + 1) {
      previous = page
      continue
    }
    ranges.push(start === previous ? `${start}` : `${start}–${previous}`)
    start = page
    previous = page
  }

  return `${sorted.length === 1 ? 'pág.' : 'págs.'} ${ranges.join(', ')}`
}
