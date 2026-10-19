'use client'

import { useState } from 'react'
import { MathText } from '@/components/math-text'
import { stripMath } from '@/lib/math'
import { cn } from '@/lib/utils'
import type { ExerciseData } from '@/lib/types'

const LONG_STATEMENT = 220

export function ExerciseRow({
  exercise,
  context,
  onChange,
}: {
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
      </div>
    </li>
  )
}
