import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { Stepper } from '../../components/Stepper.jsx';
import { ErrorSummary } from '../../components/ErrorSummary.jsx';
import {
  STEPS,
  emptyForm,
  validateStep,
  firstStepWithErrors,
  FIELD_LABELS,
} from '../../validation.js';

import { EmailVerificationModal } from './EmailVerificationModal.jsx';
import { GettingStarted } from './steps/GettingStarted.jsx';
import { ComplaintType } from './steps/ComplaintType.jsx';
import { ComplaintDetails } from './steps/ComplaintDetails.jsx';
import { ComplainantDetails } from './steps/ComplainantDetails.jsx';
import { FaeDetails } from './steps/FaeDetails.jsx';
import { ReviewSubmit } from './steps/ReviewSubmit.jsx';
import { Confirmation } from './steps/Confirmation.jsx';

const CONFIRMATION_INDEX = STEPS.length - 1;

/**
 * Orchestrates the guest filing flow.
 *
 * The wizard owns all form state in one object and decides when a step may be
 * left; the step components are presentational and just render fields against
 * that state. Keeping validation and navigation here means there is exactly one
 * place where "can the user continue?" is answered.
 *
 * Nothing is persisted between steps - no drafts, by design. A guest who
 * reloads loses the form, which matches the real tool's guest behaviour.
 */
export function GuestWizard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { email: verifiedEmail, verificationToken } = location.state || {};

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(() => {
    const initial = emptyForm();
    // The verified address is the one the complaint is filed under, so it is
    // seeded here and shown read-only on the complainant step.
    if (verifiedEmail) initial.complainant.email = verifiedEmail;
    return initial;
  });
  const [errors, setErrors] = useState({});
  const [reference, setReference] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState(null);
  const [trackingId, setTrackingId] = useState(null);

  // The verification token starts in router state but lives here, because it can
  // be replaced without leaving the wizard - see `reverify` below.
  const [token, setToken] = useState(verificationToken);
  const [reverify, setReverify] = useState(false);

  const headingRef = useRef(null);
  const isConfirmation = stepIndex === CONFIRMATION_INDEX;
  const step = STEPS[stepIndex];

  useEffect(() => {
    api
      .reference()
      .then(setReference)
      .catch(() => setBanner('Could not load form options. Is the API running?'));
  }, []);

  // Move focus to the new step's heading on every transition. Without this a
  // keyboard or screen-reader user stays parked on the "Next" button and gets
  // no announcement that the page changed underneath them.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  function update(section, field, value) {
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  }

  /**
   * Patch several fields of a section at once.
   *
   * Selecting an organization rewrites the name and five address fields
   * together. Doing that as six sequential `update` calls would queue six
   * separate state updates off the same stale snapshot.
   */
  function updateMany(section, patch) {
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  }

  function goNext() {
    const stepErrors = validateStep(step.id, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setBanner(null);
    setStepIndex((index) => Math.min(index + 1, CONFIRMATION_INDEX));
  }

  function goBack() {
    setErrors({});
    setBanner(null);
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  async function submit(overrideToken) {
    // Only a string is a token. Guarding the type means an accidental
    // `onClick={submit}` - which would pass a click event here - degrades to
    // using the stored token instead of sending an event object to the server.
    const activeToken = typeof overrideToken === 'string' ? overrideToken : token;

    setSubmitting(true);
    setBanner(null);
    try {
      const result = await api.submitComplaint(form, activeToken);
      setTrackingId(result.trackingId);
      setErrors({});
      setStepIndex(CONFIRMATION_INDEX);
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length > 0) {
        setErrors(err.errors);
        // Server-side rejections can name fields from earlier steps. Jump back
        // to the first step that owns one, otherwise the summary would point at
        // inputs that are not on screen.
        const target = firstStepWithErrors(err.errors);
        if (target !== null && target !== stepIndex) setStepIndex(target);
      } else if (err.reason === 'unverified' || err.reason === 'email_mismatch') {
        // Verification state is held in server memory, so it is lost if the API
        // restarts and it expires after 30 minutes - both of which can happen
        // while someone is part-way through a long form. Sending the filer back
        // to the start would destroy everything they had typed, so re-verify in
        // place and retry with the completed form intact.
        setReverify(true);
      } else {
        setBanner(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // The wizard is only reachable with a verification token. Landing here
  // directly - a bookmark, a refresh - sends the user back to verify.
  if (!verificationToken && !trackingId) {
    return <Navigate to="/" replace />;
  }

  const reverifyModal = reverify && (
    <EmailVerificationModal
      initialEmail={form.complainant.email}
      lockEmail
      intro="Your verification has expired, so the complaint was not submitted. Nothing you entered has been lost - request a new code to finish submitting."
      onClose={() => {
        setReverify(false);
        setBanner(
          'Your complaint was not submitted. Verify your email address again and press Submit.',
        );
      }}
      onVerified={({ verificationToken: fresh }) => {
        setToken(fresh);
        setReverify(false);
        // Retry immediately with the new token - state updates are async, so it
        // is passed directly rather than read back from `token`.
        submit(fresh);
      }}
    />
  );

  const stepProps = { form, update, updateMany, errors, reference, verifiedEmail };

  return (
    <>
      <Stepper steps={STEPS} currentIndex={stepIndex} />

      <div className="card">
        <h1 tabIndex={-1} ref={headingRef}>
          {step.label}
        </h1>

        {banner && (
          <div className="alert alert--error" role="alert">
            {banner}
          </div>
        )}

        {!isConfirmation && (
          <ErrorSummary errors={errors} fieldLabels={FIELD_LABELS} />
        )}

        {step.id === 'getting-started' && <GettingStarted />}
        {step.id === 'complaint-type' && <ComplaintType {...stepProps} />}
        {step.id === 'complaint-details' && <ComplaintDetails {...stepProps} />}
        {step.id === 'complainant-details' && <ComplainantDetails {...stepProps} />}
        {step.id === 'fae-details' && <FaeDetails {...stepProps} />}
        {step.id === 'review-submit' && (
          <ReviewSubmit form={form} onEditStep={(index) => setStepIndex(index)} />
        )}
        {step.id === 'confirmation' && <Confirmation trackingId={trackingId} />}

        {!isConfirmation && (
          <div className="btn-row">
            <div className="row">
              <button type="button" className="btn btn--secondary" onClick={goBack} disabled={stepIndex === 0}>
                Previous
              </button>
              <button type="button" className="btn--link" onClick={() => navigate('/')}>
                Exit
              </button>
            </div>

            {step.id === 'review-submit' ? (
              // Wrapped rather than `onClick={submit}`, which would pass React's
              // click event into submit()'s token argument.
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => submit()}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={goNext}>
                {stepIndex === 0 ? 'Get Started' : 'Next'}
              </button>
            )}
          </div>
        )}

        {isConfirmation && (
          <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--primary" onClick={() => navigate('/')}>
              Done
            </button>
          </div>
        )}
      </div>

      {reverifyModal}
    </>
  );
}
