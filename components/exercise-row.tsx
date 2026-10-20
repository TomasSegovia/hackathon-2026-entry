'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { MathText } from '@/components/math-text'
import { stripMath } from '@/lib/math'
import { cn } from '@/lib/utils'
import { MATERIAL_KINDS, type ExerciseData } from '@/lib/types'
import { viewerHref } from '@/lib/viewer'

const LONG_STATEMENT = 220

function ExerciseOrigin({ subjectId, exercise }: { subjectId: string; exercise: ExerciseData }) {
  if (!exercise.materialId || !exercise.materialTitle) return null
  const kind = MATERIAL_KINDS[exercise.materialKind as keyof typeof MATERIAL_KINDS]

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
      <p className="min-w-0">
        {exercise.label && (
          <span className="font-medium text-foreground">{exercise.label} · </span>
        )}
        {exercise.materialTitle}
        {kind && <span> ({kind})</span>}
        {exercise.page && <span> · pág. {exercise.page}</span>}
      </p>
      <Link
        href={viewerHref(subjectId, exercise.materialId, exercise.page ? [exercise.page] : [])}
        target="_blank"
        className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
      >
        <FileText className="size-3.5" aria-hidden="true" />
        Ver en el documento
        <span className="sr-only"> (se abre en una pestaña nueva)</span>
      </Link>
    </div>
  )
}

export function ExerciseRow({
  subjectId,
  exercise,
  context,
  onChange,
}: {
  subjectId: string
  exercise: ExerciseData
  context: string
  onChange: (done: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = exercise.statement.length > LONG_STATEMENT

  return (
    <li className="flex gap-3 rounded-lg border bg-card p-3">
      <input
        type="checkbox"
        checked={exercise.done}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={`Marcar como resuelto: ${stripMath(exercise.statement).slice(0, 60)}`}
        className="mt-1 size-4 shrink-0 accent-primary"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          <MathText text={context} />
        </p>
        <p
          className={cn(
            'mt-1 text-sm leading-relaxed whitespace-pre-line',
            !expanded && isLong && 'line-clamp-3',
            exercise.done && 'text-muted-foreground line-through decoration-1',
          )}
        >
          <MathText text={exercise.statement} />
        </p>
        {isLong && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="mt-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {expanded ? 'Ver menos' : 'Ver completo'}
          </button>
        )}
        <ExerciseOrigin subjectId={subjectId} exercise={exercise} />
      </div>
    </li>
  )
}
