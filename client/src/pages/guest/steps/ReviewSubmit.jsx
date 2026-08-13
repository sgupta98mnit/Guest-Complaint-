const STEP_INDEX = { complaint: 2, complainant: 3, fae: 4 };

function Row({ label, value }) {
  return (
    <div className="dl__row">
      <dt>{label}</dt>
      <dd>{value || <span className="text-muted">Not provided</span>}</dd>
    </div>
  );
}

function Section({ title, onEdit, children }) {
  return (
    <div className="card">
      <div className="row row--between" style={{ marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button type="button" className="btn btn--secondary" onClick={onEdit}>
          Edit<span className="visually-hidden"> {title}</span>
        </button>
      </div>
      <dl className="dl grid-2">{children}</dl>
    </div>
  );
}

const joinAddress = (data) =>
  [data.addressLine1, data.addressLine2, data.city, data.state, data.zip]
    .filter(Boolean)
    .join(', ');

/**
 * Last chance to check the record before it becomes permanent. Each section has
 * its own Edit control that jumps back to the owning step - a single "go back"
 * would force the filer to walk forward through every screen again.
 */
export function ReviewSubmit({ form, onEditStep }) {
  const { complaint, complainant, fae } = form;

  return (
    <>
      <p className="lede">
        Review everything below before submitting. Once submitted, a guest complaint cannot be
        changed or viewed again.
      </p>

      <Section title="Complaint Details" onEdit={() => onEditStep(STEP_INDEX.complaint)}>
        <Row label="Complaint type" value={complaint.complaintType} />
        <Row label="Incident date" value={complaint.incidentDate} />
        <Row label="Transaction type" value={complaint.transactionType} />
        <Row label="Previous tracking ID" value={complaint.prevTrackingId} />
        <Row label="Description" value={complaint.description} />
        <Row label="Actions taken" value={complaint.actionsTaken} />
      </Section>

      <Section title="Complainant Information" onEdit={() => onEditStep(STEP_INDEX.complainant)}>
        <Row label="Remain anonymous" value={complainant.anonymous ? 'Yes' : 'No'} />
        <Row label="Organization" value={complainant.orgName} />
        <Row label="Organization type" value={complainant.orgType} />
        <Row label="Name" value={`${complainant.firstName} ${complainant.lastName}`.trim()} />
        <Row label="Email address" value={complainant.email} />
        <Row label="Phone number" value={complainant.phone} />
        <Row label="Address" value={joinAddress(complainant)} />
      </Section>

      <Section title="Filed-Against Entity" onEdit={() => onEditStep(STEP_INDEX.fae)}>
        <Row label="Organization" value={fae.orgName} />
        <Row label="Organization type" value={fae.orgType} />
        <Row label="Contact" value={`${fae.contactFirstName} ${fae.contactLastName}`.trim()} />
        <Row label="Contact email" value={fae.email} />
        <Row label="Phone number" value={fae.phone} />
        <Row label="Address" value={joinAddress(fae)} />
      </Section>
    </>
  );
}
