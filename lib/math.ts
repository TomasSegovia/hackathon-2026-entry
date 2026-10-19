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

/** Removes the LaTeX delimiters for contexts that cannot render formulas (SVG, aria labels). */
export function stripMath(input: string): string {
  return splitMath(input)
    .map((segment) => segment.value)
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
