'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { subjects } from '@/lib/db/schema'
import { UserError, toUserMessage } from '@/lib/errors'
import { getOverview } from '@/lib/fceia/client'
import { importPreset, type ImportOptions } from '@/lib/fceia/import'
import { getUserId } from '@/lib/session'

function readFceiaSubjectId(formData: FormData) {
  const value = Number(formData.get('fceiaSubjectId'))
  if (!Number.isInteger(value) || value <= 0) {
    throw new UserError('Elegí una carrera y una materia de la lista.')
  }
  return value
}

function readOptions(formData: FormData): ImportOptions {
  const options = {
    program: formData.get('program') === 'on',
    materials: formData.get('materials') === 'on',
    exams: formData.get('exams') === 'on',
    bibliography: formData.get('bibliography') === 'on',
  }
  if (!Object.values(options).some(Boolean)) {
    throw new UserError('Elegí al menos un tipo de contenido para importar.')
  }
  return options
}

export async function createSubjectFromPreset(formData: FormData) {
  const userId = await getUserId()
  let subjectId: string | null = null
  let notice: string | null = null
  let errorMessage: string | null = null

  try {
    const fceiaSubjectId = readFceiaSubjectId(formData)
    const include = readOptions(formData)

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
    subjectId = subject.id

    notice = await importPreset({ userId, subjectId, fceiaSubjectId, include })
  } catch (error) {
    errorMessage = toUserMessage(error, 'No pude importar la materia desde la FCEIA. Intentá de nuevo.')
  }

  revalidatePath('/materias')
  if (!subjectId) redirect(`/materias?error=${encodeURIComponent(errorMessage ?? '')}`)

  revalidatePath(`/materias/${subjectId}`)
  const query = errorMessage
    ? `error=${encodeURIComponent(errorMessage)}`
    : `notice=${encodeURIComponent(notice ?? '')}`
  redirect(`/materias/${subjectId}?${query}`)
}

export async function importFromPreset(formData: FormData) {
  const userId = await getUserId()
  const subjectId = String(formData.get('subjectId') ?? '')
  let notice: string | null = null
  let errorMessage: string | null = null

  try {
    const fceiaSubjectId = readFceiaSubjectId(formData)
    const include = readOptions(formData)

    const [subject] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    if (!subject) throw new UserError('Materia no encontrada.')

    notice = await importPreset({ userId, subjectId, fceiaSubjectId, include })
  } catch (error) {
    errorMessage = toUserMessage(error, 'No pude importar desde la FCEIA. Intentá de nuevo.')
  }

  revalidatePath(`/materias/${subjectId}`)
  const query = errorMessage
    ? `error=${encodeURIComponent(errorMessage)}`
    : `notice=${encodeURIComponent(notice ?? '')}`
  redirect(`/materias/${subjectId}?${query}`)
}
