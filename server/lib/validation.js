import {
  COMPLAINT_TYPES,
  TRANSACTION_TYPES,
  ORG_TYPES,
  STATES,
  REVIEW_ACTIONS,
} from './referenceData.js';

// Server-side validation. The client validates the same rules for fast feedback,
// but this is the copy that actually protects the database - the client's
// dropdowns are just suggestions as far as the server is concerned.
//
// Every function returns a flat `{ 'section.field': 'message' }` map. The keys
// are namespaced by section so the wizard can route an error back to the step
// that owns it instead of dumping everything on the review screen.

const MAX = { short: 200, description: 10_000, note: 5_000 };

// Deliberately permissive. Fully validating an address per RFC 5322 is a
// well-known trap (and rejects legitimate addresses like `user+tag@host`); the
// only real proof an address works is sending to it, which is exactly what the
// OTP verification step does.
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

function isBlank(value) {
  return blankToNull(value) === null;
}

/** True only for a real calendar date - rejects 2026-02-30, which `new Date` happily accepts. */
function isRealDate(value) {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d
  );
}

function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

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
    // First error on a field wins - it's the most specific one we checked.
    if (!this.errors[key]) this.errors[key] = message;
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
    .required('description', complaint.description, 'Complaint description')
    .maxLength('description', complaint.description, MAX.description, 'Complaint description')
    .maxLength('actionsTaken', complaint.actionsTaken, MAX.description, 'Actions taken')
    .required('transactionType', complaint.transactionType, 'Complaint transaction type')
    .oneOf('transactionType', complaint.transactionType, TRANSACTION_TYPES, 'transaction type')
    .required('incidentDate', complaint.incidentDate, 'Incident date');

  const incidentDate = blankToNull(complaint.incidentDate);
  if (incidentDate) {
    if (!isRealDate(incidentDate)) {
      bag.add('incidentDate', 'Enter a valid date in YYYY-MM-DD format.');
    } else if (incidentDate > todayISO(now)) {
      // String comparison is safe here: ISO dates sort lexicographically.
      bag.add('incidentDate', 'Incident date cannot be in the future.');
    }
  }

  // Optional back-reference to an earlier filing. We check the shape but
  // deliberately do not check that the complaint exists - confirming or denying
  // that a tracking id is real would let anyone probe for valid ids.
  const prev = blankToNull(complaint.prevTrackingId);
  if (prev && !TRACKING_ID_RE.test(prev)) {
    bag.add('prevTrackingId', 'Previous tracking ID must look like CM-26-03384.');
  }

  return bag.errors;
}

export function validateComplainantSection(complainant = {}) {
  const bag = new ErrorBag('complainant');

  // Note that these stay required even when `anonymous` is true. Anonymity in
  // ASETT means "do not disclose my identity to the filed-against entity", not
  // "do not collect it" - CMS still needs to be able to reach the complainant.
  bag
    .required('orgName', complainant.orgName, 'Complainant organization')
    .maxLength('orgName', complainant.orgName, MAX.short, 'Complainant organization')
    .required('orgType', complainant.orgType, 'Organization type')
    .oneOf('orgType', complainant.orgType, ORG_TYPES, 'organization type')
    .required('firstName', complainant.firstName, 'First name')
    .maxLength('firstName', complainant.firstName, MAX.short, 'First name')
    .required('lastName', complainant.lastName, 'Last name')
    .maxLength('lastName', complainant.lastName, MAX.short, 'Last name')
    .required('email', complainant.email, 'Email address')
    .email('email', complainant.email, 'email address')
    .required('phone', complainant.phone, 'Contact phone number')
    .phone('phone', complainant.phone, 'phone number')
    .oneOf('state', complainant.state, STATES, 'state')
    .zip('zip', complainant.zip, 'ZIP code')
    .maxLength('addressLine1', complainant.addressLine1, MAX.short, 'Address line 1')
    .maxLength('addressLine2', complainant.addressLine2, MAX.short, 'Address line 2')
    .maxLength('city', complainant.city, MAX.short, 'City/town');

  return bag.errors;
}

export function validateFaeSection(fae = {}) {
  const bag = new ErrorBag('fae');

  bag
    .required('orgName', fae.orgName, 'FAE organization')
    .maxLength('orgName', fae.orgName, MAX.short, 'FAE organization')
    .oneOf('orgType', fae.orgType, ORG_TYPES, 'organization type')
    .required('contactFirstName', fae.contactFirstName, 'First name')
    .maxLength('contactFirstName', fae.contactFirstName, MAX.short, 'First name')
    .required('contactLastName', fae.contactLastName, 'Last name')
    .maxLength('contactLastName', fae.contactLastName, MAX.short, 'Last name')
    .required('email', fae.email, 'Contact email address')
    .email('email', fae.email, 'email address')
    .required('phone', fae.phone, 'Phone number')
    .phone('phone', fae.phone, 'phone number')
    .oneOf('state', fae.state, STATES, 'state')
    .zip('zip', fae.zip, 'ZIP code')
    .maxLength('addressLine1', fae.addressLine1, MAX.short, 'Address line 1')
    .maxLength('addressLine2', fae.addressLine2, MAX.short, 'Address line 2')
    .maxLength('city', fae.city, MAX.short, 'City/town');

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

/**
 * A new organization created inline from the wizard.
 *
 * Address and city/state/ZIP are required here even though they are optional on
 * the complaint itself: an organization record is reused across complaints, so
 * it is worth insisting it be complete at the point of creation rather than
 * accumulating half-filled records that every later filer inherits.
 */
export function validateOrganization(org = {}) {
  const bag = new ErrorBag('');

  bag
    .required('name', org.name, 'Organization name')
    .maxLength('name', org.name, MAX.short, 'Organization name')
    .required('addressLine1', org.addressLine1, 'Address line 1')
    .maxLength('addressLine1', org.addressLine1, MAX.short, 'Address line 1')
    .maxLength('addressLine2', org.addressLine2, MAX.short, 'Address line 2')
    .required('city', org.city, 'City/town')
    .maxLength('city', org.city, MAX.short, 'City/town')
    .required('state', org.state, 'State/province')
    .oneOf('state', org.state, STATES, 'state')
    .required('zip', org.zip, 'ZIP code')
    .zip('zip', org.zip, 'ZIP code')
    .phone('phone', org.phone, 'phone number');

  return bag.errors;
}

export function validateReview(payload = {}) {
  const bag = new ErrorBag('');

  bag
    .required('action', payload.action, 'Review action')
    .oneOf('action', payload.action, REVIEW_ACTIONS, 'review action')
    // The note is required for every action, including approval - the whole
    // point of the history table is that no status change is unexplained.
    .required('note', payload.note, 'Review note')
    .maxLength('note', payload.note, MAX.note, 'Review note');

  return bag.errors;
}

export const LIMITS = MAX;
