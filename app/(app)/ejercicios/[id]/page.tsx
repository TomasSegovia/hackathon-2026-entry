import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, asc, eq } from 'drizzle-orm'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { deleteExercise } from '@/app/actions/exercises'
import { ItemCard } from '@/components/item-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { exerciseItems, exercises, subjects } from '@/lib/db/schema'
import { requireUser } from '@/lib/session'
import { EXERCISE_KINDS } from '@/lib/types'

export const maxDuration = 60

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()

  const [row] = await db
    .select({
      exercise: exercises,
      subjectName: subjects.name,
    })
    .from(exercises)
    .innerJoin(subjects, eq(subjects.id, exercises.subjectId))
    .where(and(eq(exercises.id, id), eq(exercises.userId, user.id)))
  if (!row) notFound()

  const items = await db
    .select()
    .from(exerciseItems)
    .where(and(eq(exerciseItems.exerciseId, id), eq(exerciseItems.userId, user.id)))
    .orderBy(asc(exerciseItems.position))

  const { exercise } = row
  const withoutMaterial = items.filter((item) => item.status === 'not_found').length

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href={`/materias/${exercise.subjectId}`}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {row.subjectName}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Badge variant="secondary" className="w-fit">
            {EXERCISE_KINDS[exercise.kind as keyof typeof EXERCISE_KINDS] ?? 'Ejercicio'}
          </Badge>
          <h1 className="text-3xl font-semibold text-balance">{exercise.title}</h1>
          {exercise.status === 'done' && (
            <p className="text-muted-foreground">
              {items.length} {items.length === 1 ? 'punto detectado' : 'puntos detectados'}
              {withoutMaterial > 0 && `, ${withoutMaterial} sin material en tu biblioteca`}.
            </p>
          )}
        </div>
        <form action={deleteExercise}>
          <input type="hidden" name="exerciseId" value={exercise.id} />
          <input type="hidden" name="subjectId" value={exercise.subjectId} />
          <Button type="submit" variant="ghost" size="sm">
            <Trash2 aria-hidden="true" />
            Eliminar
          </Button>
        </form>
      </div>

      {exercise.status === 'error' ? (
        <div role="alert" className="rounded-xl border border-destructive/40 p-5">
          <p className="font-medium">No pudimos analizar esta consigna.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Eliminala y volvé a subirla. Si es un PDF escaneado, pegá el texto manualmente. Si el
            problema persiste, verificá que AI Gateway tenga una tarjeta registrada en tu cuenta de
            Vercel.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
