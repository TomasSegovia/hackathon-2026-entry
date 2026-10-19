'use client'

import { cn } from '@/lib/utils'
import { PROGRESS_STATUSES, STATUS_LABELS, type ProgressStatus } from '@/lib/types'

const ACTIVE_STYLES: Record<ProgressStatus, string> = {
  pending: 'bg-card text-foreground shadow-sm',
  learning: 'bg-accent text-accent-foreground shadow-sm',
  done: 'bg-primary text-primary-foreground shadow-sm',
}

export function StatusControl({
  value,
  label,
  onChange,
}: {
  value: ProgressStatus
  label: string
  onChange: (status: ProgressStatus) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 rounded-lg border bg-secondary/70 p-0.5"
    >
      {PROGRESS_STATUSES.map((status) => {
        const active = value === status
        return (
          <button
            key={status}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => !active && onChange(status)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? ACTIVE_STYLES[status] : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {STATUS_LABELS[status]}
          </button>
        )
      })}
    </div>
  )
}
