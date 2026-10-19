import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { ExerciseForm } from '@/components/exercise-form'
import { db } from '@/lib/db'
import { subjects } from '@/lib/db/schema'
import { requireUser } from '@/lib/session'

export const maxDuration = 120

export const metadata = { title: 'Nuevo ejercicio - Cuaderno' }

export default async function NewExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()

  const [subject] = await db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, id), eq(subjects.userId, user.id)))
  if (!subject) notFound()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link
        href={`/materias/${subject.id}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {subject.name}
      </Link>
      <div>
        <h1 className="text-3xl font-semibold">Subir una consigna</h1>
        <p className="mt-1 text-muted-foreground">
          Buscamos la teoría relacionada solo dentro de la biblioteca de esta materia.
        </p>
      </div>
      <ExerciseForm subjectId={subject.id} />
    </div>
  )
}
