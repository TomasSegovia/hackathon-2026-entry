import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StepSection({
  number,
  title,
  description,
  done,
  children,
}: {
  number: number
  title: string
  description: string
  done: boolean
  children: React.ReactNode
}) {
  const headingId = `step-${number}`

  return (
    <section aria-labelledby={headingId} className="flex gap-4">
      <div
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
          done ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
        )}
      >
        {done ? <Check className="size-4" aria-label="Completado" /> : number}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div>
          <h2 id={headingId} className="text-xl font-semibold">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </section>
  )
}
