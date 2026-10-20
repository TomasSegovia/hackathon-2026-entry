import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { and, asc, eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { PracticeList, type PracticeExercise } from '@/components/practice-list'
import { db } from '@/lib/db'
import { subjects, subtopics, topics } from '@/lib/db/schema'
import { loadExercises } from '@/lib/exercises'
import { requireUser } from '@/lib/session'

export default async function PracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()

  const [subject] = await db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, id), eq(subjects.userId, user.id)))
  if (!subject) notFound()

  const [topicRows, subtopicRows, exerciseRows] = await Promise.all([
    db
      .select({ id: topics.id, title: topics.title })
      .from(topics)
      .where(and(eq(topics.subjectId, id), eq(topics.userId, user.id)))
      .orderBy(asc(topics.position)),
    db
      .select({ id: subtopics.id, title: subtopics.title, status: subtopics.status })
      .from(subtopics)
      .where(and(eq(subtopics.subjectId, id), eq(subtopics.userId, user.id))),
    loadExercises(id, user.id),
  ])

  if (topicRows.length === 0) redirect(`/materias/${id}`)

  const topicTitle = new Map(topicRows.map((topic) => [topic.id, topic.title]))
  const subtopicById = new Map(subtopicRows.map((subtopic) => [subtopic.id, subtopic]))

  const practiceRows = exerciseRows.filter((exercise) => exercise.materialKind !== 'examen_anterior')
  const unlocked: PracticeExercise[] = practiceRows
    .filter((exercise) => subtopicById.get(exercise.subtopicId)?.status === 'done')
    .map((exercise) => ({
      ...exercise,
      topicTitle: topicTitle.get(exercise.topicId) ?? '',
      subtopicTitle: subtopicById.get(exercise.subtopicId)?.title ?? '',
    }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={`/materias/${id}/roadmap`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Roadmap de {subject.name}
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">Práctica</h1>
          <p className="mt-1 text-muted-foreground">
            Ejercicios de los subtemas que ya marcaste como vistos.
          </p>
        </div>
      </div>
      <PracticeList
        subjectId={id}
        topics={topicRows}
        exercises={unlocked}
        lockedCount={practiceRows.length - unlocked.length}
        roadmapHref={`/materias/${id}/roadmap`}
      />
    </div>
  )
}
