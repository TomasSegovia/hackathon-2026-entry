'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSearch, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { runBatch } from '@/lib/fceia/run-batch'

const MAX_BATCHES = 120

export function RefreshPagesButton({
  subjectId,
  fceiaSubjectId,
  staleCount,
}: {
  subjectId: string
  fceiaSubjectId: number
  staleCount: number
}) {
  const router = useRouter()
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError(null)
    setProgress(0)

    try {
      const skipKeys: string[] = []
      let updated = 0
      let unchanged = 0
      let failed = 0
      let remaining = 0

      for (let batch = 0; batch < MAX_BATCHES; batch++) {
        const result = await runBatch({
          subjectId,
          fceiaSubjectId,
          include: { program: false, materials: true, exams: true },
          bibliographyIds: [],
          bookIds: [],
          skipKeys,
          initial: false,
          refresh: true,
        })
        updated += result.saved
        unchanged += result.unchanged
        failed += result.failed
        remaining = result.remaining
        skipKeys.push(...result.settledKeys)
        setProgress(updated + unchanged + failed)
        if (remaining === 0) break
      }

      const summary = [
        `Actualicé las páginas de ${updated} ${updated === 1 ? 'documento' : 'documentos'}.`,
        unchanged > 0 &&
          `${unchanged} son escaneos o no tienen texto por página y seguirán sin ellas.`,
        failed > 0 && `${failed} no se pudieron procesar; volvé a intentar.`,
        remaining > 0 && `Quedan ${remaining} por actualizar: volvé a intentar.`,
        updated > 0 && 'Regenerá el roadmap para que las sugerencias incluyan las páginas.',
      ].filter(Boolean)

      router.replace(`/materias/${subjectId}?notice=${encodeURIComponent(summary.join(' '))}`)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pude actualizar las páginas.')
    } finally {
      running.current = false
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed bg-card p-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">
          {staleCount} {staleCount === 1 ? 'documento importado' : 'documentos importados'} sin
          revisar páginas
        </p>
        <p className="text-sm text-muted-foreground">
          Se importaron antes de que existiera la numeración de páginas. Vuelvo a leer los PDF
          originales para que el roadmap te diga en qué página está cada tema.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={refresh} disabled={busy}>
          {busy ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <FileSearch aria-hidden="true" />
          )}
          {busy ? 'Actualizando…' : 'Actualizar páginas'}
        </Button>
        <p role="status" className="text-sm text-muted-foreground">
          {busy ? `${progress} de ${staleCount} revisados` : ''}
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
