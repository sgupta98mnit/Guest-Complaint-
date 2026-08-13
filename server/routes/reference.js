import { Router } from 'express';
import {
  COMPLAINT_TYPES,
  TRANSACTION_TYPES,
  COMPLAINANT_ROLES,
  ENTITY_TYPES,
  STATES,
  DECISIONS,
  STATUSES,
  STATUS_FILTERS,
} from '../lib/referenceData.js';
import { DEMO_MODE } from '../lib/verification.js';

export const referenceRouter = Router();

// Single source of truth for every picklist, status label, and decision option
// in the UI. The client fetches this on load rather than shipping its own copy,
// so what a filer can pick and what the server will accept cannot drift apart.
referenceRouter.get('/', (_req, res) => {
  res.json({
    complaintTypes: COMPLAINT_TYPES,
    transactionTypes: TRANSACTION_TYPES,
    complainantRoles: COMPLAINANT_ROLES,
    entityTypes: ENTITY_TYPES,
    states: STATES,
    decisions: DECISIONS,
    statuses: STATUSES,
    statusFilters: STATUS_FILTERS,
    // Lets the UI tell the truth about verification: with no mail server, the
    // code is shown on screen rather than pretending an email was sent.
    demoMode: DEMO_MODE,
  });
});
