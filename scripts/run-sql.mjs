import { readFileSync } from 'node:fs'
import pg from 'pg'

const file = process.argv[2]
if (!file) throw new Error('Usage: node scripts/run-sql.mjs <file.sql>')

const connectionString = process.env.POSTGRES_URL_NON_POOLING?.replace(/[?&]sslmode=[^&]*/, '')
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

await client.connect()
try {
  const sql = readFileSync(file, 'utf8')
  // PostgreSQL requires newly-added enum values to be committed before they can be used.
  // Migrations may opt into separate phases with this marker.
  const phases = sql.split(/\n\s*-- MIGRATION_BOUNDARY\s*\n/g)
  for (const phase of phases) {
    if (phase.trim()) await client.query(phase)
  }
  console.log(`Applied ${file}`)
} finally {
  await client.end()
}
