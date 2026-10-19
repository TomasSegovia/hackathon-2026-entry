'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { AlertTriangle, LoaderCircle } from 'lucide-react'
import { createPresetSubject, importPresetBatch } from '@/app/actions/fceia'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatBytes, type BookCatalog, type BookFile } from '@/lib/fceia/types'

type Career = { id: number; name: string; level: string }
type PresetSubject = { id: number; name: string; year: number | null; term: number | null; kind: string }
type Progress = { done: number; total: number | null }
type Include = { program: boolean; materials: boolean; exams: boolean }

const MAX_BATCHES = 120
const BATCH_ATTEMPTS = 3

const selectClassName =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50'

const CONTENT_OPTIONS: { name: keyof Include; label: string; hint: string }[] = [
  { name: 'program', label: 'Programa oficial', hint: 'Base del roadmap' },
  { name: 'materials', label: 'Material de estudio', hint: 'Apuntes y prácticas' },
  { name: 'exams', label: 'Exámenes anteriores', hint: 'Parciales y finales' },
]

class ActionError extends Error {}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('No pude consultar la FCEIA.')
  return response.json()
}

function termLabel(subject: PresetSubject) {
  if (!subject.year) return subject.kind === 'electiva' ? 'Electiva' : 'Sin año'
  return `${subject.year}° año`
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Retries transient failures (timeouts, dropped connections) without restarting the whole import. */
async function runBatch(input: Parameters<typeof importPresetBatch>[0]) {
  let failure = new Error('Se cortó la conexión con el servidor.')
  for (let attempt = 0; attempt < BATCH_ATTEMPTS; attempt++) {
    try {
      const response = await importPresetBatch(input)
      if (response.ok) return response.result
      throw new ActionError(response.error)
    } catch (error) {
      if (error instanceof ActionError) throw error
      failure = error instanceof Error ? error : failure
      await wait(1500 * (attempt + 1))
    }
  }
  throw failure
}

function BookFileRow({
  file,
  checked,
  disabled,
  onChange,
}: {
  file: BookFile
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      className={`flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm ${
        file.tooLarge ? 'opacity-60' : 'cursor-pointer hover:bg-secondary/60'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled || file.tooLarge}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-primary"
      />
      <span className="min-w-0 flex-1 break-words">{file.title}</span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {formatBytes(file.sizeBytes)}
        {file.tooLarge ? (
          <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-medium text-destructive">
            Demasiado pesado
          </span>
        ) : (
          file.heavy && (
            <span className="rounded bg-chart-4/20 px-1.5 py-0.5 font-medium text-foreground">
              Pesado
            </span>
          )
        )}
      </span>
    </label>
  )
}

export function FceiaPicker({
  subjectId,
  submitLabel,
}: {
  subjectId?: string
  submitLabel: string
}) {
  const router = useRouter()
  const stopRequested = useRef(false)

  const [careerId, setCareerId] = useState('')
  const [fceiaSubjectId, setFceiaSubjectId] = useState('')
  const [include, setInclude] = useState<Include>({ program: true, materials: true, exams: true })
  const [entrySelection, setEntrySelection] = useState<Record<number, boolean>>({})
  const [fileSelection, setFileSelection] = useState<Record<number, boolean>>({})
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const careers = useSWR<Career[]>('/api/fceia/careers', fetchJson)
  const subjects = useSWR<PresetSubject[]>(
    careerId ? `/api/fceia/subjects?careerId=${careerId}` : null,
    fetchJson,
  )
  const catalog = useSWR<BookCatalog>(
    fceiaSubjectId ? `/api/fceia/books?subjectId=${fceiaSubjectId}` : null,
    fetchJson,
    { revalidateOnFocus: false },
  )

  const sortedSubjects = [...(subjects.data ?? [])].sort(
    (a, b) =>
      (a.year ?? 99) - (b.year ?? 99) ||
      (a.term ?? 0) - (b.term ?? 0) ||
      a.name.localeCompare(b.name),
  )

  const entries = catalog.data?.entries ?? []
  const looseBooks = catalog.data?.looseBooks ?? []
  const allFiles = [...entries.flatMap((entry) => entry.files), ...looseBooks]
  const selectedEntryIds = entries
    .filter((entry) => entrySelection[entry.id] ?? true)
    .map((entry) => entry.id)
  const selectedFiles = allFiles.filter((file) => fileSelection[file.id] && !file.tooLarge)
  const selectedBytes = selectedFiles.reduce((total, file) => total + (file.sizeBytes ?? 0), 0)
  const hasHeavySelection = selectedFiles.some((file) => file.heavy)
  const hasBooks = allFiles.length > 0

  const nothingSelected =
    !include.program &&
    !include.materials &&
    !include.exams &&
    selectedEntryIds.length === 0 &&
    selectedFiles.length === 0

  function chooseSubject(value: string) {
    setFceiaSubjectId(value)
    setEntrySelection({})
    setFileSelection({})
  }

  async function startImport() {
    stopRequested.current = false
    setRunning(true)
    setError(null)
    setProgress({ done: 0, total: null })

    let targetId = subjectId
    try {
      if (!targetId) {
        const created = await createPresetSubject(Number(fceiaSubjectId))
        if (!created.ok) throw new ActionError(created.error)
        targetId = created.subjectId
      }

      const skipKeys: string[] = []
      const notes: string[] = []
      let saved = 0
      let failed = 0
      let empty = 0
      let withoutText = 0
      let remaining = 0
      let total: number | null = null

      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const result = await runBatch({
          subjectId: targetId,
          fceiaSubjectId: Number(fceiaSubjectId),
          include,
          bibliographyIds: selectedEntryIds,
          bookIds: selectedFiles.map((file) => file.id),
          skipKeys,
          initial: batch === 0,
        })

        saved += result.saved
        failed += result.failed
        empty += result.empty
        withoutText += result.withoutText
        remaining = result.remaining
        skipKeys.push(...result.settledKeys)
        notes.push(...result.notes)
        if (total === null) total = result.saved + result.failed + result.empty + result.remaining
        setProgress({ done: saved + failed + empty, total })

        if (remaining === 0 || stopRequested.current) break
      }

      const summary = [
        `Importé ${saved} ${saved === 1 ? 'documento' : 'documentos'}.`,
        ...notes,
        failed > 0 &&
          `${failed} no se pudieron procesar; volvé a importar para reintentarlos.`,
        empty > 0 && `${empty} no tenían texto utilizable.`,
        withoutText > 0 && `${withoutText} son escaneos sin texto y se omitieron.`,
        remaining > 0 && `Quedan ${remaining} por importar: volvé a importar para continuar.`,
      ].filter(Boolean)

      router.push(`/materias/${targetId}?notice=${encodeURIComponent(summary.join(' '))}`)
      router.refresh()
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'No pude importar desde la FCEIA.'
      if (targetId && targetId !== subjectId) {
        router.push(`/materias/${targetId}?error=${encodeURIComponent(message)}`)
        return
      }
      setError(message)
      setRunning(false)
      setProgress(null)
    }
  }

  const percentage =
    progress?.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : null

  return (
    <div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
      <fieldset disabled={running} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fceia-career">Carrera</Label>
            <select
              id="fceia-career"
              value={careerId}
              disabled={careers.isLoading}
              onChange={(event) => {
                setCareerId(event.target.value)
                chooseSubject('')
              }}
              className={selectClassName}
            >
              <option value="">
                {careers.isLoading ? 'Cargando carreras…' : 'Elegí una carrera'}
              </option>
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
              value={fceiaSubjectId}
              disabled={!careerId || subjects.isLoading}
              onChange={(event) => chooseSubject(event.target.value)}
              className={selectClassName}
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
                  checked={include[option.name]}
                  onChange={(event) =>
                    setInclude((current) => ({ ...current, [option.name]: event.target.checked }))
                  }
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

        {fceiaSubjectId && (
          <details className="group rounded-lg border">
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium">
              <span>Bibliografía y libros</span>
              <span className="text-xs font-normal text-muted-foreground">
                {catalog.isLoading
                  ? 'Cargando…'
                  : `${selectedEntryIds.length} de ${entries.length} obras · ${selectedFiles.length} ${
                      selectedFiles.length === 1 ? 'archivo' : 'archivos'
                    } de libro`}
              </span>
            </summary>

            <div className="flex flex-col gap-4 border-t p-3">
              {catalog.error && (
                <p role="alert" className="text-sm text-destructive">
                  No pude consultar la bibliografía de esta materia.
                </p>
              )}

              {!catalog.isLoading && !catalog.error && entries.length === 0 && !hasBooks && (
                <p className="text-sm text-muted-foreground">
                  Esta materia no tiene bibliografía cargada en la FCEIA.
                </p>
              )}

              {entries.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="px-2 text-xs font-medium text-muted-foreground">
                    Bibliografía de la cátedra
                  </p>
                  {entries.map((entry) => (
                    <div key={entry.id} className="flex flex-col">
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-secondary/60">
                        <input
                          type="checkbox"
                          checked={entrySelection[entry.id] ?? true}
                          onChange={(event) =>
                            setEntrySelection((current) => ({
                              ...current,
                              [entry.id]: event.target.checked,
                            }))
                          }
                          className="mt-0.5 size-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{entry.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {[entry.author, entry.year, entry.kind && `bibliografía ${entry.kind}`]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      </label>
                      {entry.files.length > 0 && (
                        <div className="ml-6 flex flex-col border-l pl-2">
                          {entry.files.map((file) => (
                            <BookFileRow
                              key={file.id}
                              file={file}
                              checked={Boolean(fileSelection[file.id])}
                              disabled={running}
                              onChange={(checked) =>
                                setFileSelection((current) => ({ ...current, [file.id]: checked }))
                              }
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {looseBooks.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="px-2 text-xs font-medium text-muted-foreground">
                    Otros libros disponibles
                  </p>
                  {looseBooks.map((file) => (
                    <BookFileRow
                      key={file.id}
                      file={file}
                      checked={Boolean(fileSelection[file.id])}
                      disabled={running}
                      onChange={(checked) =>
                        setFileSelection((current) => ({ ...current, [file.id]: checked }))
                      }
                    />
                  ))}
                </div>
              )}

              {entries.length > 0 && (
                <p className="px-2 text-xs text-muted-foreground">
                  {hasBooks
                    ? 'Cada obra tildada suma su ficha (título y autor). Los archivos de libro se importan solo si los tildás.'
                    : 'La FCEIA no tiene el archivo de estos libros: se agrega solo su ficha (título y autor) como referencia.'}
                </p>
              )}
            </div>
          </details>
        )}

        {hasHeavySelection && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-chart-4/50 bg-chart-4/10 p-3 text-sm"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Elegiste {formatBytes(selectedBytes)} en libros pesados. Cada uno puede tardar
              unos minutos en descargarse e indexarse, y se indexan solo las primeras ~250
              páginas. Mantené esta pestaña abierta hasta que termine.
            </p>
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {running && progress && (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {progress.total === null
                ? 'Preparando la importación…'
                : `Importando documentos: ${progress.done} de ${progress.total}`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                stopRequested.current = true
              }}
            >
              Detener al terminar la tanda
            </Button>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage ?? undefined}
            aria-label="Progreso de la importación"
          >
            <div
              className={`h-full bg-primary transition-all ${percentage === null ? 'w-1/6 animate-pulse' : ''}`}
              style={percentage === null ? undefined : { width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div>
          <Button
            type="button"
            onClick={startImport}
            disabled={running || !fceiaSubjectId || catalog.isLoading || nothingSelected}
          >
            {running ? 'Importando…' : submitLabel}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          La importación se hace sola por tandas: no hace falta recargar la página ni repetirla.
        </p>
      </div>
    </div>
  )
}
