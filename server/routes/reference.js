import { Router } from 'express';
import {
  COMPLAINT_TYPES,
  TRANSACTION_TYPES,
  ORG_TYPES,
  STATES,
  REVIEW_ACTIONS,
} from '../lib/referenceData.js';

export const referenceRouter = Router();

// Single source of truth for every picklist in the UI. The client fetches this
// on load rather than shipping its own copy, so the options the user can pick
// and the options the server will accept can never drift apart.
//
// In production these belong in a reference table with effective dates, not a
// JS module - see README, "What I cut".
referenceRouter.get('/', (_req, res) => {
  res.json({
    complaintTypes: COMPLAINT_TYPES,
    transactionTypes: TRANSACTION_TYPES,
    orgTypes: ORG_TYPES,
    states: STATES,
    reviewActions: REVIEW_ACTIONS,
  });
});
