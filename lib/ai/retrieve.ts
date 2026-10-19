import 'server-only'
import { embedMany } from 'ai'
import { and, cosineDistance, eq, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chunks, materials } from '@/lib/db/schema'
import { embeddingModel } from '@/lib/ai/provider'
import { PRACTICE_KINDS, type Source } from '@/lib/types'

const MIN_SCORE = 0.3
const MAX_SOURCES = 2
const SNIPPET_LENGTH = 320

export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return []
  const { embeddings } = await embedMany({ model: embeddingModel, values })
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
      snippet: chunks.content,
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
    .limit(8)

  const bestPerMaterial = new Map<string, Source>()
  for (const row of rows) {
    const score = Number(row.score)
    if (score < MIN_SCORE || bestPerMaterial.has(row.materialId)) continue
    bestPerMaterial.set(row.materialId, {
      ...row,
      score,
      snippet: row.snippet.slice(0, SNIPPET_LENGTH),
    })
  }

  return [...bestPerMaterial.values()].slice(0, MAX_SOURCES)
}

/** Finds, for each query, the theory fragments of the subject that best explain it. */
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
