import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { PdfViewer } from '@/components/pdf-viewer'
import { db } from '@/lib/db'
import { materials, subjects } from '@/lib/db/schema'
import { requireUser } from '@/lib/session'
import { MATERIAL_KINDS, isMaterialKind } from '@/lib/types'
import { ORIGINAL_FILE_KEY, parsePages } from '@/lib/viewer'

export const metadata = { title: 'Visor de documento' }

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; materialId: string }>
  searchParams: Promise<{ paginas?: string | string[] }>
}) {
  const [{ id, materialId }, { paginas }] = await Promise.all([params, searchParams])
  const user = await requireUser()

  const [row] = await db
    .select({
      title: materials.title,
      kind: materials.kind,
      content: materials.content,
      externalKey: materials.externalKey,
      subjectName: subjects.name,
    })
    .from(materials)
    .innerJoin(subjects, and(eq(subjects.id, materials.subjectId), eq(subjects.userId, user.id)))
    .where(
      and(eq(materials.id, materialId), eq(materials.subjectId, id), eq(materials.userId, user.id)),
    )
    .limit(1)
  if (!row) notFound()

  const pages = parsePages(paginas)
  const hasFile = Boolean(row.externalKey && ORIGINAL_FILE_KEY.test(row.externalKey))

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/materias/${id}/roadmap`}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Volver al roadmap
      </Link>
      <header className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {row.subjectName}
          {isMaterialKind(row.kind) && ` · ${MATERIAL_KINDS[row.kind]}`}
        </p>
        <h1 className="text-balance text-xl font-semibold">{row.title}</h1>
      </header>

      {hasFile ? (
        <PdfViewer materialId={materialId} title={row.title} pages={pages} />
      ) : (
        <section aria-labelledby="text-title" className="flex flex-col gap-2">
          <h2 id="text-title" className="text-sm font-semibold">
            Texto del documento
          </h2>
          <p className="text-xs text-muted-foreground">
            Este material se cargó como texto, así que no hay un PDF original para mostrar.
            {pages.length > 0 && ` Buscá la página ${pages.join(', ')}.`}
          </p>
          <div className="max-h-[75dvh] overflow-auto rounded-xl border bg-card p-4 text-sm leading-relaxed whitespace-pre-line">
            {row.content}
          </div>
        </section>
      )}
    </div>
  )
}
