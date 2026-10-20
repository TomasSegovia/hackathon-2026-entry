import 'server-only'
import { generateText } from 'ai'
import { ocrModel } from '@/lib/ai/provider'

export const MAX_OCR_PAGES = 40
const PAGE_MARKER = /^<<<PAGINA (\d+)>>>[ \t]*$/gm

const INSTRUCTIONS = `Sos un motor de OCR para material universitario en español (matemática, física, ingeniería).
Transcribí TODO el texto visible, en el orden de lectura, sin resumir, traducir ni comentar.
- Escribí las fórmulas en LaTeX entre $...$ (en línea) o $$...$$ (en bloque).
- Conservá numeraciones de ejercicios, incisos y títulos.
- Si hay figuras o gráficos sin texto, ignoralos.
- No agregues explicaciones ni texto propio.`

/** Transcribes a scanned PDF and returns the text of each page (index 0 is page 1). */
export async function ocrPdf(bytes: Uint8Array, pageCount: number): Promise<string[]> {
  const pages = Math.min(pageCount || MAX_OCR_PAGES, MAX_OCR_PAGES)
  const { text } = await generateText({
    model: ocrModel,
    system: INSTRUCTIONS,
    maxOutputTokens: 60_000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'file', data: bytes, mediaType: 'application/pdf', filename: 'documento.pdf' },
          {
            type: 'text',
            text: `Transcribí las páginas 1 a ${pages}. Antes del contenido de cada página escribí una línea exacta "<<<PAGINA n>>>" con su número.`,
          },
        ],
      },
    ],
  })
  return splitPages(text, pages)
}

/** Transcribes a single image (photo or screenshot of a page). */
export async function ocrImage(bytes: Uint8Array, mediaType: string): Promise<string> {
  const { text } = await generateText({
    model: ocrModel,
    system: INSTRUCTIONS,
    maxOutputTokens: 8_000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'file', data: bytes, mediaType },
          { type: 'text', text: 'Transcribí el texto de esta imagen.' },
        ],
      },
    ],
  })
  return text.trim()
}

function splitPages(text: string, pageCount: number): string[] {
  const markers = [...text.matchAll(PAGE_MARKER)]
  if (markers.length === 0) return [text.trim()]

  const pages: string[] = Array.from({ length: pageCount }, () => '')
  markers.forEach((marker, index) => {
    const page = Number(marker[1])
    if (page < 1 || page > pageCount) return
    const start = marker.index + marker[0].length
    const end = index + 1 < markers.length ? markers[index + 1].index : text.length
    pages[page - 1] = text.slice(start, end).trim()
  })
  return pages
}
