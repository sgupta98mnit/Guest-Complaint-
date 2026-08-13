import { useEffect, useRef } from 'react';

/**
 * The error-summary pattern: when a step fails validation, move focus to a
 * single alert listing every problem, each entry linking to the field that
 * caused it.
 *
 * This matters more than inline messages alone. A keyboard or screen-reader
 * user who presses "Next" and is silently rejected has no way to discover what
 * went wrong — errors further down the page are never announced. Taking focus
 * here is what makes the failure perceivable.
 */
export function ErrorSummary({ errors, labels = {}, title = 'Fix the following to continue' }) {
  const ref = useRef(null);
  const entries = Object.entries(errors || {});
  const signature = entries.map(([key]) => key).join('|');

  useEffect(() => {
    if (entries.length > 0) ref.current?.focus();
    // Re-focus when the *set* of failing fields changes, not on every keystroke
    // that happens to rebuild the errors object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (entries.length === 0) return null;

  return (
    <div
      className="callout callout--error"
      role="alert"
      tabIndex={-1}
      ref={ref}
      style={{ marginBottom: 24 }}
    >
      <div className="callout__title">{title}</div>
      <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
        {entries.map(([key, message]) => (
          <li key={key} style={{ marginBottom: 4 }}>
            <button
              type="button"
              className="btn--link"
              style={{ color: 'var(--error)' }}
              onClick={() => {
                const el = document.getElementById(key);
                if (el) {
                  el.focus();
                  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
              }}
            >
              {labels[key] ? `${labels[key]}: ${message}` : message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
