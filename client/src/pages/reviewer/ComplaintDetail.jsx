import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { StatusBadge, statusLabel } from '../../components/StatusBadge.jsx';
import { RadioGroup, SectionTitle, TextArea } from '../../components/Field.jsx';

const ACTIONS = [
  {
    value: 'approved',
    label: 'Approve for Intake',
    description: 'The complaint is within scope and moves forward to investigation.',
  },
  {
    value: 'denied',
    label: 'Deny for Intake',
    description: 'The complaint will not be investigated under this program.',
  },
  {
    value: 'needs_info',
    label: 'Needs More Info',
    description:
      'Internal hold pending further detail. The complainant is not notified by this system.',
  },
];

const formatTimestamp = (value) =>
  value ? new Date(`${value.replace(' ', 'T')}Z`).toLocaleString() : '';

function Row({ label, value }) {
  return (
    <div className="dl__row">
      <dt>{label}</dt>
      <dd>{value || <span className="text-muted">Not provided</span>}</dd>
    </div>
  );
}

const joinAddress = (data) =>
  [data?.addressLine1, data?.addressLine2, data?.city, data?.state, data?.zip]
    .filter(Boolean)
    .join(', ');

export function ComplaintDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [busy, setBusy] = useState(false);
  const statusRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await api.getComplaint(id));
    } catch (err) {
      setLoadError(err.status === 404 ? 'That complaint does not exist.' : err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitReview(event) {
    event.preventDefault();
    setErrors({});
    setBanner(null);

    // Mirrors the server rule so the reviewer is not made to wait for a round
    // trip to learn the note is required.
    const localErrors = {};
    if (!action) localErrors.action = 'Select an action.';
    if (!note.trim()) localErrors.note = 'A note is required for every action.';
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }

    setBusy(true);
    try {
      const result = await api.reviewComplaint(id, action, note.trim());
      setData((prev) => ({ ...prev, complaint: result.complaint, reviews: result.reviews }));
      setAction('');
      setNote('');
      setBanner(`Status updated to "${statusLabel(result.complaint.status)}".`);
      statusRef.current?.focus();
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length > 0) setErrors(err.errors);
      else setBanner(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="card">
        <div className="alert alert--error" role="alert">
          {loadError}
        </div>
        <Link to="/reviewer/complaints">Back to the complaint queue</Link>
      </div>
    );
  }

  if (!data) return <p>Loading complaint...</p>;

  const { complaint, complainant, fae, reviews } = data;

  return (
    <>
      <p>
        <Link to="/reviewer/complaints">&larr; Back to the complaint queue</Link>
      </p>

      <div className="card">
        <div className="row row--between">
          <div>
            <h1 style={{ marginBottom: '0.25rem' }} className="mono">
              {complaint.trackingId}
            </h1>
            <p className="text-muted" style={{ margin: 0 }}>
              Received {formatTimestamp(complaint.createdAt)}
            </p>
          </div>
          <div tabIndex={-1} ref={statusRef}>
            <StatusBadge status={complaint.status} />
          </div>
        </div>

        {banner && (
          <div className="alert alert--success" role="status" style={{ marginTop: '1rem' }}>
            {banner}
          </div>
        )}

        {/* The anonymity flag has no enforcement point in this prototype because
            nothing here is FAE-facing. Surfacing it prominently is the honest
            implementation: it tells the reviewer what they may not disclose. */}
        {complainant?.anonymous && (
          <div className="alert alert--warning" style={{ marginTop: '1rem' }}>
            <h2>Anonymous complainant</h2>
            <p style={{ margin: 0 }}>
              This complainant asked to remain anonymous. Their identity must not be shared with the
              Filed-Against Entity during the investigation. Contact details below are for CMS use
              only, and remain subject to FOIA.
            </p>
          </div>
        )}
      </div>

      <div className="card">
        <SectionTitle>Complaint Details</SectionTitle>
        <dl className="dl grid-2">
          <Row label="Complaint type" value={complaint.complaintType} />
          <Row label="Transaction type" value={complaint.transactionType} />
          <Row label="Incident date" value={complaint.incidentDate} />
          <Row label="Previous tracking ID" value={complaint.prevTrackingId} />
        </dl>
        <dl className="dl">
          <Row label="Description" value={complaint.description} />
          <Row label="Actions taken to resolve" value={complaint.actionsTaken} />
        </dl>

        <SectionTitle>Complainant</SectionTitle>
        <dl className="dl grid-2">
          <Row label="Anonymity requested" value={complainant?.anonymous ? 'Yes' : 'No'} />
          <Row label="Organization" value={complainant?.orgName} />
          <Row label="Organization type" value={complainant?.orgType} />
          <Row
            label="Name"
            value={`${complainant?.firstName ?? ''} ${complainant?.lastName ?? ''}`.trim()}
          />
          <Row label="Email address" value={complainant?.email} />
          <Row label="Phone number" value={complainant?.phone} />
          <Row label="Address" value={joinAddress(complainant)} />
        </dl>

        <SectionTitle>Filed-Against Entity</SectionTitle>
        <dl className="dl grid-2">
          <Row label="Organization" value={fae?.orgName} />
          <Row label="Organization type" value={fae?.orgType} />
          <Row
            label="Point of contact"
            value={`${fae?.contactFirstName ?? ''} ${fae?.contactLastName ?? ''}`.trim()}
          />
          <Row label="Contact email" value={fae?.email} />
          <Row label="Phone number" value={fae?.phone} />
          <Row label="Address" value={joinAddress(fae)} />
        </dl>
      </div>

      <div className="card">
        <h2>Take an action</h2>
        <form onSubmit={submitReview} noValidate>
          <RadioGroup
            id="action"
            legend="Intake decision"
            required
            value={action}
            onChange={setAction}
            options={ACTIONS}
            error={errors.action}
          />

          <TextArea
            id="note"
            label="Reviewer note"
            required
            value={note}
            onChange={setNote}
            error={errors.note}
            hint="Recorded permanently against this complaint. Explain the reasoning for the decision."
            maxLength={5000}
          />

          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? 'Recording...' : 'Record decision'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Review history</h2>
        {reviews.length === 0 ? (
          <p className="text-muted">No actions have been taken on this complaint yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                Every action taken on this complaint, oldest first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Action</th>
                  <th scope="col">Note</th>
                  <th scope="col">Reviewer</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <StatusBadge status={review.action} />
                    </td>
                    <td>{review.note}</td>
                    <td>{review.reviewer}</td>
                    <td>{formatTimestamp(review.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
