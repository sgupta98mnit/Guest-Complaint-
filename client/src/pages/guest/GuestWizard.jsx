import { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';
import { useReference } from '../../reference.jsx';
import { ErrorSummary } from '../../components/ErrorSummary.jsx';
import { ProgressRail } from './ProgressRail.jsx';
import { ReviewSubmit } from './ReviewSubmit.jsx';
import {
  GettingStarted,
  ComplaintType,
  ComplaintDetails,
  YourInformation,
  FiledAgainstEntity,
  Confirmation,
} from './steps.jsx';
import {
  STEPS,
  STEP_BLURBS,
  emptyForm,
  validateStep,
  firstStepWithErrors,
  FIELD_LABELS,
} from '../../validation.js';

const CONFIRM_INDEX = STEPS.length - 1;

/**
 * Orchestrates the guest filing flow.
 *
 * The wizard owns all form state in one object and decides when a step may be
 * left; the step components are presentational. Keeping validation and
 * navigation here means there is exactly one place that answers "may the filer
 * continue?".
 *
 * Nothing is persisted between steps — no drafts, by design. Leaving loses the
 * filing, which is what the handoff specifies for guests.
 */
export function GuestWizard() {
  const { reference, error: referenceError } = useReference();

  const [stepIndex, setStepIndex] = useState(0);
  const [maxVisited, setMaxVisited] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState(null);
  const [result, setResult] = useState(null);

  const headingRef = useRef(null);
  const step = STEPS[stepIndex];
  const isConfirmation = stepIndex === CONFIRM_INDEX;

  // Move focus to the step heading on every transition. Without this a keyboard
  // or screen-reader user stays parked on the button they just pressed and gets
  // no announcement that the page changed underneath them.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  function set(section, field, value) {
    setForm((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  }

  function goTo(index) {
    setErrors({});
    setBanner(null);
    setStepIndex(index);
    setMaxVisited((seen) => Math.max(seen, index));
  }

  function goNext() {
    const stepErrors = validateStep(step.id, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    goTo(Math.min(stepIndex + 1, CONFIRM_INDEX));
  }

  const goBack = () => goTo(Math.max(stepIndex - 1, 0));

  function restart() {
    setForm(emptyForm());
    setResult(null);
    setMaxVisited(0);
    goTo(0);
  }

  async function submit() {
    setSubmitting(true);
    setBanner(null);
    try {
      const payload = await api.submitComplaint(form);
      setResult({
        trackingId: payload.trackingId,
        receivedAt: new Date().toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      });
      setErrors({});
      setStepIndex(CONFIRM_INDEX);
      setMaxVisited(CONFIRM_INDEX);
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length > 0) {
        setErrors(err.errors);
        // A server rejection can name fields from earlier steps. Jump back to
        // the first step that owns one, otherwise the summary points at inputs
        // that are not on screen.
        const target = firstStepWithErrors(err.errors);
        if (target !== null && target !== stepIndex) setStepIndex(target);
      } else {
        setBanner(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (referenceError) {
    return (
      <div className="container" style={{ padding: '36px 32px 72px' }}>
        <div className="callout callout--error" role="alert">
          {referenceError}
        </div>
      </div>
    );
  }

  if (!reference) {
    return (
      <div className="container" style={{ padding: '36px 32px 72px' }}>
        <p>Loading…</p>
      </div>
    );
  }

  const stepProps = { form, set, errors, reference };

  return (
    <>
      <div className="wizard__title-band">
        <div className="container" style={{ padding: '26px 32px 30px' }}>
          <div className="eyebrow">File a complaint · Guest</div>
          <h1 className="wizard__h1" tabIndex={-1} ref={headingRef}>
            {step.label}
          </h1>
          <p className="wizard__blurb">{STEP_BLURBS[step.id]}</p>
        </div>
      </div>

      <div className="container wizard__grid">
        <ProgressRail currentIndex={stepIndex} maxVisited={maxVisited} onJump={goTo} />

        <div>
          <div className={`card${isConfirmation ? '' : ' card--pad'}`}>
            {banner && (
              <div className="callout callout--error" role="alert" style={{ marginBottom: 24 }}>
                {banner}
              </div>
            )}

            {!isConfirmation && <ErrorSummary errors={errors} labels={FIELD_LABELS} />}

            {/* "Exit without filing" clears the form rather than navigating away:
                the wizard is the whole app, and a hard location change would
                leave the mount point entirely on a subpath deployment. */}
            {step.id === 'start' && <GettingStarted onStart={goNext} onExit={restart} />}
            {step.id === 'type' && <ComplaintType {...stepProps} />}
            {step.id === 'details' && <ComplaintDetails {...stepProps} />}
            {step.id === 'complainant' && <YourInformation {...stepProps} />}
            {step.id === 'fae' && <FiledAgainstEntity {...stepProps} />}
            {step.id === 'review' && <ReviewSubmit form={form} onEditStep={goTo} />}
            {step.id === 'confirm' && (
              <Confirmation
                trackingId={result?.trackingId}
                receivedAt={result?.receivedAt}
                onRestart={restart}
              />
            )}

            {step.id !== 'start' && !isConfirmation && (
              <div className="wizard__footer">
                <button type="button" className="btn btn--secondary" onClick={goBack}>
                  Previous
                </button>
                {step.id === 'review' ? (
                  <button
                    type="button"
                    className="btn btn--success"
                    onClick={() => submit()}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting…' : 'Submit complaint'}
                  </button>
                ) : (
                  <button type="button" className="btn btn--primary" onClick={() => goNext()}>
                    Next
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
