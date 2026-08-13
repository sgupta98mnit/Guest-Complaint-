import { db } from '../db/index.js';

// Mirrors the sandbox's confirmation format, e.g. CM-26-03384
// (CM- + 2-digit year + 5-digit zero-padded sequence).

export function formatTrackingId(year, seq) {
  return `CM-${year}-${String(seq).padStart(5, '0')}`;
}

export function currentYear(now = new Date()) {
  return now.getFullYear().toString().slice(-2);
}

const bumpSequence = db.prepare(`
  INSERT INTO tracking_sequence (year, last_seq) VALUES (?, 1)
  ON CONFLICT(year) DO UPDATE SET last_seq = last_seq + 1
  RETURNING last_seq
`);

/**
 * Reserve the next tracking id for the given year.
 *
 * MUST be called inside the same transaction as the complaint insert. The
 * upsert-with-RETURNING is a single atomic statement, so concurrent submits get
 * distinct sequences instead of both reading a stale count. Sequence numbers
 * restart at 1 each calendar year and are never reused within one.
 */
export function nextTrackingId(now = new Date()) {
  const year = currentYear(now);
  const { last_seq: seq } = bumpSequence.get(year);
  return formatTrackingId(year, seq);
}
