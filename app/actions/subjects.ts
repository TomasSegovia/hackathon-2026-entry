'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { extractTextFromFile } from '@/lib/ai/text'
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
import { getUserId } from '@/lib/session'

const MAX_PROGRAM_LENGTH = 30000

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

export async function saveProgram(formData: FormData) {
  const userId = await getUserId()
  const subjectId = String(formData.get('subjectId') ?? '')
  const pastedText = String(formData.get('text') ?? '').trim()
  const file = formData.get('file')
  const hasFile = file instanceof File && file.size > 0

  let errorMessage: string | null = null

  try {
    const [subject] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    if (!subject) throw new UserError('Materia no encontrada.')

    let program = pastedText
    if (hasFile) {
      try {
        program = await extractTextFromFile(file)
      } catch (error) {
        throw new UserError(
          error instanceof Error ? error.message : 'No pude leer el archivo del programa.',
        )
      }
    }
    if (program.length < 20) {
      throw new UserError('No encontré texto en el programa. Pegalo o subí un PDF con texto.')
    }

    await db
      .update(subjects)
      .set({ program: program.slice(0, MAX_PROGRAM_LENGTH) })
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
  } catch (error) {
    errorMessage = toUserMessage(error, 'No pude guardar el programa. Intentá de nuevo.')
  }

  revalidatePath(`/materias/${subjectId}`)
  if (errorMessage) {
    redirect(`/materias/${subjectId}?error=${encodeURIComponent(errorMessage)}`)
  }
  redirect(`/materias/${subjectId}`)
}

export async function deleteSubject(formData: FormData) {
  const userId = await getUserId()
  const subjectId = String(formData.get('subjectId') ?? '')

  await db.transaction(async (tx) => {
    await tx
      .delete(practiceExercises)
      .where(and(eq(practiceExercises.subjectId, subjectId), eq(practiceExercises.userId, userId)))
    await tx
      .delete(subtopics)
      .where(and(eq(subtopics.subjectId, subjectId), eq(subtopics.userId, userId)))
    await tx
      .delete(topics)
      .where(and(eq(topics.subjectId, subjectId), eq(topics.userId, userId)))
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
