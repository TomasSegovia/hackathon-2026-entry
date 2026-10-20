'use client'

import Link from 'next/link'
import { CheckCircle2, FileText, Lock } from 'lucide-react'
import { MathText } from '@/components/math-text'
import { cn } from '@/lib/utils'
import type { ExerciseData, ProgressStatus, TopicData } from '@/lib/types'
import { viewerHref } from '@/lib/viewer'

type Exam = {
  materialId: string
  title: string
  exercises: ExerciseData[]
  pendingTopics: TopicData[]
}

export function ExamsSection({
  subjectId,
  topics,
  topicStatus,
  exercises,
  onSelectTopic,
}: {
  subjectId: string
  topics: TopicData[]
  topicStatus: Map<string, ProgressStatus>
  exercises: ExerciseData[]
  onSelectTopic: (topicId: string) => void
}) {
  const topicById = new Map(topics.map((topic) => [topic.id, topic]))
  const exams = new Map<string, Exam>()

  for (const exercise of exercises) {
    if (exercise.materialKind !== 'examen_anterior' || !exercise.materialId) continue
    const exam = exams.get(exercise.materialId) ?? {
      materialId: exercise.materialId,
      title: exercise.materialTitle ?? 'Examen',
      exercises: [],
      pendingTopics: [],
    }
    exam.exercises.push(exercise)
    exams.set(exercise.materialId, exam)
  }
  if (exams.size === 0) return null

  for (const exam of exams.values()) {
    const pending = new Set(
      exam.exercises
        .map((exercise) => exercise.topicId)
        .filter((topicId) => topicStatus.get(topicId) !== 'done'),
    )
    exam.pendingTopics = [...pending]
      .map((topicId) => topicById.get(topicId))
      .filter((topic): topic is TopicData => Boolean(topic))
  }

  const sorted = [...exams.values()].sort(
    (a, b) => a.pendingTopics.length - b.pendingTopics.length || a.title.localeCompare(b.title),
  )
  const ready = sorted.filter((exam) => exam.pendingTopics.length === 0).length

  return (
    <section aria-labelledby="exams-title" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="exams-title" className="text-sm font-semibold">
          Exámenes anteriores
        </h2>
        <p className="text-xs text-muted-foreground">
          {ready} de {sorted.length} listos para hacer completos
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Sus ejercicios también aparecen en cada tema. Un examen queda listo cuando terminaste todos
        los temas que toma.
      </p>
      <ul className="flex flex-col gap-2">
        {sorted.map((exam) => {
          const isReady = exam.pendingTopics.length === 0
          const done = exam.exercises.filter((exercise) => exercise.done).length
          return (
            <li key={exam.materialId}>
              <details className="group rounded-lg border bg-background">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                  {isReady ? (
                    <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 text-sm font-medium">{exam.title}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      isReady ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {isReady
                      ? 'Listo para hacer'
                      : `Faltan ${exam.pendingTopics.length} ${exam.pendingTopics.length === 1 ? 'tema' : 'temas'}`}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {done}/{exam.exercises.length} ejercicios
                  </span>
                </summary>
                <div className="flex flex-col gap-3 border-t px-3 py-3">
                  {!isReady && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Te falta:</span>
                      {exam.pendingTopics.map((topic) => (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => onSelectTopic(topic.id)}
                          className="rounded-full border px-2 py-0.5 hover:border-primary/60"
                        >
                          {topic.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <ol className="flex flex-col gap-2">
                    {exam.exercises.map((exercise) => (
                      <li key={exercise.id} className="text-sm">
                        <p className="text-xs text-muted-foreground">
                          {exercise.label && (
                            <span className="font-medium text-foreground">{exercise.label} · </span>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectTopic(exercise.topicId)}
                            className="underline-offset-2 hover:underline"
                          >
                            {topicById.get(exercise.topicId)?.title ?? 'Tema'}
                          </button>
                          {exercise.done && ' · resuelto'}
                        </p>
                        <p className="line-clamp-2 leading-relaxed">
                          <MathText text={exercise.statement} />
                        </p>
                      </li>
                    ))}
                  </ol>
                  <Link
                    href={viewerHref(subjectId, exam.materialId)}
                    target="_blank"
                    className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
                  >
                    <FileText className="size-3.5" aria-hidden="true" />
                    Abrir el examen
                    <span className="sr-only"> (se abre en una pestaña nueva)</span>
                  </Link>
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
