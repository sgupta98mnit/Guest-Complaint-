import { useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { TextField } from '../../components/Field.jsx';
import { api } from '../../api.js';

/**
 * Two-phase email verification, mirroring the sandbox's "Send Verification
 * Code" gate on the guest path.
 *
 * The address proven here is carried into the wizard and must match the
 * complainant email at submit time, so a filer cannot verify an address they
 * control and then file under somebody else's.
 */
export function EmailVerificationModal({
  onClose,
  onVerified,
  initialEmail = '',
  // When re-verifying part-way through a filing, the address is fixed: the
  // server requires the verified email to match the one on the complaint.
  lockEmail = false,
  intro,
}) {
  const [phase, setPhase] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(event) {
    event?.preventDefault();
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
    <Modal
      title="Email Verification"
      onClose={onClose}
      labelledBy="verify-title"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="verification-form"
            className="btn btn--primary"
            disabled={busy}
          >
            {phase === 'email' ? 'Send Verification Code' : 'Verify and Continue'}
          </button>
        </>
      }
    >
      {banner && (
        <div className="alert alert--error" role="alert">
          {banner}
        </div>
      )}

      <form id="verification-form" onSubmit={phase === 'email' ? sendCode : verify} noValidate>
        {phase === 'email' ? (
          <>
            <p>{intro || 'Please enter your email address to receive a verification code.'}</p>
            <TextField
              id="verification-email"
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={setEmail}
              error={errors.email}
              autoComplete="email"
              readOnly={lockEmail}
              hint={
                lockEmail
                  ? 'This must match the email address on your complaint.'
                  : undefined
              }
            />
          </>
        ) : (
          <>
            <p>
              Enter the 6-digit code sent to <strong>{email}</strong>. The code expires in 10
              minutes.
            </p>

            {/* Development affordance: there is no mail server in this prototype,
                so the API hands the code back and it is displayed here. This
                block never renders in a production build. */}
            {devCode && (
              <div className="dev-note">
                <strong>Demo mode:</strong> no email is actually sent. Your code is{' '}
                <span className="mono">{devCode}</span>.
              </div>
            )}

            <TextField
              id="verification-code"
              label="Verification Code"
              required
              value={code}
              onChange={setCode}
              error={errors.code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
            />

            {!lockEmail && (
              <button
                type="button"
                className="btn--link"
                onClick={() => {
                  setCode('');
                  setPhase('email');
                }}
              >
                Use a different email address
              </button>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
