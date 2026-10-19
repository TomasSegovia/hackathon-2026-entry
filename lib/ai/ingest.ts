import 'server-only'
import { db } from '@/lib/db'
import { chunks, materials } from '@/lib/db/schema'
import { embedTexts } from '@/lib/ai/retrieve'
import { chunkPages, chunkText, type PageChunk } from '@/lib/ai/text'
import type { MaterialKind } from '@/lib/types'

const INSERT_SLICE = 200

export type NewMaterial = {
  userId: string
  subjectId: string
  title: string
  kind: MaterialKind
  text: string
  pages: string[] | null
  sourceName: string | null
  externalKey?: string | null
}

/** Indexes a document with its page numbers. Returns false when there is not enough text. */
export async function saveMaterial(input: NewMaterial): Promise<boolean> {
  const pieces: PageChunk[] = input.pages
    ? chunkPages(input.pages)
    : chunkText(input.text).map((content) => ({ content, page: null }))
  if (pieces.length === 0) return false

  const embeddings = await embedTexts(pieces.map((piece) => piece.content))

  await db.transaction(async (tx) => {
    const [material] = await tx
      .insert(materials)
      .values({
        userId: input.userId,
        subjectId: input.subjectId,
        title: input.title.slice(0, 160),
        kind: input.kind,
        content: input.text,
        sourceName: input.sourceName,
        externalKey: input.externalKey ?? null,
        chunkCount: pieces.length,
      })
      .returning({ id: materials.id })

    for (let start = 0; start < pieces.length; start += INSERT_SLICE) {
      await tx.insert(chunks).values(
        pieces.slice(start, start + INSERT_SLICE).map((piece, offset) => ({
          userId: input.userId,
          subjectId: input.subjectId,
          materialId: material.id,
          position: start + offset,
          page: piece.page,
          content: piece.content,
          embedding: embeddings[start + offset],
        })),
      )
    }
  })
  return true
}
