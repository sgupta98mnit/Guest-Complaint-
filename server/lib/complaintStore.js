import { db } from '../db/index.js';
import { nextTrackingId } from './trackingId.js';
import { blankToNull, normalizePhone } from './validation.js';

// All complaint persistence lives here. Routes handle HTTP, validation handles
// rules, and this module owns SQL - so the seed script and the test suite write
// through exactly the same code path the API does, rather than a parallel copy
// that can quietly drift.
//
// Every statement is prepared once and parameterized. No SQL string is ever
// assembled from request data, which makes injection a structural impossibility
// rather than a rule someone has to remember.

const insertComplaint = db.prepare(`
  INSERT INTO complaints (
    tracking_id, complaint_type, description, actions_taken,
    incident_date, prev_tracking_id, transaction_type, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertComplainant = db.prepare(`
  INSERT INTO complainants (
    complaint_id, anonymous, org_id, org_name, org_type, first_name, last_name,
    address_line1, address_line2, city, state, zip, email, phone
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertFae = db.prepare(`
  INSERT INTO fae_entities (
    complaint_id, org_id, org_name, org_type, contact_first_name, contact_last_name,
    address_line1, address_line2, city, state, zip, email, phone
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertReview = db.prepare(`
  INSERT INTO complaint_reviews (complaint_id, action, note, reviewer)
  VALUES (?, ?, ?, ?)
`);

const updateStatus = db.prepare(`UPDATE complaints SET status = ? WHERE id = ?`);

const selectList = db.prepare(`
  SELECT
    c.id, c.tracking_id, c.complaint_type, c.transaction_type,
    c.status, c.incident_date, c.created_at,
    f.org_name   AS fae_org_name,
    cp.anonymous AS complainant_anonymous,
    cp.org_name  AS complainant_org_name,
    (SELECT COUNT(*) FROM complaint_reviews r WHERE r.complaint_id = c.id) AS review_count
  FROM complaints c
  LEFT JOIN fae_entities f  ON f.complaint_id  = c.id
  LEFT JOIN complainants cp ON cp.complaint_id = c.id
  WHERE (:status IS NULL OR c.status = :status)
  ORDER BY c.created_at DESC, c.id DESC
`);

const selectComplaint = db.prepare(`SELECT * FROM complaints WHERE id = ?`);
const selectComplainant = db.prepare(`SELECT * FROM complainants WHERE complaint_id = ?`);
const selectFae = db.prepare(`SELECT * FROM fae_entities WHERE complaint_id = ?`);
const selectReviews = db.prepare(`
  SELECT id, action, note, reviewer, created_at
  FROM complaint_reviews
  WHERE complaint_id = ?
  ORDER BY created_at ASC, id ASC
`);

export const VALID_STATUSES = ['submitted', 'approved', 'denied', 'needs_info'];

/* ---------------------------------------------------------------- mappers -- */
// snake_case in the database, camelCase over the wire.

const toComplaint = (row) => ({
  id: row.id,
  trackingId: row.tracking_id,
  complaintType: row.complaint_type,
  description: row.description,
  actionsTaken: row.actions_taken,
  incidentDate: row.incident_date,
  prevTrackingId: row.prev_tracking_id,
  transactionType: row.transaction_type,
  status: row.status,
  createdAt: row.created_at,
});

const toComplainant = (row) =>
  row && {
    anonymous: Boolean(row.anonymous),
    orgId: row.org_id,
    orgName: row.org_name,
    orgType: row.org_type,
    firstName: row.first_name,
    lastName: row.last_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    email: row.email,
    phone: row.phone,
  };

const toFae = (row) =>
  row && {
    orgId: row.org_id,
    orgName: row.org_name,
    orgType: row.org_type,
    contactFirstName: row.contact_first_name,
    contactLastName: row.contact_last_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    email: row.email,
    phone: row.phone,
  };

const toReview = (row) => ({
  id: row.id,
  action: row.action,
  note: row.note,
  reviewer: row.reviewer,
  createdAt: row.created_at,
});

/* ------------------------------------------------------------------ writes -- */

/**
 * Persist a whole submission atomically.
 *
 * The tracking id is reserved inside this transaction, so simultaneous
 * submissions cannot collide on one and a failed insert never burns a number.
 *
 * A complaint row without its complainant and FAE rows would be unusable to a
 * reviewer, so all three inserts succeed together or none of them land.
 */
export const persistSubmission = db.transaction(
  ({ complaint, complainant, fae }, { status = 'submitted' } = {}) => {
    const trackingId = nextTrackingId();

    const { lastInsertRowid: complaintId } = insertComplaint.run(
      trackingId,
      complaint.complaintType,
      complaint.description,
      blankToNull(complaint.actionsTaken),
      complaint.incidentDate,
      blankToNull(complaint.prevTrackingId),
      complaint.transactionType,
      status,
    );

    insertComplainant.run(
      complaintId,
      complainant.anonymous ? 1 : 0,
      complainant.orgId ?? null,
      blankToNull(complainant.orgName),
      blankToNull(complainant.orgType),
      blankToNull(complainant.firstName),
      blankToNull(complainant.lastName),
      blankToNull(complainant.addressLine1),
      blankToNull(complainant.addressLine2),
      blankToNull(complainant.city),
      blankToNull(complainant.state),
      blankToNull(complainant.zip),
      blankToNull(complainant.email),
      normalizePhone(complainant.phone),
    );

    insertFae.run(
      complaintId,
      fae.orgId ?? null,
      blankToNull(fae.orgName),
      blankToNull(fae.orgType),
      blankToNull(fae.contactFirstName),
      blankToNull(fae.contactLastName),
      blankToNull(fae.addressLine1),
      blankToNull(fae.addressLine2),
      blankToNull(fae.city),
      blankToNull(fae.state),
      blankToNull(fae.zip),
      blankToNull(fae.email),
      normalizePhone(fae.phone),
    );

    return { complaintId, trackingId };
  },
);

/**
 * Record a reviewer decision.
 *
 * `complaints.status` is denormalized so the list query never has to look at the
 * history table. That denormalization is only safe because these two writes
 * cannot be separated - the status column and the audit trail move together or
 * not at all.
 */
export const persistReview = db.transaction((complaintId, action, note, reviewer) => {
  const { lastInsertRowid: reviewId } = insertReview.run(complaintId, action, note, reviewer);
  updateStatus.run(action, complaintId);
  return reviewId;
});

/* ------------------------------------------------------------------ reads -- */

export function listComplaints({ status = null } = {}) {
  return selectList.all({ status }).map((row) => ({
    id: row.id,
    trackingId: row.tracking_id,
    complaintType: row.complaint_type,
    transactionType: row.transaction_type,
    status: row.status,
    incidentDate: row.incident_date,
    createdAt: row.created_at,
    faeOrgName: row.fae_org_name,
    complainantOrgName: row.complainant_org_name,
    complainantAnonymous: Boolean(row.complainant_anonymous),
    reviewCount: row.review_count,
  }));
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
    reviews: selectReviews.all(id).map(toReview),
  };
}

export function getComplaintWithReviews(id) {
  return {
    complaint: toComplaint(selectComplaint.get(id)),
    reviews: selectReviews.all(id).map(toReview),
  };
}
