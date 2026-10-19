import 'server-only'
import { embedMany } from 'ai'
import { and, cosineDistance, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chunks, materials } from '@/lib/db/schema'
import type { ItemStatus, Source } from '@/lib/types'

export const EMBEDDING_MODEL = 'openai/text-embedding-3-small'

const FOUND_THRESHOLD = 0.45
const WEAK_THRESHOLD = 0.3
const MAX_SOURCES_PER_ITEM = 3

export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return []
  const { embeddings } = await embedMany({ model: EMBEDDING_MODEL, values })
  return embeddings
}

async function searchOne(
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
    .where(and(eq(chunks.userId, userId), eq(chunks.subjectId, subjectId)))
    .orderBy(sql`${similarity} desc`)
    .limit(12)

  const bestPerMaterial = new Map<string, Source>()
  for (const row of rows) {
    const score = Number(row.score)
    if (score < WEAK_THRESHOLD || bestPerMaterial.has(row.materialId)) continue
    bestPerMaterial.set(row.materialId, { ...row, score })
  }

  return [...bestPerMaterial.values()].slice(0, MAX_SOURCES_PER_ITEM)
}

export function classify(sources: Source[]): ItemStatus {
  const best = sources[0]?.score ?? 0
  if (best >= FOUND_THRESHOLD) return 'found'
  if (best >= WEAK_THRESHOLD) return 'weak'
  return 'not_found'
}

export async function findSourcesForQueries(
  userId: string,
  subjectId: string,
  queries: string[],
): Promise<Source[][]> {
  const embeddings = await embedTexts(queries)
  return Promise.all(embeddings.map((embedding) => searchOne(userId, subjectId, embedding)))
}
