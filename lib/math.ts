export type MathSegment = { type: 'text' | 'inline' | 'display'; value: string }

const MATH_PATTERN =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)([^$\n]+?)(?<!\s)\$/g

/** Splits a string into plain text and LaTeX segments ($…$, $$…$$, \(…\), \[…\]). */
export function splitMath(input: string): MathSegment[] {
  const segments: MathSegment[] = []
  let cursor = 0

  for (const match of input.matchAll(MATH_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) segments.push({ type: 'text', value: input.slice(cursor, index) })

    const [, doubleDollar, bracket, paren, singleDollar] = match
    if (doubleDollar !== undefined || bracket !== undefined) {
      segments.push({ type: 'display', value: (doubleDollar ?? bracket).trim() })
    } else {
      segments.push({ type: 'inline', value: (paren ?? singleDollar).trim() })
    }
    cursor = index + match[0].length
  }

  if (cursor < input.length) segments.push({ type: 'text', value: input.slice(cursor) })
  return segments
}

/**
 * Shortens text to `max` characters without leaving a formula half-written: if the cut falls
 * inside $…$ the whole formula is dropped, and unbalanced parentheses are closed.
 */
export function truncateKeepingMath(input: string, max: number): string {
  const text = input.trim()
  if (text.length <= max) return text

  let cut = text.slice(0, max)
  const dollars = [...cut.matchAll(/(?<!\\)\$/g)].length
  if (dollars % 2 === 1) {
    cut = cut.slice(0, cut.lastIndexOf('$'))
  } else {
    const lastSpace = cut.lastIndexOf(' ')
    if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace)
  }

  cut = cut
    .replace(/[\s,;:(\-–]+$/, '')
    .replace(/\s+(y|e|o|de|del|en|con|para|la|el|los|las|un|una)$/i, '')
    .trim()

  const opened = (cut.match(/\(/g) ?? []).length
  const closed = (cut.match(/\)/g) ?? []).length
  return opened > closed ? `${cut})` : cut
}

/** Removes the LaTeX delimiters for contexts that cannot render formulas (SVG, aria labels). */
export function stripMath(input: string): string {
  return splitMath(input)
    .map((segment) => segment.value)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
