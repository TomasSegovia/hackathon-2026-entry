import { ExternalLink, Globe } from 'lucide-react'
import { declineWebSearch, searchWebForItem } from '@/app/actions/exercises'
import { SubmitButton } from '@/components/submit-button'
import { Badge } from '@/components/ui/badge'
import { MATERIAL_KINDS, type ItemStatus, type Source, type WebSource, type WebStatus } from '@/lib/types'

type Item = {
  id: string
  exerciseId: string
  position: number
  statement: string
  topic: string
  status: string
  sources: Source[]
  webStatus: string
  webSources: WebSource[]
}

const statusLabel: Record<ItemStatus, string> = {
  found: 'Fuentes encontradas',
  weak: 'Coincidencia parcial',
  not_found: 'Sin material',
}

function WebSearchButton({ item, label, variant }: { item: Item; label: string; variant: 'default' | 'outline' | 'ghost' }) {
  return (
    <form action={searchWebForItem}>
      <input type="hidden" name="itemId" value={item.id} />
      <SubmitButton variant={variant} size="sm" pendingLabel="Buscando en internet…">
        <Globe aria-hidden="true" />
        {label}
      </SubmitButton>
    </form>
  )
}

function WebSection({ item }: { item: Item }) {
  const status = item.webStatus as WebStatus
  const needsHelp = item.status !== 'found'

  if (status === 'done') {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-secondary p-4">
        <p className="text-sm font-medium">Fuentes de internet</p>
        <ul className="flex flex-col gap-1">
          {item.webSources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
              >
                <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{source.title}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Verificá que la fuente corresponda al enfoque de tu cátedra.
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary p-4">
        <p className="text-sm">No pude obtener resultados de internet para este punto.</p>
        <WebSearchButton item={item} label="Reintentar" variant="outline" />
      </div>
    )
  }

  if (status === 'declined') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Elegiste no buscar en internet.</p>
        <WebSearchButton item={item} label="Buscar igual" variant="ghost" />
      </div>
    )
  }

  if (needsHelp) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-accent-foreground/20 bg-accent/60 p-4">
        <p className="text-sm font-medium text-accent-foreground">
          {item.status === 'weak'
            ? 'Lo que encontré en tu material es poco relevante para este punto.'
            : 'No encontré nada en tus apuntes, exámenes anteriores ni bibliografía.'}{' '}
          ¿Querés que busque en internet?
        </p>
        <div className="flex flex-wrap gap-2">
          <WebSearchButton item={item} label="Sí, buscar en internet" variant="default" />
          <form action={declineWebSearch}>
            <input type="hidden" name="itemId" value={item.id} />
            <input type="hidden" name="exerciseId" value={item.exerciseId} />
            <SubmitButton variant="outline" size="sm" pendingLabel="Guardando…">
              No, gracias
            </SubmitButton>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div>
      <WebSearchButton item={item} label="Buscar también en internet" variant="ghost" />
    </div>
  )
}

export function ItemCard({ item }: { item: Item }) {
  const status = item.status as ItemStatus

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">Punto {item.position + 1}</span>
          <Badge variant={status === 'found' ? 'default' : 'secondary'}>
            {statusLabel[status] ?? statusLabel.not_found}
          </Badge>
        </div>
        <p className="leading-relaxed">{item.statement}</p>
        <p className="text-sm text-muted-foreground">
          Tema a repasar: <span className="font-medium text-foreground">{item.topic}</span>
        </p>
      </header>

      {item.sources.length > 0 && (
        <ul className="flex flex-col gap-3">
          {item.sources.map((source) => (
            <li key={source.materialId} className="flex flex-col gap-1.5 rounded-lg bg-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{source.materialTitle}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {MATERIAL_KINDS[source.materialKind as keyof typeof MATERIAL_KINDS] ?? 'Otro'}
                  <span aria-label={`Relevancia ${Math.round(source.score * 100)} por ciento`}>
                    {Math.round(source.score * 100)}%
                  </span>
                </span>
              </div>
              <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                {source.snippet}
              </p>
            </li>
          ))}
        </ul>
      )}

      <WebSection item={item} />
    </article>
  )
}
