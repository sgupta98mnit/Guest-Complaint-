import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Ephemeral by design (per the challenge notes) - the file lives next to this
// module and can just be deleted to reset state.
//
// ASETT_DB_PATH overrides the location, and accepts ':memory:'. The test suite
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
 * the table, so editing schema.sql does nothing for an existing file - a column
 * added there would be missing at runtime and every insert would fail. This
 * closes that gap for the one case this project has.
 *
 * It is not a migration tool. A real project needs ordered, versioned, tracked
 * migrations (and a down path); this is the smallest thing that keeps an
 * existing dev database working. See ARCHITECTURE.md.
 */
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn('complainants', 'org_id', 'INTEGER REFERENCES organizations(id)');
ensureColumn('fae_entities', 'org_id', 'INTEGER REFERENCES organizations(id)');
