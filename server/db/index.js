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
