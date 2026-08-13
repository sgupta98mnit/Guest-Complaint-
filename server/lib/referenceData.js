// Picklists, status vocabulary, and decision definitions.
//
// Labels and descriptions are taken verbatim from the design handoff prototype,
// which treats copy as final-intent. This module is the single source for both
// the UI (served via /api/reference) and server-side validation, so the options
// a filer can pick and the values the server will accept cannot drift apart.

export const COMPLAINT_TYPES = [
  {
    value: 'Transactions',
    label: 'Transactions',
    description:
      'Claims and encounter information, payment and remittance advice, claim status, eligibility, enrollment, referrals and authorizations, coordination of benefits, premium payment.',
  },
  {
    value: 'Code sets',
    label: 'Code sets',
    description:
      'HCPCS, CPT-4, CDT, ICD-9, ICD-10, and NDC codes used for procedures, diagnoses, and drugs.',
  },
  {
    value: 'Unique identifiers',
    label: 'Unique identifiers',
    description: 'National Provider Identifier (NPI) and Employer Identification Number (EIN).',
  },
  {
    value: 'Operating rules',
    label: 'Operating rules',
    description: 'EFT/ERA, health care claim status, and eligibility for a health plan.',
  },
];

export const TRANSACTION_TYPES = [
  'Claims & encounter information (837)',
  'Eligibility inquiry & response (270/271)',
  'Claim status (276/277)',
  'Payment & remittance advice (835)',
  'Referrals & authorizations (278)',
];

export const COMPLAINANT_ROLES = [
  'Health care provider',
  'Billing service',
  'Clearinghouse',
  'Employer / plan sponsor',
  'Individual / patient',
];

export const ENTITY_TYPES = ['Health plan', 'Clearinghouse', 'Health care provider'];

// The prototype's state control lists only NY/CA/TX, which reads as placeholder
// content rather than intent - a national complaint form cannot ship with three
// states. Address fields are optional, so this only affects what a filer may
// pick, never whether they can file.
export const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID',
  'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO',
  'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA',
  'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

/** Intake decisions. `action` is stored; `status` is what the complaint becomes. */
export const DECISIONS = [
  {
    value: 'approve',
    label: 'Approve for intake',
    description:
      'Meets HIPAA administrative simplification criteria. Moves to enforcement intake.',
    status: 'approved_for_intake',
  },
  {
    value: 'deny',
    label: 'Deny for intake',
    description: 'Out of scope, duplicate, or unenforceable as filed.',
    status: 'denied_for_intake',
  },
  {
    value: 'needs_info',
    label: 'Needs more info',
    description: 'Internal hold. No notification is sent to the guest.',
    status: 'needs_more_info',
  },
];

export const ACTIONS = DECISIONS.map((d) => d.value);

export const STATUS_FOR_ACTION = Object.fromEntries(
  DECISIONS.map((d) => [d.value, d.status]),
);

/** Display label and pill colours per status, straight from the handoff tokens. */
export const STATUSES = {
  submitted: { label: 'Submitted', bg: '#e1e9f3', fg: '#1a4480' },
  in_review: { label: 'In review', bg: '#e8eaec', fg: '#3d4145' },
  approved_for_intake: { label: 'Approved for intake', bg: '#e6f2ea', fg: '#1f6431' },
  denied_for_intake: { label: 'Denied for intake', bg: '#f8e5e5', fg: '#9c2020' },
  needs_more_info: { label: 'Needs more info', bg: '#fdf1d6', fg: '#7a5300' },
};

export const STATUS_VALUES = Object.keys(STATUSES);

/** Queue filter chips, in the order the prototype shows them. */
export const STATUS_FILTERS = [
  'submitted',
  'needs_more_info',
  'approved_for_intake',
  'denied_for_intake',
];
