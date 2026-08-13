import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal.jsx';
import { EmailVerificationModal } from './guest/EmailVerificationModal.jsx';

/**
 * Landing page and the entry point into the guest flow.
 *
 * The real site funnels a filer through two dialogs before the wizard opens -
 * choose guest or registered, then prove the email address. Only the guest path
 * is implemented here; registration is documented as out of scope.
 */
export function Home() {
  const [dialog, setDialog] = useState(null); // null | 'choose' | 'verify'
  const navigate = useNavigate();

  function startGuestFiling({ email, verificationToken }) {
    setDialog(null);
    // The proof of verification is handed to the wizard in router state rather
    // than persisted. Reloading the wizard drops it and sends the user back
    // here to verify again, which is the behaviour we want - the token is
    // single-use and short-lived.
    navigate('/complaints/new', { state: { email, verificationToken } });
  }

  return (
    <>
      <div className="card">
        <h1>Administrative Simplification HIPAA Enforcement Program</h1>
        <p className="lede">
          A complaint is an allegation that a HIPAA-covered entity is not complying with the
          Administrative Simplification requirements. The entity named in a complaint is referred to
          as the Filed-Against Entity (FAE).
        </p>

        <h2 className="card__section-title">What you can file a complaint about</h2>
        <dl className="dl">
          <div className="dl__row">
            <dt>Transactions</dt>
            <dd>
              Claims and encounter information, payment and remittance advice, claims status,
              eligibility, enrollment and disenrollment, referrals and authorizations, coordination
              of benefits, and premium payment.
            </dd>
          </div>
          <div className="dl__row">
            <dt>Code Sets</dt>
            <dd>
              HCPCS, CPT-4, CDT, ICD-9, ICD-10, and NDC codes adopted for procedures, diagnoses, and
              drugs.
            </dd>
          </div>
          <div className="dl__row">
            <dt>Unique Identifiers</dt>
            <dd>National Provider Identifier (NPI) and Employer Identification Number (EIN).</dd>
          </div>
          <div className="dl__row">
            <dt>Operating Rules</dt>
            <dd>
              Electronic Funds Transfer/Electronic Remittance Advice (EFT/ERA), Health Care Claim
              Status, and Eligibility for a Health Plan.
            </dd>
          </div>
        </dl>

        <div className="alert alert--info" style={{ marginTop: '1.5rem', marginBottom: 0 }}>
          <p style={{ margin: 0 }}>
            Filing a <strong>health information privacy</strong> complaint is handled by the Office
            for Civil Rights, not by this tool.
          </p>
        </div>

        <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--primary" onClick={() => setDialog('choose')}>
            File a Non-Compliance Allegation
          </button>
        </div>
      </div>

      {dialog === 'choose' && (
        <Modal
          title="File a Complaint"
          onClose={() => setDialog(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setDialog('verify')}>
                Continue as Guest User
              </button>
            </>
          }
        >
          <p>File a complaint by:</p>
          <ol>
            <li>
              Registering for a new ASETT account or signing in with your existing account{' '}
              <span className="text-muted">(not implemented in this prototype)</span>
            </li>
            <li>Continuing as a Guest User</li>
          </ol>

          <div className="alert alert--warning" style={{ marginBottom: 0 }}>
            <p style={{ margin: 0 }}>
              <strong>Please note:</strong> as a guest user, you cannot save your complaint as a
              draft or view it after submission.
            </p>
          </div>
        </Modal>
      )}

      {dialog === 'verify' && (
        <EmailVerificationModal onClose={() => setDialog(null)} onVerified={startGuestFiling} />
      )}
    </>
  );
}
