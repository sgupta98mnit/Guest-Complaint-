// Client-side mirror of the server's rules in server/lib/validation.js.
//
// This is duplication, and it is deliberate: the server copy is the one that
// protects the database and is never removed, while this copy exists so a user
// finds out about a bad ZIP code before a round trip. If the two ever disagree,
// the server wins - a submission that gets past this file still gets rejected,
// and the error comes back keyed the same way so it lands on the right field.
//
// In a larger codebase these would be one shared schema (Zod or JSON Schema)
// consumed by both sides. At this size, a second small pure module is cheaper
// than the build plumbing that sharing would require.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const TRACKING_ID_RE = /^CM-\d{2}-\d{5}$/;

const isBlank = (value) => String(value ?? '').trim() === '';
const digits = (value) => String(value ?? '').replace(/\D/g, '');

export const todayISO = () => new Date().toISOString().slice(0, 10);

/* --------------------------------------------------------------- steps -- */

export const STEPS = [
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'complaint-type', label: 'Complaint Type' },
  { id: 'complaint-details', label: 'Complaint Details' },
  { id: 'complainant-details', label: 'Complainant Details' },
  { id: 'fae-details', label: 'FAE Details' },
  { id: 'review-submit', label: 'Review & Submit' },
  { id: 'confirmation', label: 'Confirmation' },
];

/** Which error keys belong to which step - used to route server errors back. */
const STEP_FIELDS = {
  'complaint-type': ['complaint.complaintType'],
  'complaint-details': [
    'complaint.description',
    'complaint.actionsTaken',
    'complaint.incidentDate',
    'complaint.prevTrackingId',
    'complaint.transactionType',
  ],
  'complainant-details': [
    'complainant.orgName',
    'complainant.orgType',
    'complainant.firstName',
    'complainant.lastName',
    'complainant.addressLine1',
    'complainant.addressLine2',
    'complainant.city',
    'complainant.state',
    'complainant.zip',
    'complainant.email',
    'complainant.phone',
  ],
  'fae-details': [
    'fae.orgName',
    'fae.orgType',
    'fae.contactFirstName',
    'fae.contactLastName',
    'fae.addressLine1',
    'fae.addressLine2',
    'fae.city',
    'fae.state',
    'fae.zip',
    'fae.email',
    'fae.phone',
  ],
};

/**
 * Given a server error map, find the earliest step that owns any of the failed
 * fields. Without this, a validation failure raised at submit time would show a
 * summary on the review screen pointing at inputs the user cannot see.
 */
export function firstStepWithErrors(errors) {
  const keys = Object.keys(errors || {});
  if (keys.length === 0) return null;

  for (let index = 0; index < STEPS.length; index += 1) {
    const owned = STEP_FIELDS[STEPS[index].id];
    if (owned && keys.some((key) => owned.includes(key))) return index;
  }
  return null;
}

export const FIELD_LABELS = {
  'complaint.complaintType': 'Complaint type',
  'complaint.description': 'Complaint description',
  'complaint.actionsTaken': 'Actions taken',
  'complaint.incidentDate': 'Incident date',
  'complaint.prevTrackingId': 'Previous tracking ID',
  'complaint.transactionType': 'Complaint transaction type',
  'complainant.orgName': 'Complainant organization',
  'complainant.orgType': 'Organization type',
  'complainant.firstName': 'First name',
  'complainant.lastName': 'Last name',
  'complainant.city': 'City/town',
  'complainant.state': 'State/territory',
  'complainant.zip': 'ZIP code',
  'complainant.email': 'Email address',
  'complainant.phone': 'Contact phone number',
  'fae.orgName': 'FAE organization',
  'fae.orgType': 'Organization type',
  'fae.contactFirstName': 'First name',
  'fae.contactLastName': 'Last name',
  'fae.city': 'City/town',
  'fae.state': 'State/territory',
  'fae.zip': 'ZIP code',
  'fae.email': 'Contact email address',
  'fae.phone': 'Phone number',
};

/* ---------------------------------------------------------- per-step rules -- */

function checkContactBlock(section, data, errors, labels) {
  if (isBlank(data.email)) {
    errors[`${section}.email`] = `${labels.email} is required.`;
  } else if (!EMAIL_RE.test(data.email.trim())) {
    errors[`${section}.email`] = 'Enter a valid email address.';
  }

  if (isBlank(data.phone)) {
    errors[`${section}.phone`] = `${labels.phone} is required.`;
  } else {
    const count = digits(data.phone).length;
    if (count < 10 || count > 15) {
      errors[`${section}.phone`] = 'Enter a valid phone number with 10 to 15 digits.';
    }
  }

  if (!isBlank(data.zip) && !ZIP_RE.test(data.zip.trim())) {
    errors[`${section}.zip`] = 'Enter a valid ZIP code as 12345 or 12345-6789.';
  }
}

export function validateStep(stepId, form) {
  const errors = {};

  if (stepId === 'complaint-type') {
    if (isBlank(form.complaint.complaintType)) {
      errors['complaint.complaintType'] = 'Select a complaint type to continue.';
    }
  }

  if (stepId === 'complaint-details') {
    const { description, incidentDate, transactionType, prevTrackingId } = form.complaint;

    if (isBlank(description)) {
      errors['complaint.description'] = 'Complaint description is required.';
    } else if (description.trim().length > 10000) {
      errors['complaint.description'] = 'Complaint description must be 10,000 characters or fewer.';
    }

    if (isBlank(incidentDate)) {
      errors['complaint.incidentDate'] = 'Incident date is required.';
    } else if (incidentDate > todayISO()) {
      errors['complaint.incidentDate'] = 'Incident date cannot be in the future.';
    }

    if (isBlank(transactionType)) {
      errors['complaint.transactionType'] = 'Complaint transaction type is required.';
    }

    if (!isBlank(prevTrackingId) && !TRACKING_ID_RE.test(prevTrackingId.trim())) {
      errors['complaint.prevTrackingId'] = 'Previous tracking ID must look like CM-26-03384.';
    }
  }

  if (stepId === 'complainant-details') {
    const data = form.complainant;
    if (isBlank(data.orgName)) {
      errors['complainant.orgName'] = 'Complainant organization is required.';
    }
    if (isBlank(data.orgType)) {
      errors['complainant.orgType'] = 'Organization type is required.';
    }
    if (isBlank(data.firstName)) errors['complainant.firstName'] = 'First name is required.';
    if (isBlank(data.lastName)) errors['complainant.lastName'] = 'Last name is required.';

    checkContactBlock('complainant', data, errors, {
      email: 'Email address',
      phone: 'Contact phone number',
    });
  }

  if (stepId === 'fae-details') {
    const data = form.fae;
    if (isBlank(data.orgName)) errors['fae.orgName'] = 'FAE organization is required.';
    if (isBlank(data.contactFirstName)) errors['fae.contactFirstName'] = 'First name is required.';
    if (isBlank(data.contactLastName)) errors['fae.contactLastName'] = 'Last name is required.';

    checkContactBlock('fae', data, errors, {
      email: 'Contact email address',
      phone: 'Phone number',
    });
  }

  return errors;
}

/** Everything the wizard collects, empty. */
export function emptyForm() {
  return {
    complaint: {
      complaintType: '',
      description: '',
      actionsTaken: '',
      incidentDate: '',
      prevTrackingId: '',
      transactionType: '',
    },
    complainant: {
      anonymous: false,
      orgName: '',
      orgType: '',
      firstName: '',
      lastName: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zip: '',
      email: '',
      phone: '',
    },
    fae: {
      orgName: '',
      orgType: '',
      contactFirstName: '',
      contactLastName: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zip: '',
      email: '',
      phone: '',
    },
  };
}
