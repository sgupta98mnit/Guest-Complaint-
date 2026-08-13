const LABELS = {
  submitted: 'Submitted',
  approved: 'Approved for intake',
  denied: 'Denied for intake',
  needs_info: 'Needs more info',
};

export const statusLabel = (status) => LABELS[status] || status;

/**
 * The badge is colour-coded, but the status word is always present as text -
 * colour is never the only carrier of the meaning.
 */
export function StatusBadge({ status }) {
  return <span className={`badge badge--${status}`}>{statusLabel(status)}</span>;
}
