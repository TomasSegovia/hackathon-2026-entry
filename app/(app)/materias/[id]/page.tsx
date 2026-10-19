import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, desc, eq, sql } from 'drizzle-orm'
import { ArrowLeft, ListChecks, Route, Trash2 } from 'lucide-react'
import { importFromPreset } from '@/app/actions/fceia'
import { deleteMaterial } from '@/app/actions/materials'
import { deleteSubject } from '@/app/actions/subjects'
import { FceiaPicker } from '@/components/fceia-picker'
import { GenerateRoadmapForm } from '@/components/generate-roadmap-form'
import { MaterialForm } from '@/components/material-form'
import { ProgramForm } from '@/components/program-form'
import { StepSection } from '@/components/step-section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { db } from '@/lib/db'
import { materials, practiceExercises, subjects, subtopics, topics } from '@/lib/db/schema'
import { requireUser } from '@/lib/session'
import { MATERIAL_KINDS, PRACTICE_KINDS, type MaterialKind } from '@/lib/types'

export const maxDuration = 300

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; notice?: string }>
}) {
  const { id } = await params
  const { error, notice } = await searchParams
  const user = await requireUser()

  const [subject] = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.id, id), eq(subjects.userId, user.id)))
  if (!subject) notFound()

  const [materialList, [topicStats], [subtopicStats], [exerciseStats]] = await Promise.all([
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
      .select({ total: sql<number>`count(*)::int` })
      .from(topics)
      .where(and(eq(topics.subjectId, id), eq(topics.userId, user.id))),
    db
      .select({
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${subtopics.status} = 'done')::int`,
      })
      .from(subtopics)
      .where(and(eq(subtopics.subjectId, id), eq(subtopics.userId, user.id))),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(practiceExercises)
      .where(and(eq(practiceExercises.subjectId, id), eq(practiceExercises.userId, user.id))),
  ])

  const hasProgram = Boolean(subject.program?.trim())
  const hasRoadmap = topicStats.total > 0
  const practiceMaterials = materialList.filter((material) =>
    PRACTICE_KINDS.includes(material.kind as MaterialKind),
  ).length
  const theoryMaterials = materialList.length - practiceMaterials
  const progress =
    subtopicStats.total === 0 ? 0 : Math.round((subtopicStats.done / subtopicStats.total) * 100)

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
        <div>
          <h1 className="text-3xl font-semibold">{subject.name}</h1>
          {subject.description && (
            <p className="mt-1 text-muted-foreground">{subject.description}</p>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-destructive/40 p-4 text-sm">
            {error.slice(0, 300)}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl border border-primary/40 p-4 text-sm">
            {notice.slice(0, 600)}
          </p>
        )}
      </div>

      <StepSection
        number={1}
        title="Programa de la materia"
        description="Los temas del programa son la base del roadmap."
        done={hasProgram}
      >
        {hasProgram ? (
          <details className="rounded-xl border bg-card p-5">
            <summary className="cursor-pointer text-sm font-medium">
              Programa cargado · ver o reemplazar
            </summary>
            <div className="mt-4">
              <ProgramForm subjectId={subject.id} currentProgram={subject.program} />
            </div>
          </details>
        ) : (
          <ProgramForm subjectId={subject.id} currentProgram={null} />
        )}
      </StepSection>

      <StepSection
        number={2}
        title="Bibliografía y prácticas"
        description="Subí libros y apuntes para sugerir dónde estudiar cada subtema, y guías o exámenes anteriores para ofrecer ejercicios."
        done={materialList.length > 0}
      >
        <details className="rounded-xl border bg-card p-5" open={!subject.fceiaSubjectId && materialList.length === 0}>
          <summary className="cursor-pointer text-sm font-medium">
            {subject.fceiaSubjectId
              ? 'Importada de la FCEIA · importar más contenido'
              : 'Completar con contenido oficial de la FCEIA'}
          </summary>
          <div className="mt-4">
            <FceiaPicker
              action={importFromPreset}
              subjectId={subject.id}
              submitLabel="Importar desde la FCEIA"
              pendingLabel="Importando desde la FCEIA… puede tardar un minuto"
            />
          </div>
        </details>
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
                    {MATERIAL_KINDS[material.kind as MaterialKind] ?? 'Otro'}
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
      </StepSection>

      <StepSection
        number={3}
        title="Roadmap"
        description="Un grafo de dependencias entre temas, con subtemas, seguimiento manual y ejercicios."
        done={hasRoadmap}
      >
        {hasRoadmap ? (
          <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
            <p className="text-sm">
              <span className="font-semibold">{topicStats.total} temas</span>
              <span className="text-muted-foreground">
                {' '}
                · {subtopicStats.total} subtemas · {exerciseStats.total} ejercicios · {progress}%
                visto
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button nativeButton={false} render={<Link href={`/materias/${subject.id}/roadmap`} />}>
                <Route aria-hidden="true" />
                Abrir roadmap
              </Button>
              {exerciseStats.total > 0 && (
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link href={`/materias/${subject.id}/practica`} />}
                >
                  <ListChecks aria-hidden="true" />
                  Ir a la práctica
                </Button>
              )}
            </div>
            <details className="border-t pt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Volver a generar el roadmap
              </summary>
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Se reemplaza el roadmap actual y se pierde el seguimiento que marcaste.
                </p>
                <GenerateRoadmapForm
                  subjectId={subject.id}
                  label="Regenerar roadmap"
                  variant="outline"
                />
              </div>
            </details>
          </div>
        ) : hasProgram ? (
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Se usarán {theoryMaterials} {theoryMaterials === 1 ? 'material de teoría' : 'materiales de teoría'}{' '}
              para sugerir dónde estudiar y {practiceMaterials}{' '}
              {practiceMaterials === 1 ? 'práctica' : 'prácticas'} para ofrecer ejercicios.
            </p>
            <div>
              <GenerateRoadmapForm subjectId={subject.id} />
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
            Cargá el programa de la materia para poder generar el roadmap.
          </p>
        )}
      </StepSection>

      <form action={deleteSubject} className="border-t pt-6">
        <input type="hidden" name="subjectId" value={subject.id} />
        <Button type="submit" variant="ghost" className="text-destructive">
          Eliminar materia y todo su contenido
        </Button>
      </form>
    </div>
  )
}
