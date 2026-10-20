'use server'

import { and, asc, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  draftTopics,
  extractExercises,
  type CatalogEntry,
  type ExtractedExercise,
} from '@/lib/ai/roadmap'
import { findStudySources } from '@/lib/ai/retrieve'
import { db } from '@/lib/db'
import {
  chunks,
  materials,
  practiceExercises,
  subjects,
  subtopics,
  topics,
} from '@/lib/db/schema'
import { UserError, toUserMessage } from '@/lib/errors'
import { sanitizePrerequisites } from '@/lib/roadmap/graph'
import { deriveTopicStatus } from '@/lib/roadmap/progress'
import { getUserId } from '@/lib/session'
import {
  MATERIAL_KINDS,
  PRACTICE_KINDS,
  isProgressStatus,
  type MaterialKind,
  type ProgressStatus,
  type Source,
} from '@/lib/types'

const MAX_PRACTICE_GUIDES = 8
const MAX_EXAMS = 12
const EXTRACTION_CONCURRENCY = 5

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await run(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** Rebuilds each document from its indexed chunks with page markers so exercises can be located. */
async function loadPagedContent(userId: string, materialIds: string[]) {
  const result = new Map<string, { text: string; pageCount: number }>()
  if (materialIds.length === 0) return result

  const rows = await db
    .select({ materialId: chunks.materialId, page: chunks.page, content: chunks.content })
    .from(chunks)
    .where(and(eq(chunks.userId, userId), inArray(chunks.materialId, materialIds)))
    .orderBy(asc(chunks.materialId), asc(chunks.position))

  const byMaterial = new Map<string, Map<number, string[]>>()
  for (const row of rows) {
    if (row.page == null) continue
    const pages = byMaterial.get(row.materialId) ?? new Map<number, string[]>()
    pages.set(row.page, [...(pages.get(row.page) ?? []), row.content])
    byMaterial.set(row.materialId, pages)
  }

  for (const [materialId, pages] of byMaterial) {
    const sorted = [...pages.entries()].sort((a, b) => a[0] - b[0])
    result.set(materialId, {
      text: sorted.map(([page, parts]) => `<<<PAGINA ${page}>>>\n${parts.join('\n')}`).join('\n\n'),
      pageCount: sorted[sorted.length - 1][0],
    })
  }
  return result
}

export async function generateRoadmap(formData: FormData) {
  const userId = await getUserId()
  const subjectId = String(formData.get('subjectId') ?? '')

  let errorMessage: string | null = null

  try {
    const [subject] = await db
      .select()
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    if (!subject) throw new UserError('Materia no encontrada.')
    if (!subject.program?.trim()) {
      throw new UserError('Cargá primero el programa de la materia.')
    }

    const library = await db
      .select({ id: materials.id, title: materials.title, kind: materials.kind, content: materials.content })
      .from(materials)
      .where(and(eq(materials.subjectId, subjectId), eq(materials.userId, userId)))
      .orderBy(asc(materials.createdAt))

    const drafts = await draftTopics({
      subjectName: subject.name,
      program: subject.program,
      library: library.slice(0, 40).map((item) => ({
        title: item.title,
        kind: MATERIAL_KINDS[item.kind as MaterialKind] ?? 'Otro',
        excerpt: item.content.slice(0, 300),
      })),
    })
    if (drafts.length === 0) {
      throw new UserError('No pude identificar temas en el programa. Revisalo e intentá de nuevo.')
    }

    const keyToId = new Map(drafts.map((draft) => [draft.key, crypto.randomUUID()]))
    const prerequisitesByKey = sanitizePrerequisites(
      drafts.map((draft) => ({ id: draft.key, prerequisites: draft.prerequisites })),
    )

    const topicRows = drafts.map((draft, position) => ({
      id: keyToId.get(draft.key) as string,
      userId,
      subjectId,
      title: draft.title,
      summary: draft.summary,
      position,
      prerequisites: (prerequisitesByKey.get(draft.key) ?? []).map(
        (key) => keyToId.get(key) as string,
      ),
    }))

    const subtopicRows = drafts.flatMap((draft, topicPosition) =>
      draft.subtopics.map((title, position) => ({
        id: crypto.randomUUID(),
        userId,
        subjectId,
        topicId: topicRows[topicPosition].id,
        title,
        position,
        sources: [] as Source[],
      })),
    )

    const topicTitleById = new Map(topicRows.map((topic) => [topic.id, topic.title]))
    const catalog: CatalogEntry[] = subtopicRows.map((subtopic, index) => ({
      index,
      label: `${topicTitleById.get(subtopic.topicId)} › ${subtopic.title}`,
    }))

    const hasTheory = library.some((item) => !PRACTICE_KINDS.includes(item.kind as MaterialKind))
    const sourcesPerSubtopic = hasTheory
      ? await findStudySources(
          userId,
          subjectId,
          catalog.map((entry) => entry.label.replace(' › ', ': ')),
        ).catch(() => [] as Source[][])
      : []
    subtopicRows.forEach((subtopic, index) => {
      subtopic.sources = sourcesPerSubtopic[index] ?? []
    })

    const practiceMaterials = [
      ...library.filter((item) => item.kind === 'practica').slice(0, MAX_PRACTICE_GUIDES),
      ...library.filter((item) => item.kind === 'examen_anterior').slice(-MAX_EXAMS),
    ]
    const pagedContent = await loadPagedContent(
      userId,
      practiceMaterials.map((item) => item.id),
    )
    const extracted = await mapWithConcurrency(practiceMaterials, EXTRACTION_CONCURRENCY, (item) => {
      const paged = pagedContent.get(item.id)
      return extractExercises({
        title: item.title,
        content: paged?.text ?? item.content,
        pageCount: paged?.pageCount ?? null,
        catalog,
      })
        .then((exercises) => ({ materialId: item.id, exercises }))
        .catch(() => ({ materialId: item.id, exercises: [] as ExtractedExercise[] }))
    })

    const exerciseRows = extracted.flatMap(({ materialId, exercises }) =>
      exercises.flatMap((exercise, position) => {
        const subtopic = subtopicRows[exercise.subtopicIndex]
        if (!subtopic) return []
        return [
          {
            userId,
            subjectId,
            topicId: subtopic.topicId,
            subtopicId: subtopic.id,
            materialId,
            statement: exercise.statement,
            label: exercise.label,
            page: exercise.page,
            position,
          },
        ]
      }),
    )

    await db.transaction(async (tx) => {
      await tx
        .delete(practiceExercises)
        .where(
          and(eq(practiceExercises.subjectId, subjectId), eq(practiceExercises.userId, userId)),
        )
      await tx
        .delete(subtopics)
        .where(and(eq(subtopics.subjectId, subjectId), eq(subtopics.userId, userId)))
      await tx
        .delete(topics)
        .where(and(eq(topics.subjectId, subjectId), eq(topics.userId, userId)))

      await tx.insert(topics).values(topicRows)
      await tx.insert(subtopics).values(subtopicRows)
      if (exerciseRows.length > 0) await tx.insert(practiceExercises).values(exerciseRows)
    })
  } catch (error) {
    errorMessage = toUserMessage(error, 'No pude generar el roadmap. Intentá de nuevo.')
  }

  revalidatePath(`/materias/${subjectId}`)
  if (errorMessage) {
    redirect(`/materias/${subjectId}?error=${encodeURIComponent(errorMessage)}`)
  }
  redirect(`/materias/${subjectId}/roadmap`)
}

function assertStatus(status: unknown): asserts status is ProgressStatus {
  if (!isProgressStatus(status)) throw new Error('Estado inválido.')
}

export async function setTopicStatus(topicId: string, status: ProgressStatus) {
  const userId = await getUserId()
  assertStatus(status)

  await db.transaction(async (tx) => {
    await tx
      .update(topics)
      .set({ status })
      .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    await tx
      .update(subtopics)
      .set({ status })
      .where(and(eq(subtopics.topicId, topicId), eq(subtopics.userId, userId)))
  })
}

export async function setSubtopicStatus(
  subtopicId: string,
  status: ProgressStatus,
): Promise<ProgressStatus> {
  const userId = await getUserId()
  assertStatus(status)

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(subtopics)
      .set({ status })
      .where(and(eq(subtopics.id, subtopicId), eq(subtopics.userId, userId)))
      .returning({ topicId: subtopics.topicId })
    if (!updated) throw new Error('Subtema no encontrado.')

    const siblings = await tx
      .select({ status: subtopics.status })
      .from(subtopics)
      .where(and(eq(subtopics.topicId, updated.topicId), eq(subtopics.userId, userId)))

    const topicStatus = deriveTopicStatus(siblings.map((sibling) => sibling.status))
    await tx
      .update(topics)
      .set({ status: topicStatus })
      .where(and(eq(topics.id, updated.topicId), eq(topics.userId, userId)))
    return topicStatus
  })
}

export async function setExerciseDone(exerciseId: string, done: boolean) {
  const userId = await getUserId()
  await db
    .update(practiceExercises)
    .set({ done: Boolean(done) })
    .where(and(eq(practiceExercises.id, exerciseId), eq(practiceExercises.userId, userId)))
}
