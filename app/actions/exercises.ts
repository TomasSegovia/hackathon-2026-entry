'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { searchWebForTopic, splitExercise } from '@/lib/ai/analyze'
import { classify, findSourcesForQueries } from '@/lib/ai/retrieve'
import { extractTextFromFile } from '@/lib/ai/text'
import { db } from '@/lib/db'
import { exerciseItems, exercises, subjects } from '@/lib/db/schema'
import { getUserId } from '@/lib/session'
import { isExerciseKind } from '@/lib/types'

export async function createExercise(formData: FormData) {
  const userId = await getUserId()
  const subjectId = String(formData.get('subjectId') ?? '')
  const rawKind = String(formData.get('kind') ?? 'ejercicio')
  const kind = isExerciseKind(rawKind) ? rawKind : 'ejercicio'
  const pastedText = String(formData.get('text') ?? '').trim()
  const file = formData.get('file')
  const hasFile = file instanceof File && file.size > 0

  const [subject] = await db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
  if (!subject) throw new Error('Materia no encontrada.')

  const content = hasFile ? await extractTextFromFile(file) : pastedText
  if (!content) {
    throw new Error('No pude extraer texto. Pegá la consigna o subí un PDF con texto seleccionable.')
  }

  const title =
    String(formData.get('title') ?? '').trim() ||
    (hasFile ? file.name.replace(/\.[^.]+$/, '') : content.slice(0, 60))

  const [exercise] = await db
    .insert(exercises)
    .values({
      userId,
      subjectId,
      title: title.slice(0, 160),
      kind,
      content,
      status: 'analyzing',
    })
    .returning({ id: exercises.id })

  try {
    const items = await splitExercise(content, subject.name)
    if (items.length === 0) throw new Error('No se detectaron consignas.')

    const sourcesPerItem = await findSourcesForQueries(
      userId,
      subjectId,
      items.map((item) => `${item.topic}. ${item.statement}`),
    )

    await db.insert(exerciseItems).values(
      items.map((item, position) => ({
        userId,
        exerciseId: exercise.id,
        position,
        statement: item.statement,
        topic: item.topic,
        status: classify(sourcesPerItem[position]),
        sources: sourcesPerItem[position],
      })),
    )

    await db
      .update(exercises)
      .set({ status: 'done' })
      .where(and(eq(exercises.id, exercise.id), eq(exercises.userId, userId)))
  } catch (error) {
    console.error('[exercise] analysis failed', error)
    await db
      .update(exercises)
      .set({ status: 'error' })
      .where(and(eq(exercises.id, exercise.id), eq(exercises.userId, userId)))
  }

  revalidatePath(`/materias/${subjectId}`)
  redirect(`/ejercicios/${exercise.id}`)
}

export async function searchWebForItem(formData: FormData) {
  const userId = await getUserId()
  const itemId = String(formData.get('itemId') ?? '')

  const [row] = await db
    .select({
      item: exerciseItems,
      exerciseId: exercises.id,
      subjectName: subjects.name,
    })
    .from(exerciseItems)
    .innerJoin(exercises, eq(exercises.id, exerciseItems.exerciseId))
    .innerJoin(subjects, eq(subjects.id, exercises.subjectId))
    .where(and(eq(exerciseItems.id, itemId), eq(exerciseItems.userId, userId)))
  if (!row) throw new Error('Punto no encontrado.')

  try {
    const webSources = await searchWebForTopic(
      row.item.topic,
      row.item.statement,
      row.subjectName,
    )
    await db
      .update(exerciseItems)
      .set({ webSources, webStatus: webSources.length > 0 ? 'done' : 'error' })
      .where(and(eq(exerciseItems.id, itemId), eq(exerciseItems.userId, userId)))
  } catch (error) {
    console.error('[exercise] web search failed', error)
    await db
      .update(exerciseItems)
      .set({ webStatus: 'error' })
      .where(and(eq(exerciseItems.id, itemId), eq(exerciseItems.userId, userId)))
  }

  revalidatePath(`/ejercicios/${row.exerciseId}`)
}

export async function declineWebSearch(formData: FormData) {
  const userId = await getUserId()
  const itemId = String(formData.get('itemId') ?? '')
  const exerciseId = String(formData.get('exerciseId') ?? '')

  await db
    .update(exerciseItems)
    .set({ webStatus: 'declined' })
    .where(and(eq(exerciseItems.id, itemId), eq(exerciseItems.userId, userId)))

  revalidatePath(`/ejercicios/${exerciseId}`)
}

export async function deleteExercise(formData: FormData) {
  const userId = await getUserId()
  const exerciseId = String(formData.get('exerciseId') ?? '')
  const subjectId = String(formData.get('subjectId') ?? '')

  await db.transaction(async (tx) => {
    await tx
      .delete(exerciseItems)
      .where(and(eq(exerciseItems.exerciseId, exerciseId), eq(exerciseItems.userId, userId)))
    await tx
      .delete(exercises)
      .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)))
  })

  revalidatePath(`/materias/${subjectId}`)
  redirect(`/materias/${subjectId}`)
}
