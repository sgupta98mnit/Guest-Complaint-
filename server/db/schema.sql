-- ASETT Complaints - schema
-- SQLite. Kept intentionally close to the sandbox's guest complaint wizard,
-- with a normalized complainant / filed-against-entity (FAE) split and a
-- review history table so status changes are auditable in the list view.

CREATE TABLE IF NOT EXISTS complaints (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id         TEXT NOT NULL UNIQUE,       -- e.g. CM-26-03384
  complaint_type      TEXT NOT NULL,               -- Transactions | Code Sets | Unique Identifiers | Operating Rules
  description         TEXT NOT NULL,
  actions_taken       TEXT,
  incident_date       TEXT NOT NULL,               -- ISO date (YYYY-MM-DD)
  prev_tracking_id    TEXT,
  transaction_type    TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted','approved','denied','needs_info')),
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Monotonic per-year counter behind the CM-YY-NNNNN tracking id.
--
-- The first cut of this derived the sequence from COUNT(*) over `complaints`,
-- which has two bugs: two concurrent submits read the same count and collide on
-- the UNIQUE index, and deleting a complaint causes its number to be handed out
-- again. Incrementing a row here inside the same transaction as the insert fixes
-- both - SQLite serializes writers, so the read-modify-write is atomic, and the
-- counter never goes backwards even if complaints are deleted.
CREATE TABLE IF NOT EXISTS tracking_sequence (
  year                TEXT PRIMARY KEY,            -- 2-digit year, e.g. '26'
  last_seq            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS complainants (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id        INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  anonymous           INTEGER NOT NULL DEFAULT 0,  -- 0/1
  org_name            TEXT,
  org_type            TEXT,
  first_name          TEXT,
  last_name           TEXT,
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT,
  state                TEXT,
  zip                 TEXT,
  email               TEXT NOT NULL,
  phone               TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fae_entities (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id        INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  org_name            TEXT NOT NULL,
  org_type            TEXT,
  contact_first_name  TEXT,
  contact_last_name   TEXT,
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT,
  state                TEXT,
  zip                 TEXT,
  email               TEXT,
  phone               TEXT
);

CREATE TABLE IF NOT EXISTS complaint_reviews (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id        INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  action              TEXT NOT NULL CHECK (action IN ('approved','denied','needs_info')),
  note                TEXT NOT NULL,
  reviewer            TEXT NOT NULL,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_reviews_complaint ON complaint_reviews(complaint_id);
