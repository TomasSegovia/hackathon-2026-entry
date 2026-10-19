'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { subjects } from '@/lib/db/schema'
import { UserError, toUserMessage } from '@/lib/errors'
import { getOverview } from '@/lib/fceia/client'
import { importBatch, type BatchResult } from '@/lib/fceia/import'
import { getUserId } from '@/lib/session'

export type PresetBatchInput = {
  subjectId: string
  fceiaSubjectId: number
  include: { program: boolean; materials: boolean; exams: boolean }
  bibliographyIds: number[]
  bookIds: number[]
  skipKeys: string[]
  initial: boolean
  refresh?: boolean
}

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string }

function validId(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function idList(value: unknown) {
  return Array.isArray(value) ? value.filter(validId).slice(0, 200) : []
}

export async function createPresetSubject(
  fceiaSubjectId: number,
): Promise<ActionResult<{ subjectId: string }>> {
  try {
    const userId = await getUserId()
    if (!validId(fceiaSubjectId)) throw new UserError('Elegí una carrera y una materia de la lista.')

    const overview = await getOverview(fceiaSubjectId)
    const [subject] = await db
      .insert(subjects)
      .values({
        userId,
        name: overview.name.slice(0, 120),
        description: overview.code ? `Plan FCEIA · ${overview.code}` : null,
        fceiaSubjectId,
      })
      .returning({ id: subjects.id })

    revalidatePath('/materias')
    return { ok: true, subjectId: subject.id }
  } catch (error) {
    return {
      ok: false,
      error: toUserMessage(error, 'No pude crear la materia desde la FCEIA. Intentá de nuevo.'),
    }
  }
}

export async function importPresetBatch(
  input: PresetBatchInput,
): Promise<ActionResult<{ result: BatchResult }>> {
  try {
    const userId = await getUserId()
    if (!validId(input.fceiaSubjectId)) throw new UserError('Materia de la FCEIA inválida.')

    const [subject] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, String(input.subjectId)), eq(subjects.userId, userId)))
    if (!subject) throw new UserError('Materia no encontrada.')

    const result = await importBatch({
      userId,
      subjectId: subject.id,
      fceiaSubjectId: input.fceiaSubjectId,
      include: {
        program: Boolean(input.include?.program),
        materials: Boolean(input.include?.materials),
        exams: Boolean(input.include?.exams),
      },
      bibliographyIds: idList(input.bibliographyIds),
      bookIds: idList(input.bookIds),
      skipKeys: Array.isArray(input.skipKeys)
        ? input.skipKeys.filter((key) => typeof key === 'string').slice(0, 500)
        : [],
      initial: Boolean(input.initial),
      refresh: Boolean(input.refresh),
    })
    return { ok: true, result }
  } catch (error) {
    return {
      ok: false,
      error: toUserMessage(error, 'No pude importar desde la FCEIA. Intentá de nuevo.'),
    }
  }
}
