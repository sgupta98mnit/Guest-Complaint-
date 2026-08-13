import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog.
 *
 * Three things make a modal usable rather than just visually on top:
 * focus moves into it when it opens and returns to the trigger when it closes,
 * Tab cannot escape it into the page behind, and Escape dismisses it.
 * `aria-modal` plus a labelled heading tell assistive tech the rest of the page
 * is inert.
 */
export function Modal({ title, onClose, children, footer, labelledBy = 'modal-title' }) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;

    const node = dialogRef.current;
    const focusables = node?.querySelectorAll(FOCUSABLE);
    (focusables?.[0] || node)?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = Array.from(node?.querySelectorAll(FOCUSABLE) || []);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      // Wrap around at both ends so focus stays inside the dialog.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Return focus to whatever opened the dialog, so the user is not dumped
      // at the top of the document.
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={dialogRef} tabIndex={-1}>
        <div className="modal__header">
          <h2 id={labelledBy}>{title}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}
