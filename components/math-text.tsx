'use client'

import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { cn } from '@/lib/utils'
import { splitMath } from '@/lib/math'

function renderFormula(source: string, displayMode: boolean) {
  return katex.renderToString(source, {
    displayMode,
    throwOnError: false,
    strict: 'ignore',
    trust: false,
    output: 'htmlAndMathml',
  })
}

/** Renders text that may contain LaTeX formulas written between $…$ or $$…$$. */
export function MathText({ text, className }: { text: string; className?: string }) {
  const segments = useMemo(() => splitMath(text), [text])

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') return segment.value
        const display = segment.type === 'display'
        return (
          <span
            key={index}
            className={cn(display && 'my-2 block max-w-full overflow-x-auto overflow-y-hidden')}
            dangerouslySetInnerHTML={{ __html: renderFormula(segment.value, display) }}
          />
        )
      })}
    </span>
  )
}
