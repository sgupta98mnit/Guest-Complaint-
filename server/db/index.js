import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ephemeral by design (per the exercise brief) - the file lives next to this
// module and can simply be deleted to reset state.
//
// ASETT_DB_PATH overrides the location and accepts ':memory:'. The test suite
// uses that to run against a throwaway database instead of the dev one.
const dbPath = process.env.ASETT_DB_PATH || path.join(__dirname, 'asett.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

/**
 * Add a column if it is missing.
 *
 * `CREATE TABLE IF NOT EXISTS` is a no-op against a database that already has
 * the table, so a column added to schema.sql would simply be absent at runtime
 * on any existing database - including the volume behind the live deployment.
 *
 * This is not a migration system: no ordering, no version tracking, no down
 * path. It is the smallest thing that keeps an existing database working, and a
 * real project needs the real tool.
 */
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn('complainants', 'email_verified_at', 'TEXT');
