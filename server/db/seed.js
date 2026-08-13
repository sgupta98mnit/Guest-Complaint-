import { db } from './index.js';
import { persistSubmission, persistAction } from '../lib/complaintStore.js';

// Synthetic demo data, mirroring the rows shown in the design prototype so the
// queue and its stat tiles look like the handoff. Entirely fabricated - no real
// people, organizations, or health information.
//
// Run with `npm run seed`, or `npm run seed:reset` to wipe first.

const RESET = process.argv.includes('--reset');

const DESCRIPTION =
  'The health plan rejected our 837P claims for three consecutive months without returning a compliant 277CA acknowledgement. Without the acknowledgement we cannot determine the rejection reason, and roughly 1,400 claims are unresolved. The plan’s portal shows the claims as "not received."';

const ACTIONS_TAKEN =
  'Four support calls (Jun 3, Jun 19, Jul 2, Jul 28) and two written escalations to the plan’s EDI operations team. No substantive response received.';

/** Oldest first, so tracking IDs ascend the way the prototype shows them. */
const SUBMISSIONS = [
  {
    createdAt: '2026-08-05 09:12:00',
    complaint: {
      complaintType: 'Transactions',
      transactionType: 'Claims & encounter information (837)',
      description: DESCRIPTION,
      actionsTaken: ACTIONS_TAKEN,
      incidentDate: '2026-05-14',
    },
    complainant: {
      firstName: 'Marcus',
      lastName: 'Feld',
      email: 'm.feld@example.org',
      phone: '5550148823',
      role: 'Health care provider',
      anonymous: false,
    },
    fae: {
      orgName: 'Cardinal Health Plan of New York',
      entityType: 'Health plan',
      address: '480 Rivermont Ave',
      city: 'Albany',
      state: 'NY',
      zip: '12207',
      phone: '5185550188',
    },
    action: {
      action: 'approve',
      note: 'Transaction non-compliance is clearly documented with 837P/277CA evidence. Routing to enforcement intake.',
    },
  },
  {
    createdAt: '2026-08-08 11:40:00',
    complaint: {
      complaintType: 'Operating rules',
      transactionType: 'Claim status (276/277)',
      description:
        'The clearinghouse is not returning the CORE-required acknowledgement within the mandated window, leaving submitted claims in an unknown state for days at a time.',
      actionsTaken: 'Opened two support tickets; both were closed without resolution.',
      incidentDate: '2026-06-02',
    },
    complainant: {
      role: 'Clearinghouse',
      anonymous: true,
    },
    fae: {
      orgName: 'Meridian Claims Clearinghouse',
      entityType: 'Clearinghouse',
      address: '2100 Gateway Boulevard',
      city: 'Chicago',
      state: 'IL',
      zip: '60601',
      phone: '3125550170',
    },
    action: {
      action: 'needs_info',
      note: 'Operating-rules claim lacks the EFT/ERA trace numbers. Internal hold — no return channel to guest filer.',
    },
  },
  {
    createdAt: '2026-08-10 14:02:00',
    complaint: {
      complaintType: 'Unique identifiers',
      transactionType: 'Eligibility inquiry & response (270/271)',
      description:
        'The health plan requires a legacy internal provider number instead of the NPI on eligibility inquiries, and rejects 270 transactions carrying only the NPI.',
      actionsTaken: 'Escalated to the plan network representative twice.',
      incidentDate: '2026-04-21',
    },
    complainant: {
      firstName: 'Elliot',
      lastName: 'Vance',
      email: 'e.vance@example.org',
      phone: '5125550133',
      role: 'Health care provider',
      anonymous: false,
    },
    fae: {
      orgName: 'Summit Mutual Health',
      entityType: 'Health plan',
      address: '500 Summit Tower',
      city: 'Dallas',
      state: 'TX',
      zip: '75201',
      phone: '2145550164',
    },
    action: {
      action: 'deny',
      note: 'NPI dispute is a credentialing matter, not an administrative simplification violation. Referred out.',
    },
  },
  {
    createdAt: '2026-08-11 08:25:00',
    complaint: {
      complaintType: 'Code sets',
      transactionType: 'Payment & remittance advice (835)',
      description:
        'Remittance advice returns proprietary adjustment codes rather than the adopted CARC/RARC code set, which makes automated posting impossible.',
      actionsTaken: '',
      incidentDate: '2026-07-30',
    },
    complainant: {
      firstName: 'Priya',
      lastName: 'Nandan',
      email: 'p.nandan@example.org',
      phone: '3055550127',
      role: 'Health care provider',
      anonymous: false,
    },
    fae: {
      orgName: 'Atlantic Coast Benefit Administrators',
      entityType: 'Health plan',
      address: '410 Biscayne Avenue',
      city: 'Miami',
      state: 'FL',
      zip: '33130',
      phone: '3055550191',
    },
    action: null,
  },
  {
    createdAt: '2026-08-12 10:05:00',
    status: 'in_review',
    complaint: {
      complaintType: 'Transactions',
      transactionType: 'Referrals & authorizations (278)',
      description:
        'Authorization responses arrive outside the required response window, and roughly a third return no 278 response at all.',
      actionsTaken: 'Logged nineteen instances over six weeks and sent a summary to the plan.',
      incidentDate: '2026-05-14',
    },
    complainant: {
      firstName: 'Ray',
      lastName: 'Kimura',
      email: 'r.kimura@example.org',
      phone: '2065550110',
      role: 'Billing service',
      anonymous: false,
    },
    fae: {
      orgName: 'Lakeside Behavioral Group',
      entityType: 'Health care provider',
      address: '77 Shoreline Road',
      city: 'Rochester',
      state: 'NY',
      zip: '14604',
      phone: '5855550119',
    },
    action: null,
  },
  {
    createdAt: '2026-08-12 16:30:00',
    complaint: {
      complaintType: 'Transactions',
      transactionType: 'Claims & encounter information (837)',
      description:
        'Claims submitted electronically are acknowledged as received and then silently dropped, with no rejection returned on any channel.',
      actionsTaken: 'Three calls to provider services over six weeks; no substantive response.',
      incidentDate: '2026-06-30',
    },
    complainant: {
      role: 'Billing service',
      anonymous: true,
    },
    fae: {
      orgName: 'Northgate Physician Network',
      entityType: 'Health care provider',
      address: '19 Commerce Street',
      city: 'Austin',
      state: 'TX',
      zip: '78701',
      phone: '5125550144',
    },
    action: null,
  },
  {
    createdAt: '2026-08-13 09:48:00',
    complaint: {
      complaintType: 'Transactions',
      transactionType: 'Claims & encounter information (837)',
      description: DESCRIPTION,
      actionsTaken: ACTIONS_TAKEN,
      incidentDate: '2026-05-14',
    },
    complainant: {
      firstName: 'Amara',
      lastName: 'Osei',
      email: 'a.osei@example.org',
      phone: '5550148823',
      role: 'Billing service',
      anonymous: false,
    },
    fae: {
      orgName: 'Cardinal Health Plan of New York',
      entityType: 'Health plan',
      address: '480 Rivermont Ave',
      city: 'Albany',
      state: 'NY',
      zip: '12207',
      phone: '5185550188',
    },
    action: null,
  },
  {
    createdAt: '2026-08-13 16:42:00',
    complaint: {
      complaintType: 'Transactions',
      transactionType: 'Claims & encounter information (837)',
      description:
        'Claims are rejected with a generic error that maps to no documented rejection reason, and the plan will not identify the companion-guide section it is enforcing.',
      actionsTaken: 'Called provider services three times over six weeks and submitted a written inquiry.',
      incidentDate: '2026-08-13',
    },
    complainant: {
      firstName: 'Dana',
      lastName: 'Whitfield',
      email: 'd.whitfield@example.org',
      phone: '5550148823',
      role: 'Health care provider',
      anonymous: false,
    },
    fae: {
      orgName: 'Harbor Point Surgical Center',
      entityType: 'Health care provider',
      address: '3 Harbor Point Way',
      city: 'Miami',
      state: 'FL',
      zip: '33131',
      phone: '3055550127',
    },
    action: null,
  },
];

function seed() {
  if (RESET) {
    db.exec(`
      DELETE FROM complaint_actions;
      DELETE FROM complainants;
      DELETE FROM filed_against_entities;
      DELETE FROM complaints;
      DELETE FROM tracking_sequence;
    `);
    console.log('[seed] cleared existing data');
  }

  const existing = db.prepare('SELECT COUNT(*) AS n FROM complaints').get().n;
  if (existing > 0) {
    console.log(
      `[seed] ${existing} complaint(s) already present - nothing to do. Use "npm run seed:reset" to start over.`,
    );
    return;
  }

  for (const { action, status, createdAt, ...submission } of SUBMISSIONS) {
    const { complaintId, trackingId } = persistSubmission(submission, { status, createdAt });
    if (action) {
      persistAction(complaintId, action.action, action.note, 'Jordan Reviewer');
    }
    console.log(`[seed] ${trackingId} (${action ? action.action : status || 'submitted'})`);
  }

  console.log(`[seed] inserted ${SUBMISSIONS.length} complaints`);
}

seed();
