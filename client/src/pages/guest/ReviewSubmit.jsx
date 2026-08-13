/**
 * Last chance to check the record before it becomes permanent.
 *
 * Each section has its own Edit control that jumps back to the owning step —
 * a single "Previous" would force the filer to walk forward through every
 * screen again.
 */
const STEP_INDEX = { type: 1, details: 2, complainant: 3, fae: 4 };

function Section({ title, onEdit, rows }) {
  return (
    <div className="review__section">
      <div className="review__head">
        <h3 style={{ fontSize: 17.5 }}>{title}</h3>
        <button type="button" className="btn--link" onClick={onEdit}>
          Edit<span className="visually-hidden"> {title}</span>
        </button>
      </div>
      <dl className="review__rows">
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'contents' }}>
            <dt>{label}</dt>
            <dd>{value || <span style={{ color: 'var(--subtle)' }}>Not provided</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ReviewSubmit({ form, onEditStep }) {
  const { complaint, complainant, fae } = form;
  const anonymous = Boolean(complainant.anonymous);

  const name = [complainant.firstName, complainant.lastName].filter(Boolean).join(' ').trim();
  const address = [fae.address, fae.city, fae.state, fae.zip].filter(Boolean).join(', ');

  return (
    <>
      <Section
        title="Complaint type"
        onEdit={() => onEditStep(STEP_INDEX.type)}
        rows={[
          ['Type', complaint.complaintType],
          ['Transaction type', complaint.transactionType],
        ]}
      />

      <Section
        title="Complaint details"
        onEdit={() => onEditStep(STEP_INDEX.details)}
        rows={[
          ['Description', complaint.description],
          ['Actions taken', complaint.actionsTaken],
          ['Incident date', complaint.incidentDate],
          ['Previous tracking ID', complaint.previousTrackingId || 'None'],
        ]}
      />

      <Section
        title="Your information"
        onEdit={() => onEditStep(STEP_INDEX.complainant)}
        rows={
          anonymous
            ? [
                ['Name', 'Filing anonymously'],
                ['Role', complainant.role],
                ['Contact', 'Withheld from the filed-against entity'],
              ]
            : [
                ['Name', name],
                ['Role', complainant.role],
                ['Email', complainant.email],
                ['Phone', complainant.phone],
              ]
        }
      />

      <Section
        title="Filed-against entity"
        onEdit={() => onEditStep(STEP_INDEX.fae)}
        rows={[
          ['Organization', fae.orgName],
          ['Entity type', fae.entityType],
          ['Address', address],
          ['Contact phone', fae.phone],
        ]}
      />

      <div className="callout callout--warning" style={{ marginTop: 26 }}>
        Once you submit, this complaint cannot be edited and cannot be viewed again as a guest. Save
        your tracking ID from the next screen.
      </div>
    </>
  );
}
