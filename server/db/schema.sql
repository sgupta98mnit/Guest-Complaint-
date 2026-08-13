-- ASETT Complaints - schema
--
-- Follows the data model in the design handoff: a complaint, the person who
-- filed it, the entity it is filed against, and an append-only log of intake
-- decisions.

CREATE TABLE IF NOT EXISTS complaints (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id           TEXT NOT NULL UNIQUE,        -- CM-26-00042
  complaint_type        TEXT NOT NULL,               -- Transactions | Code sets | Unique identifiers | Operating rules
  transaction_type      TEXT NOT NULL,
  description           TEXT NOT NULL,
  actions_taken         TEXT,
  incident_date         TEXT NOT NULL,               -- ISO date (YYYY-MM-DD)
  previous_tracking_id  TEXT,
  status                TEXT NOT NULL DEFAULT 'submitted'
                          CHECK (status IN (
                            'submitted',
                            'in_review',
                            'approved_for_intake',
                            'denied_for_intake',
                            'needs_more_info'
                          )),
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Monotonic per-year counter behind the CM-YY-NNNNN tracking id.
--
-- Deriving the sequence from COUNT(*) has two bugs: two concurrent submits read
-- the same count and collide on the UNIQUE index, and deleting a complaint hands
-- its number out again. Incrementing a row here inside the same transaction as
-- the insert fixes both - SQLite serializes writers, so the read-modify-write is
-- atomic, and the counter never goes backwards.
CREATE TABLE IF NOT EXISTS tracking_sequence (
  year                  TEXT PRIMARY KEY,            -- 2-digit year, e.g. '26'
  last_seq              INTEGER NOT NULL
);

-- The filer.
--
-- A verified email is always recorded, including for anonymous filings. That is
-- what makes a complaint attributable at all, and it is the gate that stops the
-- public endpoint being a free-for-all: filing costs you a mailbox you control.
--
-- `anonymous` is therefore a DISCLOSURE control, not a collection control - it
-- withholds the filer's identity from the filed-against entity, while CMS keeps
-- a verified address on record. Name and phone stay optional when anonymous.
--
-- `email` is left nullable in the DDL rather than NOT NULL so that databases
-- seeded before verification existed still open; the application requires it on
-- every new submission.
CREATE TABLE IF NOT EXISTS complainants (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id          INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  first_name            TEXT,
  last_name             TEXT,
  email                 TEXT,
  email_verified_at     TEXT,                        -- when the OTP was confirmed
  phone                 TEXT,
  role                  TEXT NOT NULL,
  anonymous             INTEGER NOT NULL DEFAULT 0   -- 0/1
);

-- Organizations are shared records, looked up by name and reused across
-- complaints. Without this the same entity is filed against under a dozen
-- spellings ("Cardinal Health Plan of New York", "cardinal health plan",
-- "Cardinal") and a reviewer cannot see every complaint against one org - which
-- is much of the point of an intake queue.
--
-- Dedupe is on name alone, case-insensitively. That is a simplification: real
-- organizations share names across cities, so the natural key would include the
-- address or - more fittingly for this domain - the NPI or EIN, which are
-- themselves among the identifiers ASETT exists to enforce.
CREATE TABLE IF NOT EXISTS organizations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  entity_type           TEXT,
  address               TEXT,
  city                  TEXT,
  state                 TEXT,
  zip                   TEXT,
  phone                 TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_name
  ON organizations(name COLLATE NOCASE);

-- The organization the complaint is about.
--
-- org_id links to the canonical record; org_name is the name as filed. Keeping
-- the snapshot means a complaint still reads correctly if the organization is
-- later renamed.
CREATE TABLE IF NOT EXISTS filed_against_entities (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id          INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  org_id                INTEGER REFERENCES organizations(id),
  org_name              TEXT NOT NULL,
  entity_type           TEXT NOT NULL,
  address               TEXT,
  city                  TEXT,
  state                 TEXT,
  zip                   TEXT,
  phone                 TEXT
);

-- Append-only intake decisions. Rows are never updated or deleted: a second
-- decision adds a row, so the sequence of who decided what survives intact.
-- `complaints.status` is denormalized from the newest row here so the queue
-- needs no join, which is safe only because both writes share one transaction.
CREATE TABLE IF NOT EXISTS complaint_actions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  complaint_id          INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  reviewer_name         TEXT NOT NULL,
  action                TEXT NOT NULL CHECK (action IN ('approve', 'deny', 'needs_info')),
  note                  TEXT NOT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_actions_complaint ON complaint_actions(complaint_id);
