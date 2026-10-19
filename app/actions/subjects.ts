'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import {
  chunks,
  exerciseItems,
  exercises,
  materials,
  subjects,
} from '@/lib/db/schema'
import { getUserId } from '@/lib/session'

export async function createSubject(formData: FormData) {
  const userId = await getUserId()
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  if (!name) throw new Error('El nombre de la materia es obligatorio.')

  const [subject] = await db
    .insert(subjects)
    .values({ userId, name: name.slice(0, 120), description: description.slice(0, 300) || null })
    .returning({ id: subjects.id })

  revalidatePath('/materias')
  redirect(`/materias/${subject.id}`)
}

export async function deleteSubject(formData: FormData) {
  const userId = await getUserId()
  const subjectId = String(formData.get('subjectId') ?? '')

  await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: exercises.id })
      .from(exercises)
      .where(and(eq(exercises.subjectId, subjectId), eq(exercises.userId, userId)))

    for (const { id } of owned) {
      await tx
        .delete(exerciseItems)
        .where(and(eq(exerciseItems.exerciseId, id), eq(exerciseItems.userId, userId)))
    }
    await tx
      .delete(exercises)
      .where(and(eq(exercises.subjectId, subjectId), eq(exercises.userId, userId)))
    await tx
      .delete(chunks)
      .where(and(eq(chunks.subjectId, subjectId), eq(chunks.userId, userId)))
    await tx
      .delete(materials)
      .where(and(eq(materials.subjectId, subjectId), eq(materials.userId, userId)))
    await tx
      .delete(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
  })

  revalidatePath('/materias')
  redirect('/materias')
}
