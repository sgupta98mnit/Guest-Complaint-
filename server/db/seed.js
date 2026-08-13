import { db } from './index.js';
import { persistSubmission, persistReview } from '../lib/complaintStore.js';
import { createOrganization } from '../lib/organizationStore.js';

// Synthetic demo data so the reviewer queue is not empty on a fresh clone.
// Entirely fabricated - no real people, organizations, or health information.
// Run with `npm run seed`, or `npm run seed -- --reset` to wipe first.

const RESET = process.argv.includes('--reset');

const SUBMISSIONS = [
  {
    complaint: {
      complaintType: 'Transactions',
      description:
        'Payer has been rejecting 837I institutional claims with a generic error that does not map to any documented rejection reason, and will not provide the companion guide section they are enforcing.',
      actionsTaken:
        'Called provider services three times over six weeks and submitted a written inquiry through the payer portal. No substantive response.',
      incidentDate: '2026-05-14',
      transactionType: 'Healthcare Claim - Institutional (837I)',
    },
    complainant: {
      anonymous: false,
      orgName: 'Riverbend Regional Hospital',
      orgType: 'Covered Health Care Provider',
      firstName: 'Dana',
      lastName: 'Whitfield',
      addressLine1: '1400 Mercy Lane',
      city: 'Buffalo',
      state: 'New York',
      zip: '14214',
      email: 'dana.whitfield@example.org',
      phone: '7165550142',
    },
    fae: {
      orgName: 'Cardinal Health Plan of New York',
      orgType: 'Health Plan',
      contactFirstName: 'Marcus',
      contactLastName: 'Delgado',
      addressLine1: '88 Corporate Park Drive',
      city: 'Albany',
      state: 'New York',
      zip: '12205',
      email: 'compliance@example.com',
      phone: '5185550188',
    },
    review: {
      action: 'approved',
      note: 'Clear 837I rejection pattern with documented outreach attempts. Approving for intake and routing to the transactions enforcement queue.',
    },
  },
  {
    complaint: {
      complaintType: 'Operating Rules',
      description:
        'Clearinghouse is not returning the CORE-required 277CA acknowledgement within the mandated timeframe, leaving submitted claims in an unknown state for days at a time.',
      actionsTaken: 'Opened two support tickets; both were closed without resolution.',
      incidentDate: '2026-06-02',
      transactionType: 'Claim Status Request/Response (276/277)',
    },
    complainant: {
      anonymous: true,
      orgName: 'Lakeside Family Practice',
      orgType: 'Covered Health Care Provider',
      firstName: 'Priya',
      lastName: 'Raman',
      addressLine1: '77 Shoreline Road',
      city: 'Rochester',
      state: 'New York',
      zip: '14604',
      email: 'p.raman@example.org',
      phone: '5855550119',
    },
    fae: {
      orgName: 'Meridian Claims Clearinghouse',
      orgType: 'Health Care Clearinghouse',
      contactFirstName: 'Alicia',
      contactLastName: 'Nunez',
      addressLine1: '2100 Gateway Boulevard',
      city: 'Chicago',
      state: 'Illinois',
      zip: '60601',
      email: 'support@example.com',
      phone: '3125550170',
    },
    review: {
      action: 'needs_info',
      note: 'Need the specific submission dates and trace numbers for the affected 276 transactions before this can be evaluated. Internal only - do not contact the complainant through the guest channel.',
    },
  },
  {
    complaint: {
      complaintType: 'Unique Identifiers',
      description:
        'Health plan is requiring a legacy internal provider number instead of the NPI on eligibility inquiries, and rejects 270 transactions that carry only the NPI.',
      actionsTaken: 'Escalated to the plan network representative.',
      incidentDate: '2026-04-21',
      transactionType: 'Eligibility Inquiry/Response (270/271)',
    },
    complainant: {
      anonymous: false,
      orgName: 'Northgate Billing Associates',
      orgType: 'Business Associate',
      firstName: 'Owen',
      lastName: "O'Brien",
      addressLine1: '19 Commerce Street',
      city: 'Austin',
      state: 'Texas',
      zip: '78701',
      email: 'owen.obrien+asett@example.org',
      phone: '5125550133',
    },
    fae: {
      orgName: 'Summit Mutual Health',
      orgType: 'Health Plan',
      contactFirstName: 'Rebecca',
      contactLastName: 'Cho',
      addressLine1: '500 Summit Tower',
      city: 'Dallas',
      state: 'Texas',
      zip: '75201',
      email: 'edi.compliance@example.com',
      phone: '2145550164',
    },
    review: {
      action: 'denied',
      note: 'Filed against an entity outside CMS administrative simplification jurisdiction for this transaction set. Denying for intake with a referral note.',
    },
  },
  {
    complaint: {
      complaintType: 'Code Sets',
      description:
        'Remittance advice is returning proprietary adjustment codes rather than the adopted CARC/RARC code set, making automated posting impossible.',
      actionsTaken: '',
      incidentDate: '2026-07-30',
      transactionType: 'Payment/Remittance Advice (835)',
    },
    complainant: {
      anonymous: false,
      orgName: 'Harbor Point Surgical Center',
      orgType: 'Covered Health Care Provider',
      firstName: 'Lena',
      lastName: 'Vasquez',
      addressLine1: '3 Harbor Point Way',
      city: 'Miami',
      state: 'Florida',
      zip: '33131',
      email: 'l.vasquez@example.org',
      phone: '3055550127',
    },
    fae: {
      orgName: 'Atlantic Coast Benefit Administrators',
      orgType: 'Business Associate',
      contactFirstName: 'Grant',
      contactLastName: 'Mullins',
      addressLine1: '410 Biscayne Avenue',
      city: 'Miami',
      state: 'Florida',
      zip: '33130',
      email: 'era.support@example.com',
      phone: '3055550191',
    },
    // No review - stays in the 'submitted' queue so there is something to act on.
    review: null,
  },
];

function seed() {
  if (RESET) {
    // Order matters even with ON DELETE CASCADE, since we clear the parent last.
    db.exec(`
      DELETE FROM complaint_reviews;
      DELETE FROM complainants;
      DELETE FROM fae_entities;
      DELETE FROM complaints;
      DELETE FROM organizations;
      DELETE FROM tracking_sequence;
    `);
    console.log('[seed] cleared existing data');
  }

  const existing = db.prepare('SELECT COUNT(*) AS n FROM complaints').get().n;
  if (existing > 0) {
    console.log(
      `[seed] ${existing} complaint(s) already present - nothing to do. Use "npm run seed -- --reset" to start over.`,
    );
    return;
  }

  // Register each party as a real organization first, so the wizard's lookup
  // has something to find and the seeded complaints reference canonical records
  // rather than dangling name strings.
  const register = (party) => {
    const { organization } = createOrganization({
      name: party.orgName,
      addressLine1: party.addressLine1,
      city: party.city,
      state: party.state,
      zip: party.zip,
      phone: party.phone,
    });
    party.orgId = organization.id;
  };

  for (const { review, ...submission } of SUBMISSIONS) {
    register(submission.complainant);
    register(submission.fae);

    const { complaintId, trackingId } = persistSubmission(submission);
    if (review) {
      persistReview(complaintId, review.action, review.note, 'Jordan Reviewer');
    }
    console.log(`[seed] ${trackingId} (${review ? review.action : 'submitted'})`);
  }

  console.log(`[seed] inserted ${SUBMISSIONS.length} complaints`);
}

seed();
