CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS subjects (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "program" text,
  "fceiaSubjectId" integer,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS materials (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "subjectId" text NOT NULL,
  "title" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'apunte',
  "content" text NOT NULL,
  "sourceName" text,
  "externalKey" text,
  "chunkCount" integer NOT NULL DEFAULT 0,
  "pagesChecked" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "subjectId" text NOT NULL,
  "materialId" text NOT NULL,
  "position" integer NOT NULL,
  "page" integer,
  "content" text NOT NULL,
  "embedding" vector(1536) NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "subjectId" text NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL DEFAULT '',
  "position" integer NOT NULL DEFAULT 0,
  "prerequisites" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'pending',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subtopics (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "subjectId" text NOT NULL,
  "topicId" text NOT NULL,
  "title" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending',
  "sources" jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS practice_exercises (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "subjectId" text NOT NULL,
  "topicId" text NOT NULL,
  "subtopicId" text NOT NULL,
  "materialId" text,
  "statement" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "done" boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS subjects_user_idx ON subjects ("userId");
CREATE INDEX IF NOT EXISTS materials_subject_idx ON materials ("subjectId");
CREATE INDEX IF NOT EXISTS chunks_subject_idx ON chunks ("subjectId");
CREATE INDEX IF NOT EXISTS chunks_material_idx ON chunks ("materialId");
CREATE INDEX IF NOT EXISTS topics_subject_idx ON topics ("subjectId");
CREATE INDEX IF NOT EXISTS subtopics_topic_idx ON subtopics ("topicId");
CREATE INDEX IF NOT EXISTS practice_subtopic_idx ON practice_exercises ("subtopicId");
