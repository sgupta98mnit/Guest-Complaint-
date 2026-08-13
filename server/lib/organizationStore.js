import { db } from '../db/index.js';
import { blankToNull, normalizePhone } from './validation.js';

// Organizations are shared, reusable records. The wizard searches them by name
// and can create one inline, so filers converge on a single spelling per entity
// instead of each inventing their own.

const SEARCH_LIMIT = 10;

const searchStmt = db.prepare(`
  SELECT id, name, entity_type, address, city, state, zip, phone
  FROM organizations
  WHERE name LIKE :pattern ESCAPE '\\'
  ORDER BY
    -- Prefix matches first, then alphabetical: typing "car" should surface
    -- "Cardinal" above "Vascular Care".
    CASE WHEN name LIKE :prefix ESCAPE '\\' THEN 0 ELSE 1 END,
    name COLLATE NOCASE
  LIMIT ${SEARCH_LIMIT}
`);

const insertStmt = db.prepare(`
  INSERT INTO organizations (name, entity_type, address, city, state, zip, phone)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const byIdStmt = db.prepare(`SELECT * FROM organizations WHERE id = ?`);
const byNameStmt = db.prepare(`SELECT * FROM organizations WHERE name = ? COLLATE NOCASE`);

const toOrganization = (row) =>
  row && {
    id: row.id,
    name: row.name,
    entityType: row.entity_type,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    phone: row.phone,
  };

/** Escape LIKE wildcards so a user typing "%" searches for a literal "%". */
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function searchOrganizations(query) {
  const term = String(query ?? '').trim();
  if (term.length < 2) return []; // too short to be a useful search
  const escaped = escapeLike(term);
  return searchStmt.all({ pattern: `%${escaped}%`, prefix: `${escaped}%` }).map(toOrganization);
}

export function getOrganization(id) {
  return toOrganization(byIdStmt.get(id));
}

export function findOrganizationByName(name) {
  return toOrganization(byNameStmt.get(String(name ?? '').trim()));
}

/**
 * Create an organization.
 *
 * Returns `{ created: false, organization }` when the name is already taken
 * rather than throwing. A filer who types a name that already exists wants to
 * use that record, not read an error, so the caller hands the existing one back
 * to the UI and it gets selected.
 */
export function createOrganization(input) {
  const name = String(input.name).trim();

  const existing = findOrganizationByName(name);
  if (existing) return { created: false, organization: existing };

  try {
    const { lastInsertRowid } = insertStmt.run(
      name,
      blankToNull(input.entityType),
      blankToNull(input.address),
      blankToNull(input.city),
      blankToNull(input.state),
      blankToNull(input.zip),
      input.phone ? normalizePhone(input.phone) : null,
    );
    return { created: true, organization: getOrganization(lastInsertRowid) };
  } catch (err) {
    // Two requests creating the same name at once: one wins the unique index,
    // the other lands here and gets the winner's row.
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { created: false, organization: findOrganizationByName(name) };
    }
    throw err;
  }
}
