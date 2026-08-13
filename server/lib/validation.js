import {
  COMPLAINT_TYPES,
  TRANSACTION_TYPES,
  COMPLAINANT_ROLES,
  ENTITY_TYPES,
  STATES,
  ACTIONS,
} from './referenceData.js';

// Server-side validation. The client checks the same rules for fast feedback,
// but this is the copy that protects the database - as far as the server is
// concerned the client's dropdowns are only suggestions.
//
// Every function returns a flat `{ 'section.field': message }` map. Keys are
// namespaced by section so the wizard can route each message back to the step
// that owns it rather than dumping them all on the review screen.

const MAX = { short: 200, description: 4_000, actions: 4_000, note: 5_000 };

// Deliberately permissive. Fully validating an address per RFC 5322 is a known
// trap that rejects legitimate addresses; the only real proof an address works
// is sending to it.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TRACKING_ID_RE = /^CM-\d{2}-\d{5}$/;

export function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** Trim, and collapse empty strings to null so optional columns store NULL not ''. */
export function blankToNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

const isBlank = (value) => blankToNull(value) === null;

/** True only for a real calendar date - rejects 2026-02-30, which `new Date` accepts. */
function isRealDate(value) {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d
  );
}

const todayISO = (now = new Date()) => now.toISOString().slice(0, 10);

class ErrorBag {
  constructor(section) {
    this.section = section;
    this.errors = {};
  }

  #key(field) {
    return this.section ? `${this.section}.${field}` : field;
  }

  add(field, message) {
    const key = this.#key(field);
    if (!this.errors[key]) this.errors[key] = message; // first error on a field wins
    return this;
  }

  required(field, value, label) {
    if (isBlank(value)) this.add(field, `${label} is required.`);
    return this;
  }

  maxLength(field, value, limit, label) {
    if (!isBlank(value) && String(value).trim().length > limit) {
      this.add(field, `${label} must be ${limit.toLocaleString()} characters or fewer.`);
    }
    return this;
  }

  oneOf(field, value, allowed, label) {
    if (!isBlank(value) && !allowed.includes(String(value).trim())) {
      this.add(field, `Select a valid ${label}.`);
    }
    return this;
  }

  email(field, value, label) {
    if (!isBlank(value) && !EMAIL_RE.test(String(value).trim())) {
      this.add(field, `Enter a valid ${label}.`);
    }
    return this;
  }

  phone(field, value, label) {
    if (isBlank(value)) return this;
    const digits = normalizePhone(value);
    if (digits.length < 10 || digits.length > 15) {
      this.add(field, `Enter a valid ${label} with 10 to 15 digits.`);
    }
    return this;
  }

  zip(field, value, label) {
    if (!isBlank(value) && !ZIP_RE.test(String(value).trim())) {
      this.add(field, `Enter a valid ${label} as 12345 or 12345-6789.`);
    }
    return this;
  }
}

const COMPLAINT_TYPE_VALUES = COMPLAINT_TYPES.map((t) => t.value);

export function validateComplaintSection(complaint = {}, now = new Date()) {
  const bag = new ErrorBag('complaint');

  bag
    .required('complaintType', complaint.complaintType, 'Complaint type')
    .oneOf('complaintType', complaint.complaintType, COMPLAINT_TYPE_VALUES, 'complaint type')
    .required('description', complaint.description, 'A description of what happened')
    .maxLength('description', complaint.description, MAX.description, 'The description')
    .maxLength('actionsTaken', complaint.actionsTaken, MAX.actions, 'Actions already taken')
    .required('transactionType', complaint.transactionType, 'Transaction type')
    .oneOf('transactionType', complaint.transactionType, TRANSACTION_TYPES, 'transaction type')
    .required('incidentDate', complaint.incidentDate, 'Incident date');

  const incidentDate = blankToNull(complaint.incidentDate);
  if (incidentDate) {
    if (!isRealDate(incidentDate)) {
      bag.add('incidentDate', 'Enter a valid date in YYYY-MM-DD format.');
    } else if (incidentDate > todayISO(now)) {
      // ISO dates sort lexicographically, so a string comparison is correct.
      bag.add('incidentDate', 'Incident date cannot be in the future.');
    }
  }

  // Shape is checked but existence is not: confirming that a tracking ID is real
  // would let anyone probe for valid ones through a public endpoint.
  const previous = blankToNull(complaint.previousTrackingId);
  if (previous && !TRACKING_ID_RE.test(previous)) {
    bag.add('previousTrackingId', 'Previous tracking ID must look like CM-26-03384.');
  }

  return bag.errors;
}

export function validateComplainantSection(complainant = {}) {
  const bag = new ErrorBag('complainant');
  const anonymous = Boolean(complainant.anonymous);

  // Role is required either way - it frames the complaint regardless of whether
  // the filer is identified.
  bag
    .required('role', complainant.role, 'Your role')
    .oneOf('role', complainant.role, COMPLAINANT_ROLES, 'role');

  // Identity is required only when the filer is not anonymous. Filing
  // anonymously withholds these from the filed-against entity, with the caveat
  // that CMS may be unable to investigate without them.
  if (!anonymous) {
    bag
      .required('firstName', complainant.firstName, 'First name')
      .required('lastName', complainant.lastName, 'Last name')
      .required('email', complainant.email, 'Email');
  }

  bag
    .maxLength('firstName', complainant.firstName, MAX.short, 'First name')
    .maxLength('lastName', complainant.lastName, MAX.short, 'Last name')
    .email('email', complainant.email, 'email address')
    .phone('phone', complainant.phone, 'phone number');

  return bag.errors;
}

export function validateFaeSection(fae = {}) {
  const bag = new ErrorBag('fae');

  bag
    .required('orgName', fae.orgName, 'Organization name')
    .maxLength('orgName', fae.orgName, MAX.short, 'Organization name')
    .required('entityType', fae.entityType, 'Entity type')
    .oneOf('entityType', fae.entityType, ENTITY_TYPES, 'entity type')
    .maxLength('address', fae.address, MAX.short, 'Street address')
    .maxLength('city', fae.city, MAX.short, 'City')
    .oneOf('state', fae.state, STATES, 'state')
    .zip('zip', fae.zip, 'ZIP code')
    .phone('phone', fae.phone, 'phone number');

  return bag.errors;
}

/** Full submission check. Returns `{}` when the payload is acceptable. */
export function validateSubmission(payload = {}, now = new Date()) {
  return {
    ...validateComplaintSection(payload.complaint, now),
    ...validateComplainantSection(payload.complainant),
    ...validateFaeSection(payload.fae),
  };
}

export function validateAction(payload = {}) {
  const bag = new ErrorBag('');

  bag
    .required('action', payload.action, 'A decision')
    .oneOf('action', payload.action, ACTIONS, 'decision')
    // Required for every action, including approval - the point of the history
    // is that no status change is left unexplained.
    .required('note', payload.note, 'Reviewer note')
    .maxLength('note', payload.note, MAX.note, 'Reviewer note');

  return bag.errors;
}

export const LIMITS = MAX;
