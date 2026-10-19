import { Download, Trash2 } from 'lucide-react'
import { deleteMaterial } from '@/app/actions/materials'
import { Button, buttonVariants } from '@/components/ui/button'
import { MATERIAL_KINDS, type MaterialKind } from '@/lib/types'

type MaterialItem = {
  id: string
  title: string
  kind: string
  chunkCount: number
  externalKey: string | null
}

const DOWNLOADABLE_KEY = /^fceia:(material|exam):\d+$/

const GROUP_ORDER = Object.keys(MATERIAL_KINDS) as MaterialKind[]

function kindOf(kind: string): MaterialKind {
  return kind in MATERIAL_KINDS ? (kind as MaterialKind) : 'otro'
}

function groupLabel(kind: MaterialKind, count: number) {
  const singular = MATERIAL_KINDS[kind].toLowerCase()
  if (count === 1) return singular
  const words = singular.split(' ')
  const plural = (word: string) =>
    /[aeiouáéíóú]$/.test(word) ? `${word}s` : word.endsWith('n') ? `${word.slice(0, -1)}nes` : `${word}es`
  return words.length > 1 ? [plural(words[0]), ...words.slice(1)].join(' ') : plural(singular)
}

/** Imported documents inside one closed dropdown, grouped by type. */
export function MaterialList({
  subjectId,
  materials,
}: {
  subjectId: string
  materials: MaterialItem[]
}) {
  const groups = GROUP_ORDER.map((kind) => ({
    kind,
    items: materials.filter((material) => kindOf(material.kind) === kind),
  })).filter((group) => group.items.length > 0)

  return (
    <details className="rounded-xl border bg-card">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-sm font-medium">
        <span>Documentos importados</span>
        <span className="text-xs font-normal text-muted-foreground">
          {materials.length} {materials.length === 1 ? 'documento' : 'documentos'} ·{' '}
          {groups.map((group) => `${group.items.length} ${groupLabel(group.kind, group.items.length)}`).join(' · ')}
        </span>
      </summary>

      <div className="flex flex-col gap-5 border-t p-5">
        {groups.map((group) => (
          <section key={group.kind} aria-label={MATERIAL_KINDS[group.kind]}>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {MATERIAL_KINDS[group.kind]} · {group.items.length}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {group.items.map((material) => (
                <li
                  key={material.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{material.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {material.chunkCount} fragmentos indexados
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                  {material.externalKey && DOWNLOADABLE_KEY.test(material.externalKey) && (
                    <a
                      href={`/api/materials/${material.id}/file`}
                      download
                      aria-label={`Descargar ${material.title}`}
                      title="Descargar archivo original"
                      className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                    >
                      <Download aria-hidden="true" />
                    </a>
                  )}
                  <form action={deleteMaterial}>
                    <input type="hidden" name="materialId" value={material.id} />
                    <input type="hidden" name="subjectId" value={subjectId} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar ${material.title}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  )
}
