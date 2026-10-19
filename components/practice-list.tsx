'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { setExerciseDone } from '@/app/actions/roadmap'
import { ExerciseRow } from '@/components/exercise-row'
import { cn } from '@/lib/utils'
import type { ExerciseData } from '@/lib/types'

export type PracticeExercise = ExerciseData & { topicTitle: string; subtopicTitle: string }

export function PracticeList({
  topics,
  exercises: initialExercises,
  lockedCount,
  roadmapHref,
}: {
  topics: { id: string; title: string }[]
  exercises: PracticeExercise[]
  lockedCount: number
  roadmapHref: string
}) {
  const [exercises, setExercises] = useState(initialExercises)
  const [filter, setFilter] = useState<string>('all')
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const toggle = (exerciseId: string, done: boolean) => {
    const previous = exercises
    setError(null)
    setExercises((current) =>
      current.map((exercise) => (exercise.id === exerciseId ? { ...exercise, done } : exercise)),
    )
    startTransition(async () => {
      try {
        await setExerciseDone(exerciseId, done)
      } catch {
        setExercises(previous)
        setError('No se pudo guardar el cambio. Intentá de nuevo.')
      }
    })
  }

  const topicsWithExercises = topics.filter((topic) =>
    exercises.some((exercise) => exercise.topicId === topic.id),
  )
  const visibleTopics = topicsWithExercises.filter((topic) => filter === 'all' || topic.id === filter)
  const doneCount = exercises.filter((exercise) => exercise.done).length

  if (exercises.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-dashed p-6 text-sm">
        <p className="font-medium">Todavía no hay ejercicios habilitados.</p>
        <p className="text-muted-foreground">
          Los ejercicios aparecen a medida que marcás subtemas como vistos en el roadmap.
          {lockedCount > 0 && ` Hay ${lockedCount} esperando.`}
        </p>
        <Link href={roadmapHref} className="w-fit font-medium text-primary underline-offset-2 hover:underline">
          Volver al roadmap
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {doneCount} de {exercises.length} resueltos
          {lockedCount > 0 && ` · ${lockedCount} más se habilitan al avanzar`}
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Filtrar por tema">
          {[{ id: 'all', title: 'Todos' }, ...topicsWithExercises].map((topic) => (
            <li key={topic.id}>
              <button
                type="button"
                aria-pressed={filter === topic.id}
                onClick={() => setFilter(topic.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  filter === topic.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:border-primary/60',
                )}
              >
                {topic.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">
          {error}
        </p>
      )}

      {visibleTopics.map((topic) => (
        <section key={topic.id} aria-labelledby={`practice-${topic.id}`} className="flex flex-col gap-2">
          <h2 id={`practice-${topic.id}`} className="text-lg font-semibold">
            {topic.title}
          </h2>
          <ul className="flex flex-col gap-2">
            {exercises
              .filter((exercise) => exercise.topicId === topic.id)
              .map((exercise) => (
                <ExerciseRow
                  key={exercise.id}
                  exercise={exercise}
                  context={exercise.subtopicTitle}
                  onChange={(done) => toggle(exercise.id, done)}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
