import { Router } from 'express';
import { requireReviewer } from './auth.js';
import { validateSubmission, validateAction } from '../lib/validation.js';
import {
  persistSubmission,
  persistAction,
  listComplaints,
  statusCounts,
  getComplaintDetail,
  getComplaintWithActions,
  complaintExists,
} from '../lib/complaintStore.js';
import { STATUS_VALUES } from '../lib/referenceData.js';

export const complaintsRouter = Router();

// Handlers stay thin: parse, delegate to validation, delegate to the store,
// shape a response. Rules live in lib/validation.js and SQL in
// lib/complaintStore.js.

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

/** POST /api/complaints - public, no auth. Returns the tracking id. */
complaintsRouter.post('/', (req, res) => {
  const payload = req.body || {};

  const errors = validateSubmission(payload);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const { trackingId } = persistSubmission(payload);

  // Deliberately minimal. There is no guest retrieval endpoint, so there is
  // nothing useful to return beyond the tracking id - and handing out internal
  // row ids on a public endpoint invites probing.
  res.status(201).json({ trackingId, status: 'submitted' });
});

/** GET /api/complaints?status=submitted - reviewer only. */
complaintsRouter.get('/', requireReviewer, (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  if (status && !STATUS_VALUES.includes(status)) {
    return res.status(400).json({ errors: { status: 'Unknown status filter.' } });
  }

  res.json({
    complaints: listComplaints({ status }),
    // Tile totals are always across all statuses, not the filtered set.
    counts: statusCounts(),
  });
});

/** GET /api/complaints/:id - reviewer only. Complaint, complainant, FAE, actions. */
complaintsRouter.get('/:id', requireReviewer, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid complaint id.' });

  const detail = getComplaintDetail(id);
  if (!detail) return res.status(404).json({ error: 'Complaint not found.' });

  res.json(detail);
});

/**
 * POST /api/complaints/:id/actions - reviewer only.
 *
 * `needs_info` has no notification side effect anywhere in this codebase. That
 * is the requirement rather than an omission: it is an internal hold, and the
 * complainant is never told about it.
 */
complaintsRouter.post('/:id/actions', requireReviewer, (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid complaint id.' });

  const errors = validateAction(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  if (!complaintExists(id)) {
    return res.status(404).json({ error: 'Complaint not found.' });
  }

  persistAction(id, String(req.body.action).trim(), String(req.body.note).trim(), req.reviewer);

  res.status(201).json(getComplaintWithActions(id));
});
