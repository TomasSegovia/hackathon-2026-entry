'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'

type Career = { id: number; name: string; level: string }
type PresetSubject = { id: number; name: string; year: number | null; term: number | null; kind: string }

const selectClassName =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

const CONTENT_OPTIONS = [
  { name: 'program', label: 'Programa oficial', hint: 'Base del roadmap' },
  { name: 'materials', label: 'Material de estudio', hint: 'Apuntes y prácticas' },
  { name: 'exams', label: 'Exámenes anteriores', hint: 'Parciales y finales' },
  { name: 'bibliography', label: 'Bibliografía', hint: 'Libros de la cátedra' },
] as const

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('No pude consultar la FCEIA.')
  return response.json()
}

function termLabel(subject: PresetSubject) {
  if (!subject.year) return subject.kind === 'electiva' ? 'Electiva' : 'Sin año'
  return `${subject.year}° año`
}

export function FceiaPicker({
  action,
  subjectId,
  submitLabel,
  pendingLabel,
}: {
  action: (formData: FormData) => Promise<void>
  subjectId?: string
  submitLabel: string
  pendingLabel: string
}) {
  const [careerId, setCareerId] = useState('')
  const [fceiaSubjectId, setFceiaSubjectId] = useState('')

  const careers = useSWR<Career[]>('/api/fceia/careers', fetchJson)
  const subjects = useSWR<PresetSubject[]>(
    careerId ? `/api/fceia/subjects?careerId=${careerId}` : null,
    fetchJson,
  )

  const sortedSubjects = [...(subjects.data ?? [])].sort(
    (a, b) => (a.year ?? 99) - (b.year ?? 99) || (a.term ?? 0) - (b.term ?? 0) || a.name.localeCompare(b.name),
  )

  return (
    <form action={action} className="flex flex-col gap-5 rounded-xl border bg-card p-5">
      {subjectId && <input type="hidden" name="subjectId" value={subjectId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fceia-career">Carrera</Label>
          <select
            id="fceia-career"
            value={careerId}
            disabled={careers.isLoading}
            onChange={(event) => {
              setCareerId(event.target.value)
              setFceiaSubjectId('')
            }}
            className={selectClassName}
          >
            <option value="">{careers.isLoading ? 'Cargando carreras…' : 'Elegí una carrera'}</option>
            {careers.data?.map((career) => (
              <option key={career.id} value={career.id}>
                {career.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="fceia-subject">Materia</Label>
          <select
            id="fceia-subject"
            name="fceiaSubjectId"
            value={fceiaSubjectId}
            disabled={!careerId || subjects.isLoading}
            onChange={(event) => setFceiaSubjectId(event.target.value)}
            className={selectClassName}
            required
          >
            <option value="">
              {!careerId
                ? 'Primero elegí la carrera'
                : subjects.isLoading
                  ? 'Cargando materias…'
                  : 'Elegí una materia'}
            </option>
            {sortedSubjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name} · {termLabel(subject)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(careers.error || subjects.error) && (
        <p role="alert" className="text-sm text-destructive">
          No pude consultar la FCEIA en este momento. Probá de nuevo en unos minutos.
        </p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">Qué importar</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONTENT_OPTIONS.map((option) => (
            <label
              key={option.name}
              className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 has-[:checked]:border-primary/60"
            >
              <input
                type="checkbox"
                name={option.name}
                defaultChecked
                className="mt-1 size-4 accent-primary"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <div>
          <SubmitButton pendingLabel={pendingLabel} disabled={!fceiaSubjectId}>
            {submitLabel}
          </SubmitButton>
        </div>
        <p className="text-xs text-muted-foreground">
          Se importan hasta 12 documentos por vez para indexarlos con calidad. Si la materia tiene
          más, repetí la importación y continúa donde quedó.
        </p>
      </div>
    </form>
  )
}
