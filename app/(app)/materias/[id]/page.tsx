import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { ArrowLeft, FilePlus2, Trash2 } from 'lucide-react'
import { deleteMaterial } from '@/app/actions/materials'
import { deleteSubject } from '@/app/actions/subjects'
import { MaterialForm } from '@/components/material-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { exercises, materials, subjects } from '@/lib/db/schema'
import { requireUser } from '@/lib/session'
import { EXERCISE_KINDS, MATERIAL_KINDS } from '@/lib/types'

export const maxDuration = 60

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const user = await requireUser()

  const [subject] = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.id, id), eq(subjects.userId, user.id)))
  if (!subject) notFound()

  const [materialList, exerciseList] = await Promise.all([
    db
      .select({
        id: materials.id,
        title: materials.title,
        kind: materials.kind,
        chunkCount: materials.chunkCount,
      })
      .from(materials)
      .where(and(eq(materials.subjectId, id), eq(materials.userId, user.id)))
      .orderBy(desc(materials.createdAt)),
    db
      .select({
        id: exercises.id,
        title: exercises.title,
        kind: exercises.kind,
        status: exercises.status,
      })
      .from(exercises)
      .where(and(eq(exercises.subjectId, id), eq(exercises.userId, user.id)))
      .orderBy(desc(exercises.createdAt)),
  ])

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Link
          href="/materias"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Mis materias
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{subject.name}</h1>
            {subject.description && (
              <p className="mt-1 text-muted-foreground">{subject.description}</p>
            )}
          </div>
          <Button
            nativeButton={false}
            render={<Link href={`/materias/${subject.id}/ejercicios/nuevo`} />}
          >
            <FilePlus2 aria-hidden="true" />
            Subir ejercicio
          </Button>
        </div>
      </div>

      <section aria-labelledby="ejercicios" className="flex flex-col gap-4">
        <h2 id="ejercicios" className="text-xl font-semibold">
          Ejercicios analizados
        </h2>
        {exerciseList.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Todavía no subiste ninguna consigna. Cargá primero tus apuntes y después probá con un
            ejercicio.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {exerciseList.map((exercise) => (
              <li key={exercise.id}>
                <Link
                  href={`/ejercicios/${exercise.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:border-primary/50"
                >
                  <span className="truncate font-medium">{exercise.title}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {exercise.status === 'error' && <Badge variant="destructive">Con error</Badge>}
                    <Badge variant="secondary">
                      {EXERCISE_KINDS[exercise.kind as keyof typeof EXERCISE_KINDS] ?? 'Ejercicio'}
                    </Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="biblioteca" className="flex flex-col gap-4">
        <h2 id="biblioteca" className="text-xl font-semibold">
          Biblioteca de la materia
        </h2>
        {error && (
          <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">
            {error.slice(0, 300)}
          </p>
        )}
        <MaterialForm subjectId={subject.id} />
        {materialList.length > 0 && (
          <ul className="flex flex-col gap-2">
            {materialList.map((material) => (
              <li
                key={material.id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{material.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {material.chunkCount} fragmentos indexados
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">
                    {MATERIAL_KINDS[material.kind as keyof typeof MATERIAL_KINDS] ?? 'Otro'}
                  </Badge>
                  <form action={deleteMaterial}>
                    <input type="hidden" name="materialId" value={material.id} />
                    <input type="hidden" name="subjectId" value={subject.id} />
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
        )}
      </section>

      <form action={deleteSubject} className="border-t pt-6">
        <input type="hidden" name="subjectId" value={subject.id} />
        <Button type="submit" variant="ghost" className="text-destructive">
          Eliminar materia y todo su contenido
        </Button>
      </form>
    </div>
  )
}
