import { Router } from 'express';
import { requireReviewer } from './auth.js';
import { consumeToken } from '../lib/verification.js';
import { validateSubmission, validateReview } from '../lib/validation.js';
import { getOrganization } from '../lib/organizationStore.js';
import {
  persistSubmission,
  persistReview,
  listComplaints,
  getComplaintDetail,
  getComplaintWithReviews,
  complaintExists,
  VALID_STATUSES,
} from '../lib/complaintStore.js';

export const complaintsRouter = Router();

// These handlers stay deliberately thin: parse, delegate to validation, delegate
// to the store, shape a response. Business rules live in lib/validation.js and
// SQL lives in lib/complaintStore.js.

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

/**
 * POST /api/complaints - public, no auth.
 *
 * Requires a verification token issued by the OTP step and bound to the same
 * email address entered on the complainant step.
 */
complaintsRouter.post('/', (req, res) => {
  const payload = req.body || {};

  const errors = validateSubmission(payload);

  // Organization references are checked here rather than in validation.js,
  // which is deliberately pure and knows nothing about the database. The
  // foreign key would catch a bad id anyway, but as a 500 rather than a 400.
  for (const section of ['complainant', 'fae']) {
    const orgId = payload[section]?.orgId;
    if (orgId != null && !getOrganization(orgId)) {
      errors[`${section}.orgName`] = 'Select an organization from the list, or create a new one.';
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const redeemed = consumeToken(
    req.get('x-verification-token') || payload.verificationToken,
    payload.complainant?.email,
  );

  if (!redeemed.ok) {
    return res.status(403).json({
      error:
        redeemed.reason === 'email_mismatch'
          ? 'Your verified email does not match the email on this complaint.'
          : 'Verify your email address before submitting.',
      reason: redeemed.reason,
    });
  }

  const { trackingId } = persistSubmission(payload);

  // Deliberately minimal. A guest cannot look a complaint up afterwards, so
  // there is nothing useful to return beyond the tracking id - and handing out
  // internal row ids on a public endpoint just invites probing.
  res.status(201).json({ trackingId, status: 'submitted' });
});

/** GET /api/complaints?status=submitted - reviewer only. */
complaintsRouter.get('/', requireReviewer, (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ errors: { status: 'Unknown status filter.' } });
  }

  res.json({ complaints: listComplaints({ status }) });
});

/** GET /api/complaints/:id - reviewer only. Full record plus review history. */
complaintsRouter.get('/:id', requireReviewer, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid complaint id.' });

  const detail = getComplaintDetail(id);
  if (!detail) return res.status(404).json({ error: 'Complaint not found.' });

  res.json(detail);
});

/**
 * POST /api/complaints/:id/reviews - reviewer only.
 *
 * `needs_info` intentionally has no notification side effect anywhere in this
 * codebase. That is the requirement rather than an omission: "Needs More Info"
 * is an internal state and the complainant is never told about it.
 */
complaintsRouter.post('/:id/reviews', requireReviewer, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid complaint id.' });

  const errors = validateReview(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  if (!complaintExists(id)) {
    return res.status(404).json({ error: 'Complaint not found.' });
  }

  persistReview(id, String(req.body.action).trim(), String(req.body.note).trim(), req.reviewer);

  res.status(201).json(getComplaintWithReviews(id));
});
