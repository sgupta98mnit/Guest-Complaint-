import { useEffect, useRef } from 'react';

/**
 * The error-summary pattern: when a submit fails, move focus to a single
 * summary at the top of the form that lists every problem and links to the
 * field that caused it.
 *
 * This matters more than per-field messages alone. A keyboard or screen-reader
 * user who presses "Next" and gets silently rejected has no way to discover
 * what went wrong - inline errors further down the page are never announced.
 * Taking focus here is what makes the failure perceivable.
 */
export function ErrorSummary({ errors, fieldLabels = {}, title = 'Fix the following to continue' }) {
  const ref = useRef(null);
  const entries = Object.entries(errors || {});
  const signature = entries.map(([key]) => key).join('|');

  useEffect(() => {
    if (entries.length > 0) ref.current?.focus();
    // Re-focus whenever the *set* of failing fields changes, not on every
    // keystroke that happens to update an unrelated error object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (entries.length === 0) return null;

  return (
    <div
      className="alert alert--error"
      role="alert"
      tabIndex={-1}
      ref={ref}
      aria-labelledby="error-summary-title"
    >
      <h2 id="error-summary-title">{title}</h2>
      <ul className="alert__list">
        {entries.map(([key, message]) => (
          <li key={key}>
            <button
              type="button"
              className="btn--link"
              onClick={() => {
                const el = document.getElementById(key);
                if (el) {
                  el.focus();
                  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
              }}
            >
              {fieldLabels[key] ? `${fieldLabels[key]}: ${message}` : message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
