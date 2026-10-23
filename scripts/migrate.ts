import 'dotenv/config'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run database migrations.')
  }

  const migrationsDirectory = fileURLToPath(
    new URL('../db/migrations/', import.meta.url),
  )
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+_[\w-]+\.sql$/.test(file))
    .sort()
  if (migrationFiles.length === 0) {
    throw new Error(`No SQL migrations found in ${migrationsDirectory}`)
  }

  const pool = new Pool({ connectionString })
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    for (const name of migrationFiles) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1',
        [name],
      )
      if (alreadyApplied.rowCount) {
        console.log(`Already applied: ${name}`)
        continue
      }

      const sql = await readFile(path.join(migrationsDirectory, name), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
          name,
        ])
        await client.query('COMMIT')
        console.log(`Applied: ${name}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error('Database migration failed:', error)
  process.exitCode = 1
})
