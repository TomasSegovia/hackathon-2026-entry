'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { UserError, toUserMessage } from '@/lib/errors'
import { db } from '@/lib/db'
import { chunks, materials, subjects } from '@/lib/db/schema'
import { embedTexts } from '@/lib/ai/retrieve'
import { chunkText, extractTextFromFile } from '@/lib/ai/text'
import { getUserId } from '@/lib/session'
import { isMaterialKind } from '@/lib/types'

export async function addMaterial(formData: FormData) {
  const userId = await getUserId()
  const subjectId = String(formData.get('subjectId') ?? '')
  const rawKind = String(formData.get('kind') ?? 'apunte')
  const kind = isMaterialKind(rawKind) ? rawKind : 'otro'
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

    const content = hasFile ? await extractTextFromFile(file) : pastedText
    if (!content) {
      throw new UserError(
        'No pude extraer texto. Pegá el contenido o subí un PDF con texto seleccionable.',
      )
    }

    const title =
      String(formData.get('title') ?? '').trim() ||
      (hasFile ? file.name.replace(/\.[^.]+$/, '') : 'Sin título')

    const pieces = chunkText(content)
    if (pieces.length === 0) throw new UserError('El material es demasiado corto para indexarlo.')
    const embeddings = await embedTexts(pieces)

    await db.transaction(async (tx) => {
      const [material] = await tx
        .insert(materials)
        .values({
          userId,
          subjectId,
          title: title.slice(0, 160),
          kind,
          content,
          sourceName: hasFile ? file.name : null,
          chunkCount: pieces.length,
        })
        .returning({ id: materials.id })

      await tx.insert(chunks).values(
        pieces.map((piece, position) => ({
          userId,
          subjectId,
          materialId: material.id,
          position,
          content: piece,
          embedding: embeddings[position],
        })),
      )
    })
  } catch (error) {
    errorMessage = toUserMessage(error, 'No pude indexar el material. Intentá de nuevo.')
  }

  revalidatePath(`/materias/${subjectId}`)
  if (errorMessage) {
    redirect(`/materias/${subjectId}?error=${encodeURIComponent(errorMessage)}`)
  }
  redirect(`/materias/${subjectId}`)
}

export async function deleteMaterial(formData: FormData) {
  const userId = await getUserId()
  const materialId = String(formData.get('materialId') ?? '')
  const subjectId = String(formData.get('subjectId') ?? '')

  await db.transaction(async (tx) => {
    await tx
      .delete(chunks)
      .where(and(eq(chunks.materialId, materialId), eq(chunks.userId, userId)))
    await tx
      .delete(materials)
      .where(and(eq(materials.id, materialId), eq(materials.userId, userId)))
  })

  revalidatePath(`/materias/${subjectId}`)
}
