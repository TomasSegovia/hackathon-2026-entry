import { Sparkles } from 'lucide-react'
import { generateRoadmap } from '@/app/actions/roadmap'
import { SubmitButton } from '@/components/submit-button'

export function GenerateRoadmapForm({
  subjectId,
  label = 'Generar roadmap',
  variant = 'default',
}: {
  subjectId: string
  label?: string
  variant?: 'default' | 'outline'
}) {
  return (
    <form action={generateRoadmap}>
      <input type="hidden" name="subjectId" value={subjectId} />
      <SubmitButton variant={variant} pendingLabel="Generando roadmap… puede tardar un minuto">
        <Sparkles aria-hidden="true" />
        {label}
      </SubmitButton>
    </form>
  )
}
