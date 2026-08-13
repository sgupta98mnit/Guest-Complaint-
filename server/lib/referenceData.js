// Small hardcoded sample lists standing in for the sandbox's full Salesforce
// picklists. Not exhaustive on purpose - see README "What I cut" section.

export const COMPLAINT_TYPES = [
  {
    value: 'Transactions',
    label: 'Transactions',
    description:
      'Claims and encounter information, payment and remittance advice, claims status, eligibility, enrollment and disenrollment, referrals and authorizations, coordination of benefits and premium payment.',
  },
  {
    value: 'Code Sets',
    label: 'Code Sets',
    description:
      'HCPCS, CPT-4, CDT, ICD-9, ICD-10, and NDC codes used for procedures, diagnoses, and drugs.',
  },
  {
    value: 'Unique Identifiers',
    label: 'Unique Identifiers',
    description: 'National Provider Identifier (NPI), Employer Identification Number (EIN).',
  },
  {
    value: 'Operating Rules',
    label: 'Operating Rules',
    description:
      'Electronic Funds Transfer/Electronic Remittance Advice (EFT/ERA), Health Care Claim Status, and Eligibility for a Health Plan.',
  },
];

export const TRANSACTION_TYPES = [
  'Healthcare Claim - Institutional (837I)',
  'Healthcare Claim - Professional (837P)',
  'Eligibility Inquiry/Response (270/271)',
  'Claim Status Request/Response (276/277)',
  'Payment/Remittance Advice (835)',
];

export const ORG_TYPES = [
  'Covered Health Care Provider',
  'Health Plan',
  'Health Care Clearinghouse',
  'Business Associate',
  'Other',
];

export const STATES = [
  'New York',
  'California',
  'Texas',
  'Florida',
  'Illinois',
  'Pennsylvania',
];

export const REVIEW_ACTIONS = ['approved', 'denied', 'needs_info'];
