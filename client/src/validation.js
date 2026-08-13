// Client-side mirror of server/lib/validation.js.
//
// The duplication is deliberate: the server copy protects the database and is
// never removed, while this copy exists so a filer finds out about a bad ZIP
// before a round trip. Both return identically-keyed maps, so if they ever
// disagree the server simply wins and its message still lands on the right
// field. At a larger size these would be one shared schema (Zod) consumed by
// both sides.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;
const TRACKING_ID_RE = /^CM-\d{2}-\d{5}$/;

const isBlank = (value) => String(value ?? '').trim() === '';
const digits = (value) => String(value ?? '').replace(/\D/g, '');

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const DESCRIPTION_MAX = 4000;

/* --------------------------------------------------------------- steps -- */

export const STEPS = [
  { id: 'start', label: 'Getting started', hint: "What you'll need" },
  { id: 'type', label: 'Complaint type', hint: 'Standard at issue' },
  { id: 'details', label: 'Complaint details', hint: 'Description & dates' },
  { id: 'complainant', label: 'Your information', hint: 'Contact or anonymous' },
  { id: 'fae', label: 'Filed-against entity', hint: 'Who the complaint is about' },
  { id: 'review', label: 'Review & submit', hint: 'Check before sending' },
  { id: 'confirm', label: 'Confirmation', hint: 'Tracking ID' },
];

export const STEP_BLURBS = {
  start: 'Anyone can file a HIPAA administrative simplification complaint. No account needed.',
  type: 'Tell us which standard the complaint concerns.',
  details: 'Describe what happened and when. Be as specific as you can.',
  complainant: 'Your contact details, or file anonymously.',
  fae: 'Identify the organization the complaint is about.',
  review: "Check every answer. You can't change a guest complaint after you submit it.",
  confirm: 'Your complaint is on file with CMS.',
};

/** Which error keys belong to which step, used to route server errors back. */
const STEP_FIELDS = {
  type: ['complaint.complaintType'],
  details: [
    'complaint.description',
    'complaint.actionsTaken',
    'complaint.incidentDate',
    'complaint.transactionType',
    'complaint.previousTrackingId',
  ],
  complainant: [
    'complainant.firstName',
    'complainant.lastName',
    'complainant.email',
    'complainant.phone',
    'complainant.role',
  ],
  fae: [
    'fae.orgName',
    'fae.entityType',
    'fae.address',
    'fae.city',
    'fae.state',
    'fae.zip',
    'fae.phone',
  ],
};

/**
 * The earliest step owning any failed field.
 *
 * Without this, a rejection raised at submit time would show a summary on the
 * review screen pointing at inputs the filer cannot see.
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
  'complaint.description': 'What happened',
  'complaint.actionsTaken': 'Actions already taken',
  'complaint.incidentDate': 'Incident date',
  'complaint.transactionType': 'Transaction type',
  'complaint.previousTrackingId': 'Previous complaint tracking ID',
  'complainant.firstName': 'First name',
  'complainant.lastName': 'Last name',
  'complainant.email': 'Email',
  'complainant.phone': 'Phone',
  'complainant.role': 'Your role',
  'fae.orgName': 'Organization name',
  'fae.entityType': 'Entity type',
  'fae.address': 'Street address',
  'fae.city': 'City',
  'fae.state': 'State',
  'fae.zip': 'ZIP',
  'fae.phone': 'Contact phone',
};

/* ----------------------------------------------------------- per-step rules -- */

export function validateStep(stepId, form) {
  const errors = {};

  if (stepId === 'type' && isBlank(form.complaint.complaintType)) {
    errors['complaint.complaintType'] = 'Select a complaint type to continue.';
  }

  if (stepId === 'details') {
    const { description, incidentDate, transactionType, previousTrackingId } = form.complaint;

    if (isBlank(description)) {
      errors['complaint.description'] = 'A description of what happened is required.';
    } else if (description.trim().length > DESCRIPTION_MAX) {
      errors['complaint.description'] =
        `The description must be ${DESCRIPTION_MAX.toLocaleString()} characters or fewer.`;
    }

    if (isBlank(incidentDate)) {
      errors['complaint.incidentDate'] = 'Incident date is required.';
    } else if (incidentDate > todayISO()) {
      errors['complaint.incidentDate'] = 'Incident date cannot be in the future.';
    }

    if (isBlank(transactionType)) {
      errors['complaint.transactionType'] = 'Transaction type is required.';
    }

    if (!isBlank(previousTrackingId) && !TRACKING_ID_RE.test(previousTrackingId.trim())) {
      errors['complaint.previousTrackingId'] =
        'Previous tracking ID must look like CM-26-03384.';
    }
  }

  if (stepId === 'complainant') {
    const data = form.complainant;

    if (isBlank(data.role)) errors['complainant.role'] = 'Your role is required.';

    // Identity is required only when not filing anonymously.
    if (!data.anonymous) {
      if (isBlank(data.firstName)) errors['complainant.firstName'] = 'First name is required.';
      if (isBlank(data.lastName)) errors['complainant.lastName'] = 'Last name is required.';
      if (isBlank(data.email)) {
        errors['complainant.email'] = 'Email is required.';
      }
    }

    if (!isBlank(data.email) && !EMAIL_RE.test(data.email.trim())) {
      errors['complainant.email'] = 'Enter a valid email address.';
    }

    if (!isBlank(data.phone)) {
      const count = digits(data.phone).length;
      if (count < 10 || count > 15) {
        errors['complainant.phone'] = 'Enter a valid phone number with 10 to 15 digits.';
      }
    }
  }

  if (stepId === 'fae') {
    const data = form.fae;
    if (isBlank(data.orgName)) errors['fae.orgName'] = 'Organization name is required.';
    if (isBlank(data.entityType)) errors['fae.entityType'] = 'Entity type is required.';

    if (!isBlank(data.zip) && !ZIP_RE.test(data.zip.trim())) {
      errors['fae.zip'] = 'Enter a valid ZIP code as 12345 or 12345-6789.';
    }

    if (!isBlank(data.phone)) {
      const count = digits(data.phone).length;
      if (count < 10 || count > 15) {
        errors['fae.phone'] = 'Enter a valid phone number with 10 to 15 digits.';
      }
    }
  }

  return errors;
}

/** Everything the wizard collects, empty. */
export function emptyForm() {
  return {
    complaint: {
      complaintType: '',
      transactionType: '',
      description: '',
      actionsTaken: '',
      incidentDate: '',
      previousTrackingId: '',
    },
    complainant: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: '',
      anonymous: false,
    },
    fae: {
      orgName: '',
      entityType: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      phone: '',
    },
  };
}
