import {
  CheckCard,
  RadioCards,
  SelectField,
  TextArea,
  TextField,
} from '../../components/Field.jsx';
import { DESCRIPTION_MAX, todayISO } from '../../validation.js';

// The wizard's step bodies. These are presentational: they render fields
// against the form object and report changes upward. Every decision about
// whether the filer may continue lives in GuestWizard.

const CHECKLIST = [
  { t: 'What happened', d: 'dates, transaction types, and the parties involved.' },
  { t: "Who it's about", d: 'the name of the health plan, clearinghouse, or provider.' },
  { t: 'Your contact details', d: 'or choose to file anonymously.' },
  { t: 'About 10 minutes', d: "guests can't save a draft and return later." },
];

export function GettingStarted({ onStart, onExit }) {
  return (
    <>
      <div className="callout callout--info" style={{ marginBottom: 28 }}>
        <div className="callout__title">Before you begin</div>
        You’re filing as a guest. You will receive a tracking ID on the confirmation screen — write
        it down. Guests cannot sign back in to view or track a filed complaint.
      </div>

      <h2 style={{ fontSize: 21, marginBottom: 16 }}>What you’ll need</h2>
      <ul className="checklist">
        {CHECKLIST.map((item) => (
          <li key={item.t}>
            <span className="checklist__tick" aria-hidden="true">
              ✓
            </span>
            <span>
              <strong>{item.t}</strong> — {item.d}
            </span>
          </li>
        ))}
      </ul>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 30 }}>
        <button type="button" className="btn btn--primary" onClick={onStart}>
          Start complaint
        </button>
        <button type="button" className="btn--link" onClick={onExit}>
          Exit without filing
        </button>
      </div>
    </>
  );
}

export function RequiredNote() {
  return (
    <p className="required-note" style={{ marginTop: 0, marginBottom: 24 }}>
      Fields marked <span aria-hidden="true">*</span> are required.
    </p>
  );
}

export function ComplaintType({ form, set, errors, reference }) {
  return (
    <>
      <RequiredNote />
      <RadioCards
        id="complaint.complaintType"
        legend="Complaint type"
        help="Choose the standard the complaint is about. This drives which questions you see next."
        required
        value={form.complaint.complaintType}
        onChange={(value) => set('complaint', 'complaintType', value)}
        options={reference.complaintTypes}
        error={errors['complaint.complaintType']}
      />
    </>
  );
}

export function ComplaintDetails({ form, set, errors, reference }) {
  const { complaint } = form;

  return (
    <>
      <RequiredNote />
      <div className="field-stack">
        <TextArea
          id="complaint.description"
          label="What happened?"
          hint="Describe the transaction, dates, and parties involved. Plain language is fine."
          required
          value={complaint.description}
          onChange={(value) => set('complaint', 'description', value)}
          error={errors['complaint.description']}
          placeholder="For example: The health plan rejected our 837P claims without a compliant 277CA response…"
          style={{ minHeight: 132 }}
          maxLength={DESCRIPTION_MAX}
          showCounter
        />

        <TextArea
          id="complaint.actionsTaken"
          label="What have you already done to resolve it?"
          hint="Optional, but it helps intake move faster."
          value={complaint.actionsTaken}
          onChange={(value) => set('complaint', 'actionsTaken', value)}
          error={errors['complaint.actionsTaken']}
          placeholder="Calls, emails, or escalations you’ve made with the other party…"
          style={{ minHeight: 96 }}
          maxLength={DESCRIPTION_MAX}
        />

        <div className="two-up">
          <TextField
            id="complaint.incidentDate"
            label="Incident date"
            hint="mm / dd / yyyy"
            type="date"
            required
            value={complaint.incidentDate}
            onChange={(value) => set('complaint', 'incidentDate', value)}
            error={errors['complaint.incidentDate']}
            // Browser-level guard; the server enforces the same rule, since a
            // max attribute is trivially bypassed.
            max={todayISO()}
          />
          <SelectField
            id="complaint.transactionType"
            label="Transaction type"
            hint="The standard transaction at issue."
            required
            value={complaint.transactionType}
            onChange={(value) => set('complaint', 'transactionType', value)}
            options={reference.transactionTypes}
            error={errors['complaint.transactionType']}
          />
        </div>

        <TextField
          id="complaint.previousTrackingId"
          label="Previous complaint tracking ID"
          hint="Only if this continues an earlier complaint. Example: CM-26-03384."
          value={complaint.previousTrackingId}
          onChange={(value) => set('complaint', 'previousTrackingId', value)}
          error={errors['complaint.previousTrackingId']}
          placeholder="CM-26-"
          className="field__control mono"
          style={{ maxWidth: 240 }}
        />

        <div className="callout callout--scope">
          The live tool also accepts supporting document uploads here. File upload is out of scope
          for this prototype — see the README.
        </div>
      </div>
    </>
  );
}

export function YourInformation({ form, set, errors, reference }) {
  const { complainant } = form;
  const anonymous = Boolean(complainant.anonymous);

  return (
    <>
      <RequiredNote />
      <div className="field-stack" style={{ gap: 24 }}>
        <div className="two-up">
          <TextField
            id="complainant.firstName"
            label="First name"
            required={!anonymous}
            value={complainant.firstName}
            onChange={(value) => set('complainant', 'firstName', value)}
            error={errors['complainant.firstName']}
            autoComplete="given-name"
          />
          <TextField
            id="complainant.lastName"
            label="Last name"
            required={!anonymous}
            value={complainant.lastName}
            onChange={(value) => set('complainant', 'lastName', value)}
            error={errors['complainant.lastName']}
            autoComplete="family-name"
          />
        </div>

        <div className="two-up">
          {/* Read-only: this address was proven by the verification code, and
              the server rejects a submission whose complainant email differs
              from the verified one. An editable field would only produce a
              confusing failure three steps later. */}
          <TextField
            id="complainant.email"
            label="Email"
            type="email"
            required
            readOnly
            value={complainant.email}
            onChange={(value) => set('complainant', 'email', value)}
            error={errors['complainant.email']}
            hint="Verified. To file under a different address, start again."
          />
          <TextField
            id="complainant.phone"
            label="Phone"
            type="tel"
            value={complainant.phone}
            onChange={(value) => set('complainant', 'phone', value)}
            error={errors['complainant.phone']}
            autoComplete="tel"
          />
        </div>

        <SelectField
          id="complainant.role"
          label="Your role"
          hint="How you relate to the transaction in question."
          required
          value={complainant.role}
          onChange={(value) => set('complainant', 'role', value)}
          options={reference.complainantRoles}
          error={errors['complainant.role']}
          style={{ maxWidth: 340 }}
        />

        <CheckCard
          id="complainant.anonymous"
          label="File anonymously"
          description="Your name and phone number are withheld from the filed-against entity. CMS still holds your verified email so it can contact you, and may be unable to investigate without further detail."
          checked={anonymous}
          onChange={(value) => set('complainant', 'anonymous', value)}
        />
      </div>
    </>
  );
}

export function FiledAgainstEntity({ form, set, errors, reference }) {
  const { fae } = form;

  return (
    <>
      <RequiredNote />
      <div className="field-stack" style={{ gap: 24 }}>
        <TextField
          id="fae.orgName"
          label="Organization name"
          hint="The health plan, clearinghouse, or provider the complaint is about."
          required
          value={fae.orgName}
          onChange={(value) => set('fae', 'orgName', value)}
          error={errors['fae.orgName']}
          autoComplete="organization"
        />

        <div className="two-up">
          <SelectField
            id="fae.entityType"
            label="Entity type"
            required
            value={fae.entityType}
            onChange={(value) => set('fae', 'entityType', value)}
            options={reference.entityTypes}
            error={errors['fae.entityType']}
          />
          <TextField
            id="fae.phone"
            label="Contact phone"
            type="tel"
            value={fae.phone}
            onChange={(value) => set('fae', 'phone', value)}
            error={errors['fae.phone']}
          />
        </div>

        <TextField
          id="fae.address"
          label="Street address"
          value={fae.address}
          onChange={(value) => set('fae', 'address', value)}
          error={errors['fae.address']}
          autoComplete="street-address"
        />

        <div className="city-state-zip">
          <TextField
            id="fae.city"
            label="City"
            value={fae.city}
            onChange={(value) => set('fae', 'city', value)}
            error={errors['fae.city']}
            autoComplete="address-level2"
          />
          <SelectField
            id="fae.state"
            label="State"
            value={fae.state}
            onChange={(value) => set('fae', 'state', value)}
            options={reference.states}
            error={errors['fae.state']}
            placeholder="—"
          />
          <TextField
            id="fae.zip"
            label="ZIP"
            value={fae.zip}
            onChange={(value) => set('fae', 'zip', value)}
            error={errors['fae.zip']}
            autoComplete="postal-code"
          />
        </div>
      </div>
    </>
  );
}

const NEXT_STEPS = [
  'An intake analyst reviews the filing for HIPAA administrative simplification scope.',
  'If accepted, the filed-against entity is contacted directly by CMS.',
  'As a guest filer you won’t receive status updates. Keep your tracking ID for any future correspondence.',
];

export function Confirmation({ trackingId, receivedAt, onRestart }) {
  return (
    <>
      <div className="confirm__banner">
        <div className="confirm__check" aria-hidden="true">
          ✓
        </div>
        <div>
          <h2 style={{ fontSize: 24, margin: '2px 0 6px' }}>Complaint submitted</h2>
          <div style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.55 }}>
            Received {receivedAt}. Intake review typically begins within 10 business days.
          </div>
        </div>
      </div>

      <div style={{ padding: '32px 36px 34px' }}>
        <div className="confirm__id-block">
          <div className="eyebrow" style={{ letterSpacing: '0.1em' }}>
            Your tracking ID
          </div>
          <div className="confirm__id">{trackingId}</div>
          <div style={{ fontSize: 14.5, color: 'var(--muted)' }}>
            Write this down or print this page. It is not emailed to you.
          </div>
        </div>

        <h3 style={{ fontSize: 18, margin: '0 0 12px' }}>What happens next</h3>
        <ol className="next-steps">
          {NEXT_STEPS.map((text, index) => (
            <li key={text}>
              <span className="next-steps__num" aria-hidden="true">
                {index + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 28 }}>
          <button type="button" className="btn btn--primary" onClick={() => window.print()}>
            Print this page
          </button>
          <button type="button" className="btn btn--secondary" onClick={onRestart}>
            File another complaint
          </button>
        </div>
      </div>
    </>
  );
}
