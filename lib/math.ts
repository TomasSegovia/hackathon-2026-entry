export type MathSegment = { type: 'text' | 'inline' | 'display'; value: string }

const MATH_PATTERN =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)([^$\n]+?)(?<!\s)\$/g

/**
 * Models sometimes write LaTeX inside JSON without escaping the backslash, so `\begin`, `\frac`,
 * `\theta` or `\neq` arrive as control characters (backspace, form feed, tab, newline) followed by
 * the rest of the command. This puts the backslash back.
 */
export function repairLatexEscapes(input: string): string {
  return input
    .replace(/\u0008/g, '\\b')
    .replace(/\f/g, '\\f')
    .replace(/\v/g, '\\v')
    .replace(/\t(?=(?:ext|heta|au|imes|o\b|an|frac|op|riangle|ilde))/g, '\\t')
    .replace(/\r(?=(?:ight|ho|angle|m\b|mathrm))/g, '\\r')
    .replace(/\n(?=(?:eq|u\b|abla|ot|otin|i\b|eg|ewline|mid|subseteq|leq|geq)\b)/g, '\\n')
}

const COMMAND_START = /\\(?:begin\{([A-Za-z*]+)\}|[A-Za-z]+)/g

function skipBraceGroups(input: string, pos: number): number {
  let cursor = pos
  while (input[cursor] === '{') {
    let depth = 0
    let end = cursor
    for (; end < input.length; end++) {
      if (input[end] === '{') depth++
      else if (input[end] === '}' && --depth === 0) break
    }
    if (depth !== 0) return cursor
    cursor = end + 1
  }
  return cursor
}

/** Consumes formula tokens after `pos` and returns where the formula ends. */
function extendFormula(input: string, pos: number): number {
  let cursor = pos
  let lastGood = pos
  while (cursor < input.length) {
    const rest = input.slice(cursor)
    const space = rest.match(/^[ \t]*/)?.[0].length ?? 0
    const at = cursor + space
    const tail = input.slice(at)
    let next = -1

    const env = tail.match(/^\\begin\{([A-Za-z*]+)\}/)
    if (env) {
      const close = input.indexOf(`\\end{${env[1]}}`, at)
      if (close !== -1) next = close + `\\end{${env[1]}}`.length
    } else if (/^\\\\/.test(tail)) {
      next = at + 2
    } else if (/^\\[A-Za-z]+/.test(tail)) {
      next = skipBraceGroups(input, at + (tail.match(/^\\[A-Za-z]+/)?.[0].length ?? 0))
    } else if (/^[{}^_=+\-*/<>|0-9]/.test(tail)) {
      next = at + (tail.match(/^[{}^_=+\-*/<>|0-9]+/)?.[0].length ?? 1)
    } else if (/^[A-Za-z](?![A-Za-zÀ-ÿ])/.test(tail)) {
      next = at + 1
    }

    if (next <= at) break
    cursor = next
    lastGood = next
  }
  return lastGood
}

/** Finds LaTeX written without $ delimiters (e.g. `\begin{cases}…\end{cases} \quad t \in \mathbb{R}`). */
function splitBareLatex(text: string): MathSegment[] {
  const segments: MathSegment[] = []
  let cursor = 0

  for (const match of text.matchAll(COMMAND_START)) {
    const index = match.index ?? 0
    if (index < cursor) continue
    const end = extendFormula(text, index)
    if (end <= index) continue
    if (index > cursor) segments.push({ type: 'text', value: text.slice(cursor, index) })
    const formula = text.slice(index, end).trim()
    segments.push({ type: /\\begin\{/.test(formula) ? 'display' : 'inline', value: formula })
    cursor = end
  }

  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) })
  return segments
}

/** Splits a string into plain text and LaTeX segments ($…$, $$…$$, \(…\), \[…\], or bare LaTeX). */
export function splitMath(raw: string): MathSegment[] {
  const input = repairLatexEscapes(raw)
  const segments: MathSegment[] = []
  let cursor = 0
  const pushText = (value: string) => segments.push(...splitBareLatex(value))

  for (const match of input.matchAll(MATH_PATTERN)) {
    const index = match.index ?? 0
    if (index > cursor) pushText(input.slice(cursor, index))

    const [, doubleDollar, bracket, paren, singleDollar] = match
    if (doubleDollar !== undefined || bracket !== undefined) {
      segments.push({ type: 'display', value: (doubleDollar ?? bracket).trim() })
    } else {
      segments.push({ type: 'inline', value: (paren ?? singleDollar).trim() })
    }
    cursor = index + match[0].length
  }

  if (cursor < input.length) pushText(input.slice(cursor))
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
