import { useEffect, useRef, useState } from 'react';
import { TextField } from '../../components/Field.jsx';
import { api } from '../../api.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Two-phase email verification, gating the guest wizard.
 *
 * The address proven here is carried through the wizard and must match the
 * complainant email at submit time, so a filer cannot verify an address they
 * control and then file under somebody else's.
 *
 * Delivery is mocked - there is no mail server - but the security shape is not:
 * codes are hashed at rest, single-use, expiring, attempt-capped, and compared
 * in constant time. See server/lib/verification.js.
 */
export function EmailVerificationModal({ onClose, onVerified }) {
  const [phase, setPhase] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);

  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);

  // Focus moves into the dialog on open, is trapped while it is open, and
  // returns to the trigger on close.
  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const node = dialogRef.current;
    (node?.querySelector(FOCUSABLE) || node)?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = Array.from(node?.querySelectorAll(FOCUSABLE) || []);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

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
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  async function sendCode(event) {
    event.preventDefault();
    setErrors({});
    setBanner(null);
    setBusy(true);
    try {
      const result = await api.requestVerificationCode(email);
      setDevCode(result.devCode ?? null);
      setPhase('code');
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length) setErrors(err.errors);
      else setBanner(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(event) {
    event.preventDefault();
    setErrors({});
    setBanner(null);
    setBusy(true);
    try {
      const result = await api.verifyCode(email, code);
      onVerified({ email: result.email, verificationToken: result.token });
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length) setErrors(err.errors);
      else setBanner(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verify-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="modal__header">
          <h2 id="verify-title">Verify your email</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        <div className="modal__body">
          {banner && (
            <div className="callout callout--error" role="alert" style={{ marginBottom: 18 }}>
              {banner}
            </div>
          )}

          <form id="verification-form" onSubmit={phase === 'email' ? sendCode : verify} noValidate>
            {phase === 'email' ? (
              <>
                <p style={{ marginTop: 0 }}>
                  Complaints are filed against real organizations, so CMS records a verified email
                  for every filing — including anonymous ones. Enter yours and we’ll send a code.
                </p>
                <TextField
                  id="verification-email"
                  label="Email address"
                  type="email"
                  required
                  value={email}
                  onChange={setEmail}
                  error={errors.email}
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </>
            ) : (
              <>
                <p style={{ marginTop: 0 }}>
                  Enter the 6-digit code sent to <strong>{email}</strong>. It expires in 10 minutes.
                </p>

                {/* No mail server in this prototype, so the API returns the code
                    outside production and it is shown here. This block does not
                    render in a production build. */}
                {devCode && (
                  <div className="callout callout--warning" style={{ marginBottom: 18 }}>
                    <strong>Demo mode:</strong> no email is actually sent. Your code is{' '}
                    <span className="mono">{devCode}</span>.
                  </div>
                )}

                <TextField
                  id="verification-code"
                  label="Verification code"
                  required
                  value={code}
                  onChange={setCode}
                  error={errors.code}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                />

                <button
                  type="button"
                  className="btn--link"
                  onClick={() => {
                    setCode('');
                    setDevCode(null);
                    setPhase('email');
                  }}
                >
                  Use a different email address
                </button>
              </>
            )}
          </form>
        </div>

        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="verification-form" className="btn btn--primary" disabled={busy}>
            {busy ? 'Working…' : phase === 'email' ? 'Send code' : 'Verify and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
