import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL no está configurada. Conectá la integración de Neon.')
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString)

// In dev the pool is cached across HMR reloads; key it by URL so a changed
// DATABASE_URL (e.g. after connecting Neon) doesn't keep a stale pool alive.
const globalForPool = globalThis as unknown as {
  pool?: Pool
  poolUrl?: string
}

if (globalForPool.pool && globalForPool.poolUrl !== connectionString) {
  void globalForPool.pool.end().catch(() => {})
  globalForPool.pool = undefined
}

export const pool =
  globalForPool.pool ??
  new Pool({
    connectionString,
    max: 5,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPool.pool = pool
  globalForPool.poolUrl = connectionString
}

export const db = drizzle(pool, { schema })
