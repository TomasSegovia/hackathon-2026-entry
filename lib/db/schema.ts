import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  vector,
} from 'drizzle-orm/pg-core'
import type { Source, WebSource } from '@/lib/types'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

export const subjects = pgTable('subjects', {
  id: id(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const materials = pgTable('materials', {
  id: id(),
  userId: text('userId').notNull(),
  subjectId: text('subjectId').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull().default('apunte'),
  content: text('content').notNull(),
  sourceName: text('sourceName'),
  chunkCount: integer('chunkCount').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const chunks = pgTable('chunks', {
  id: id(),
  userId: text('userId').notNull(),
  subjectId: text('subjectId').notNull(),
  materialId: text('materialId').notNull(),
  position: integer('position').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
})

export const exercises = pgTable('exercises', {
  id: id(),
  userId: text('userId').notNull(),
  subjectId: text('subjectId').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull().default('ejercicio'),
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const exerciseItems = pgTable('exercise_items', {
  id: id(),
  userId: text('userId').notNull(),
  exerciseId: text('exerciseId').notNull(),
  position: integer('position').notNull(),
  statement: text('statement').notNull(),
  topic: text('topic').notNull(),
  status: text('status').notNull().default('not_found'),
  sources: jsonb('sources').$type<Source[]>().notNull().default([]),
  webStatus: text('webStatus').notNull().default('none'),
  webSources: jsonb('webSources').$type<WebSource[]>().notNull().default([]),
})
