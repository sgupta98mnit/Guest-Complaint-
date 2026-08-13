import { db } from '../db/index.js';
import { nextTrackingId } from './trackingId.js';
import { blankToNull, normalizePhone } from './validation.js';
import { STATUS_FOR_ACTION } from './referenceData.js';

// All complaint persistence lives here. Routes handle HTTP, validation holds the
// rules, and this module owns SQL - so the seed script and the test suite write
// through exactly the code path the API uses rather than a parallel copy that
// can quietly drift.
//
// Every statement is prepared once and parameterized. No SQL string is ever
// assembled from request data, which makes injection structurally impossible
// rather than a rule someone has to remember.

const insertComplaint = db.prepare(`
  INSERT INTO complaints (
    tracking_id, complaint_type, transaction_type, description,
    actions_taken, incident_date, previous_tracking_id, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertComplainant = db.prepare(`
  INSERT INTO complainants (
    complaint_id, first_name, last_name, email, phone, role, anonymous
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertFae = db.prepare(`
  INSERT INTO filed_against_entities (
    complaint_id, org_name, entity_type, address, city, state, zip, phone
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAction = db.prepare(`
  INSERT INTO complaint_actions (complaint_id, reviewer_name, action, note)
  VALUES (?, ?, ?, ?)
`);

const updateStatus = db.prepare(`UPDATE complaints SET status = ? WHERE id = ?`);

const selectList = db.prepare(`
  SELECT
    c.id, c.tracking_id, c.complaint_type, c.status, c.incident_date, c.created_at,
    f.org_name        AS fae_org_name,
    cp.first_name     AS first_name,
    cp.last_name      AS last_name,
    cp.role           AS role,
    cp.anonymous      AS anonymous,
    (SELECT COUNT(*) FROM complaint_actions a WHERE a.complaint_id = c.id) AS action_count,
    (SELECT a.reviewer_name FROM complaint_actions a
      WHERE a.complaint_id = c.id ORDER BY a.id DESC LIMIT 1)              AS last_reviewer
  FROM complaints c
  LEFT JOIN filed_against_entities f ON f.complaint_id = c.id
  LEFT JOIN complainants cp         ON cp.complaint_id = c.id
  WHERE (:status IS NULL OR c.status = :status)
  ORDER BY c.created_at DESC, c.id DESC
`);

const selectStatusCounts = db.prepare(`
  SELECT status, COUNT(*) AS n FROM complaints GROUP BY status
`);

const selectComplaint = db.prepare(`SELECT * FROM complaints WHERE id = ?`);
const selectComplainant = db.prepare(`SELECT * FROM complainants WHERE complaint_id = ?`);
const selectFae = db.prepare(`SELECT * FROM filed_against_entities WHERE complaint_id = ?`);
const selectActions = db.prepare(`
  SELECT id, reviewer_name, action, note, created_at
  FROM complaint_actions
  WHERE complaint_id = ?
  ORDER BY created_at DESC, id DESC
`);

/* ---------------------------------------------------------------- mappers -- */
// snake_case in the database, camelCase over the wire.

const toComplaint = (row) => ({
  id: row.id,
  trackingId: row.tracking_id,
  complaintType: row.complaint_type,
  transactionType: row.transaction_type,
  description: row.description,
  actionsTaken: row.actions_taken,
  incidentDate: row.incident_date,
  previousTrackingId: row.previous_tracking_id,
  status: row.status,
  createdAt: row.created_at,
});

const toComplainant = (row) =>
  row && {
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    anonymous: Boolean(row.anonymous),
  };

const toFae = (row) =>
  row && {
    orgName: row.org_name,
    entityType: row.entity_type,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    phone: row.phone,
  };

const toAction = (row) => ({
  id: row.id,
  reviewerName: row.reviewer_name,
  action: row.action,
  note: row.note,
  createdAt: row.created_at,
});

/** How the filer is described in the queue - name and role, or the anonymous label. */
function filerLabel(row) {
  if (row.anonymous) return 'Anonymous complainant';
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return [name, row.role].filter(Boolean).join(' · ');
}

/* ------------------------------------------------------------------ writes -- */

/**
 * Persist a whole submission atomically.
 *
 * The tracking id is reserved inside this transaction too, so a failed insert
 * never burns a number and two simultaneous submissions cannot collide on one.
 * A complaint without its complainant and filed-against rows would be unusable
 * to a reviewer, so all three inserts land together or none do.
 */
export const persistSubmission = db.transaction(
  ({ complaint, complainant, fae }, { status = 'submitted', createdAt } = {}) => {
    const trackingId = nextTrackingId();

    const { lastInsertRowid: complaintId } = insertComplaint.run(
      trackingId,
      complaint.complaintType,
      complaint.transactionType,
      complaint.description,
      blankToNull(complaint.actionsTaken),
      complaint.incidentDate,
      blankToNull(complaint.previousTrackingId),
      status,
    );

    // Seed data backdates rows so the queue is not all one timestamp.
    if (createdAt) {
      db.prepare(`UPDATE complaints SET created_at = ? WHERE id = ?`).run(createdAt, complaintId);
    }

    const anonymous = Boolean(complainant.anonymous);
    insertComplainant.run(
      complaintId,
      blankToNull(complainant.firstName),
      blankToNull(complainant.lastName),
      blankToNull(complainant.email),
      complainant.phone ? normalizePhone(complainant.phone) : null,
      blankToNull(complainant.role),
      anonymous ? 1 : 0,
    );

    insertFae.run(
      complaintId,
      blankToNull(fae.orgName),
      blankToNull(fae.entityType),
      blankToNull(fae.address),
      blankToNull(fae.city),
      blankToNull(fae.state),
      blankToNull(fae.zip),
      fae.phone ? normalizePhone(fae.phone) : null,
    );

    return { complaintId, trackingId };
  },
);

/**
 * Record an intake decision.
 *
 * `complaints.status` is denormalized so the queue never has to look at the
 * action log. That is only safe because these two writes cannot be separated -
 * the status column and the audit trail move together or not at all.
 */
export const persistAction = db.transaction((complaintId, action, note, reviewerName) => {
  const { lastInsertRowid: actionId } = insertAction.run(complaintId, reviewerName, action, note);
  updateStatus.run(STATUS_FOR_ACTION[action], complaintId);
  return actionId;
});

/* ------------------------------------------------------------------ reads -- */

export function listComplaints({ status = null } = {}) {
  return selectList.all({ status }).map((row) => ({
    id: row.id,
    trackingId: row.tracking_id,
    complaintType: row.complaint_type,
    status: row.status,
    incidentDate: row.incident_date,
    createdAt: row.created_at,
    faeOrgName: row.fae_org_name,
    filer: filerLabel(row),
    anonymous: Boolean(row.anonymous),
    actionCount: row.action_count,
    lastReviewer: row.last_reviewer,
  }));
}

/** Totals per status for the queue's stat tiles. */
export function statusCounts() {
  const counts = {};
  for (const { status, n } of selectStatusCounts.all()) counts[status] = n;
  return counts;
}

export function complaintExists(id) {
  return Boolean(selectComplaint.get(id));
}

export function getComplaintDetail(id) {
  const row = selectComplaint.get(id);
  if (!row) return null;
  return {
    complaint: toComplaint(row),
    complainant: toComplainant(selectComplainant.get(id)),
    fae: toFae(selectFae.get(id)),
    actions: selectActions.all(id).map(toAction),
  };
}

export function getComplaintWithActions(id) {
  return {
    complaint: toComplaint(selectComplaint.get(id)),
    actions: selectActions.all(id).map(toAction),
  };
}
