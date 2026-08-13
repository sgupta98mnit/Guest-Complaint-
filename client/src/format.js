const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Format a date-only value (`incident_date`) with NO timezone conversion.
 *
 * These are plain calendar dates — the day something happened — not instants.
 * Parsing "2026-05-14" through `new Date` treats it as UTC midnight, so any
 * viewer west of Greenwich sees May 13. The fix is to never build a Date at
 * all: split the parts and render them.
 */
export function formatDay(iso) {
  if (!iso) return '';
  const [year, month, day] = String(iso).split('-').map(Number);
  if (!year || !month || !day) return String(iso);
  return `${MONTHS[month - 1]} ${String(day).padStart(2, '0')}, ${year}`;
}

/**
 * Format a UTC timestamp (`created_at`) in the viewer's local timezone.
 *
 * Unlike the above these really are instants, so converting is correct — SQLite
 * writes them as "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker, hence the
 * explicit `Z`.
 */
function toDate(stamp) {
  return stamp ? new Date(`${String(stamp).replace(' ', 'T')}Z`) : null;
}

export function formatReceived(stamp) {
  const date = toDate(stamp);
  if (!date) return '';
  return `${MONTHS[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}, ${date.getFullYear()}`;
}

export function formatStamp(stamp) {
  const date = toDate(stamp);
  if (!date) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
