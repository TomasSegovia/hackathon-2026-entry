import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { materials, practiceExercises } from '@/lib/db/schema'
import type { ExerciseData } from '@/lib/types'

export function loadExercises(subjectId: string, userId: string): Promise<ExerciseData[]> {
  return db
    .select({
      id: practiceExercises.id,
      topicId: practiceExercises.topicId,
      subtopicId: practiceExercises.subtopicId,
      statement: practiceExercises.statement,
      done: practiceExercises.done,
      materialId: practiceExercises.materialId,
      materialTitle: materials.title,
      materialKind: materials.kind,
      label: practiceExercises.label,
      page: practiceExercises.page,
    })
    .from(practiceExercises)
    .leftJoin(
      materials,
      and(eq(materials.id, practiceExercises.materialId), eq(materials.userId, userId)),
    )
    .where(and(eq(practiceExercises.subjectId, subjectId), eq(practiceExercises.userId, userId)))
    .orderBy(asc(practiceExercises.materialId), asc(practiceExercises.position))
}
