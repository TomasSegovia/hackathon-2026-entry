import 'server-only'
import { extractText, getDocumentProxy } from 'unpdf'

export const MAX_FILE_BYTES = 8 * 1024 * 1024

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.csv', '.tex']

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('El archivo supera el límite de 8 MB.')
  }

  const name = file.name.toLowerCase()

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
    const { text } = await extractText(pdf, { mergePages: true })
    return normalize(text)
  }

  if (file.type.startsWith('text/') || TEXT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return normalize(await file.text())
  }

  throw new Error('Formato no soportado todavía. Subí un PDF o un archivo de texto.')
}

function normalize(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function chunkText(text: string, maxChars = 1000, overlap = 150): string[] {
  const paragraphs = normalize(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  const flush = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      flush()
      for (let start = 0; start < paragraph.length; start += maxChars - overlap) {
        chunks.push(paragraph.slice(start, start + maxChars).trim())
      }
      continue
    }
    if (current.length + paragraph.length + 2 > maxChars) {
      const tail = current.slice(-overlap)
      flush()
      current = tail ? `${tail}\n\n${paragraph}` : paragraph
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph
    }
  }
  flush()

  return chunks.filter((chunk) => chunk.length > 20)
}
