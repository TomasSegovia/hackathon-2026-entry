import { createExercise } from '@/app/actions/exercises'
import { selectClassName } from '@/components/material-form'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EXERCISE_KINDS } from '@/lib/types'

export function ExerciseForm({ subjectId }: { subjectId: string }) {
  return (
    <form action={createExercise} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="exercise-title">Título</Label>
          <Input id="exercise-title" name="title" placeholder="Ej: Práctica 4 - Límites" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="exercise-kind">Tipo</Label>
          <select
            id="exercise-kind"
            name="kind"
            defaultValue="ejercicio"
            className={selectClassName}
          >
            {Object.entries(EXERCISE_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="exercise-file">Archivo (PDF o texto)</Label>
        <Input
          id="exercise-file"
          name="file"
          type="file"
          accept=".pdf,.txt,.md,.markdown,.tex,application/pdf,text/*"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="exercise-text">O pegá la consigna</Label>
        <Textarea
          id="exercise-text"
          name="text"
          rows={8}
          placeholder="Pegá el enunciado completo. Si tiene varios puntos, los separamos automáticamente."
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Analizando consigna…">Buscar fuentes</SubmitButton>
      </div>
    </form>
  )
}
