import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Migration aborted: DATABASE_URL is required.');
  process.exit(1);
}

// Resolve from this script, never from process.cwd(); deploy providers may change cwd.
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(scriptDir, '../database/migrations');
if (!fs.existsSync(migrationsDir)) {
  console.error(`Migration aborted: directory not found: ${migrationsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});
const LOCK_ID = 84742026;
let lockHeld = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function acquireDeployLock(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [LOCK_ID]);
    if (result.rows[0]?.locked === true) return true;
    await sleep(1_000);
  }
  return false;
}

try {
  await client.connect();
  lockHeld = await acquireDeployLock();
  if (!lockHeld) throw new Error('Migration lock timeout after 60 seconds; another deploy may still be migrating.');

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query('ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum text');

  const appliedResult = await client.query('SELECT filename, checksum FROM schema_migrations');
  const applied = new Map(appliedResult.rows.map((row) => [row.filename, row.checksum]));

  for (const filename of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    if (applied.has(filename)) {
      const recorded = applied.get(filename);
      // Old installs may predate checksums; backfill once. Afterwards changed migration files fail hard.
      if (!recorded) {
        await client.query('UPDATE schema_migrations SET checksum = $1 WHERE filename = $2 AND checksum IS NULL', [checksum, filename]);
      } else if (recorded !== checksum) {
        throw new Error(`Applied migration was modified: ${filename}. Create a new migration instead of editing history.`);
      }
      continue;
    }

    console.log(`Applying ${filename}...`);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(filename, checksum) VALUES ($1, $2)', [filename, checksum]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration failed: ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`Migrations OK: ${files.length} migration files accounted for.`);
} finally {
  if (lockHeld) {
    try { await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]); } catch {}
  }
  await client.end().catch(() => undefined);
}

