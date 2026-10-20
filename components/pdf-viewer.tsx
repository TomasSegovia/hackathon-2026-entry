'use client'

import { useState } from 'react'
import { Download, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PdfViewer({
  materialId,
  title,
  pages,
}: {
  materialId: string
  title: string
  pages: number[]
}) {
  const [page, setPage] = useState<number | null>(pages[0] ?? null)
  const fileUrl = `/api/materials/${materialId}/file`
  const inlineUrl = `${fileUrl}?inline=1${page ? `#page=${page}` : ''}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {pages.length > 0 ? (
          <nav aria-label="Páginas sugeridas" className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Ir a la página:</span>
            {pages.map((value) => (
              <button
                key={value}
                type="button"
                aria-current={value === page ? 'page' : undefined}
                onClick={() => setPage(value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors',
                  value === page
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card hover:border-primary/60',
                )}
              >
                {value}
              </button>
            ))}
          </nav>
        ) : (
          <span className="text-xs text-muted-foreground">Documento completo</span>
        )}
        <div className="flex items-center gap-3 text-xs">
          <a
            href={inlineUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Abrir en pestaña
          </a>
          <a
            href={fileUrl}
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Descargar
          </a>
        </div>
      </div>
      <iframe
        key={page ?? 'all'}
        src={inlineUrl}
        title={page ? `${title}, página ${page}` : title}
        className="h-[78dvh] min-h-[480px] w-full rounded-xl border bg-muted"
      />
      <p className="text-xs text-muted-foreground">
        Si tu navegador no muestra el PDF acá, usá “Abrir en pestaña”. La página es la que indica el
        visor del PDF, que puede no coincidir con el número impreso en el libro.
      </p>
    </div>
  )
}
