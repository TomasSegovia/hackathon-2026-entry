import 'server-only'
import { embedMany } from 'ai'
import { and, cosineDistance, eq, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chunks, materials } from '@/lib/db/schema'
import { embeddingModel } from '@/lib/ai/provider'
import { PRACTICE_KINDS, type Source } from '@/lib/types'

const MIN_SCORE = 0.3
const MAX_SOURCES = 2
const MAX_PAGES_PER_SOURCE = 4
const EMBEDDING_BATCH = 100

export async function embedTexts(values: string[]): Promise<number[][]> {
  const embeddings: number[][] = []
  for (let start = 0; start < values.length; start += EMBEDDING_BATCH) {
    const { embeddings: batch } = await embedMany({
      model: embeddingModel,
      values: values.slice(start, start + EMBEDDING_BATCH),
    })
    embeddings.push(...batch)
  }
  return embeddings
}

async function searchStudyMaterial(
  userId: string,
  subjectId: string,
  embedding: number[],
): Promise<Source[]> {
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, embedding)})`

  const rows = await db
    .select({
      materialId: materials.id,
      materialTitle: materials.title,
      materialKind: materials.kind,
      page: chunks.page,
      score: similarity,
    })
    .from(chunks)
    .innerJoin(materials, eq(materials.id, chunks.materialId))
    .where(
      and(
        eq(chunks.userId, userId),
        eq(chunks.subjectId, subjectId),
        notInArray(materials.kind, [...PRACTICE_KINDS]),
      ),
    )
    .orderBy(sql`${similarity} desc`)
    .limit(14)

  const byMaterial = new Map<string, Source & { pages: number[] }>()
  for (const row of rows) {
    const score = Number(row.score)
    if (score < MIN_SCORE) continue

    let source = byMaterial.get(row.materialId)
    if (!source) {
      if (byMaterial.size >= MAX_SOURCES) continue
      source = {
        materialId: row.materialId,
        materialTitle: row.materialTitle,
        materialKind: row.materialKind,
        pages: [],
        score,
      }
      byMaterial.set(row.materialId, source)
    }
    if (row.page !== null && source.pages.length < MAX_PAGES_PER_SOURCE && !source.pages.includes(row.page)) {
      source.pages.push(row.page)
    }
  }

  return [...byMaterial.values()].map((source) => ({
    ...source,
    pages: [...source.pages].sort((a, b) => a - b),
  }))
}

/** Finds, for each query, the theory documents and pages of the subject that best explain it. */
export async function findStudySources(
  userId: string,
  subjectId: string,
  queries: string[],
): Promise<Source[][]> {
  const embeddings = await embedTexts(queries)
  return Promise.all(
    embeddings.map((embedding) => searchStudyMaterial(userId, subjectId, embedding)),
  )
}
