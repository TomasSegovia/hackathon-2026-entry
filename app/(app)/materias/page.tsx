import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { Library } from 'lucide-react'
import { createSubject } from '@/app/actions/subjects'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { db } from '@/lib/db'
import { materials, subjects } from '@/lib/db/schema'
import { requireUser } from '@/lib/session'

export const metadata = { title: 'Mis materias - Cuaderno' }

export default async function SubjectsPage() {
  const user = await requireUser()

  const list = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      description: subjects.description,
      materialCount: sql<number>`count(${materials.id})::int`,
    })
    .from(subjects)
    .leftJoin(materials, eq(materials.subjectId, subjects.id))
    .where(eq(subjects.userId, user.id))
    .groupBy(subjects.id)
    .orderBy(desc(subjects.createdAt))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold">Mis materias</h1>
        <p className="mt-1 text-muted-foreground">
          Cada materia tiene su propia biblioteca. Las búsquedas se hacen solo dentro de ella.
        </p>
      </div>

      <form
        action={createSubject}
        className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="name">Nueva materia</Label>
          <Input id="name" name="name" placeholder="Ej: Análisis Matemático II" required />
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Input id="description" name="description" placeholder="Cátedra, año, profesor…" />
        </div>
        <SubmitButton pendingLabel="Creando…">Crear materia</SubmitButton>
      </form>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <Library className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Todavía no tenés materias</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Creá la primera, subí tus apuntes y después probá con un ejercicio.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((subject) => (
            <li key={subject.id}>
              <Link
                href={`/materias/${subject.id}`}
                className="flex h-full flex-col gap-1 rounded-xl border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <span className="font-serif text-lg font-semibold">{subject.name}</span>
                {subject.description && (
                  <span className="text-sm text-muted-foreground">{subject.description}</span>
                )}
                <span className="mt-3 text-xs text-muted-foreground">
                  {subject.materialCount} {subject.materialCount === 1 ? 'material' : 'materiales'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
