import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { useReference } from '../../reference.jsx';
import { StatusPill } from '../../components/StatusPill.jsx';
import { RadioCards, TextArea } from '../../components/Field.jsx';
import { formatDay, formatReceived, formatStamp } from '../../format.js';

const DOT_FOR = {
  approve: '#2e8540',
  deny: '#b50909',
  needs_info: '#e5a000',
};

function Fact({ label, value }) {
  return (
    <div>
      <div className="fact__k">{label}</div>
      <div className="fact__v">{value || <span style={{ color: 'var(--subtle)' }}>—</span>}</div>
    </div>
  );
}

export function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { reference } = useReference();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [decision, setDecision] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
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

  const canSubmit = Boolean(decision) && note.trim().length > 0;

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setErrors({});
    try {
      const payload = await api.recordAction(id, decision, note.trim());
      setData((prev) => ({ ...prev, complaint: payload.complaint, actions: payload.actions }));
      setDecision('');
      setNote('');
      setSaved(true);
      statusRef.current?.focus();
    } catch (err) {
      if (err.errors && Object.keys(err.errors).length > 0) setErrors(err.errors);
      else setErrors({ note: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="container" style={{ paddingTop: 26, paddingBottom: 72 }}>
        <div className="callout callout--error" role="alert">
          {loadError}
        </div>
        <button
          type="button"
          className="btn--link"
          onClick={() => navigate('/reviewer/complaints')}
        >
          ← Back to queue
        </button>
      </div>
    );
  }

  if (!data || !reference) {
    return (
      <div className="container" style={{ paddingTop: 26, paddingBottom: 72 }}>
        <p>Loading complaint…</p>
      </div>
    );
  }

  const { complaint, complainant, fae, actions } = data;
  const anonymous = complainant?.anonymous;
  const filer = anonymous
    ? 'Anonymous complainant'
    : [[complainant?.firstName, complainant?.lastName].filter(Boolean).join(' '), complainant?.role]
        .filter(Boolean)
        .join(' · ');

  const decisionLabel = reference.decisions.find((d) => d.value === decision)?.label;

  // Actions come back newest-first, so the head is the decision in force.
  const latest = actions[0];
  // Approving or denying moves a complaint on to enforcement intake, so
  // changing it afterwards is a reversal and should look like one. Resolving a
  // "needs more info" hold is the opposite - that state exists precisely to be
  // decided later, so it stays frictionless.
  const supersedes = latest && (latest.action === 'approve' || latest.action === 'deny');
  const onHold = latest?.action === 'needs_info';
  const latestLabel =
    latest &&
    reference.statuses[reference.decisions.find((d) => d.value === latest.action)?.status]?.label;

  // The oldest entry is always the filing itself, so the timeline never starts
  // in the middle of the story.
  const timeline = [
    ...actions.map((action) => ({
      key: `a-${action.id}`,
      title: reference.statuses[reference.decisions.find((d) => d.value === action.action)?.status]
        ?.label,
      meta: `${action.reviewerName} · ${formatStamp(action.createdAt)}`,
      note: action.note,
      dot: DOT_FOR[action.action],
    })),
    {
      key: 'received',
      title: 'Complaint received',
      meta: `Guest submission · ${formatReceived(complaint.createdAt)}`,
      note: 'Filed through the public guest wizard. No draft was saved and the filer cannot view this record.',
      dot: '#1a4480',
    },
  ];

  return (
    <div className="container" style={{ paddingTop: 26, paddingBottom: 72 }}>
      <button
        type="button"
        className="btn--link"
        style={{ marginBottom: 18 }}
        onClick={() => navigate('/reviewer/complaints')}
      >
        ← Back to queue
      </button>

      <div className="card detail__summary">
        <div>
          <div className="mono" style={{ fontSize: 15, color: 'var(--muted)' }}>
            {complaint.trackingId}
          </div>
          <h1 style={{ fontSize: 27, letterSpacing: '-0.015em', margin: '6px 0 8px' }}>
            {fae?.orgName}
          </h1>
          <div style={{ fontSize: 15, color: 'var(--muted)' }}>
            {complaint.complaintType} · incident {formatDay(complaint.incidentDate)} · received{' '}
            {formatReceived(complaint.createdAt)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="eyebrow eyebrow--sm" style={{ marginBottom: 6 }}>
            Current status
          </div>
          <span tabIndex={-1} ref={statusRef}>
            <StatusPill status={complaint.status} large />
          </span>
        </div>
      </div>

      <div className="detail__grid">
        <div style={{ display: 'grid', gap: 22 }}>
          <div className="card" style={{ padding: '26px 30px' }}>
            <h2 className="card__h">Complaint</h2>
            <div style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text)', textWrap: 'pretty' }}>
              {complaint.description}
            </div>
            <div style={{ marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--border-soft)' }}>
              <div className="eyebrow eyebrow--sm" style={{ marginBottom: 8 }}>
                Actions already taken by complainant
              </div>
              <div style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text)' }}>
                {complaint.actionsTaken || 'None recorded.'}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '26px 30px' }}>
            <h2 className="card__h">Filing record</h2>
            <div className="facts">
              <Fact label="Complaint type" value={complaint.complaintType} />
              <Fact label="Transaction type" value={complaint.transactionType} />
              <Fact label="Complainant" value={filer} />
              <Fact
                label="Contact"
                value={
                  anonymous
                    ? 'Withheld — filed anonymously'
                    : [complainant?.email, complainant?.phone].filter(Boolean).join(' · ')
                }
              />
              <Fact
                label="Filed-against entity"
                value={[fae?.orgName, fae?.entityType?.toLowerCase()].filter(Boolean).join(' · ')}
              />
              <Fact
                label="Entity address"
                value={[fae?.address, fae?.city, fae?.state, fae?.zip].filter(Boolean).join(', ')}
              />
              <Fact label="Previous complaint" value={complaint.previousTrackingId || 'None'} />
              <Fact label="Supporting documents" value="Out of scope in this prototype" />
            </div>
          </div>

          <div className="card" style={{ padding: '26px 30px' }}>
            <h2 className="card__h">Review history</h2>
            <ol className="timeline">
              {timeline.map((entry, index) => (
                <li key={entry.key}>
                  <span className="timeline__rail" aria-hidden="true">
                    <span className="timeline__dot" style={{ background: entry.dot }} />
                    {index < timeline.length - 1 && <span className="timeline__line" />}
                  </span>
                  <span>
                    <span className="timeline__title">{entry.title}</span>
                    <span className="timeline__meta">{entry.meta}</span>
                    <span className="timeline__note">{entry.note}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <form className="card decision-panel" onSubmit={submit} noValidate>
          <h2 className="card__h" style={{ marginBottom: 4 }}>
            {supersedes ? 'Change the decision' : 'Record a decision'}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.5 }}>
            Internal only. Nothing is sent to the complainant.
          </p>

          {supersedes && (
            <div className="callout callout--warning" style={{ marginBottom: 18 }}>
              <div className="callout__title">Already decided</div>
              <strong>{latestLabel}</strong> by {latest.reviewerName} on{' '}
              {formatStamp(latest.createdAt)}. Recording another decision supersedes it — the
              earlier one stays in the history.
            </div>
          )}

          {onHold && (
            <div className="callout callout--info" style={{ marginBottom: 18 }}>
              On hold since {formatStamp(latest.createdAt)}. Recording a decision resolves it.
            </div>
          )}

          <RadioCards
            id="decision"
            legend="Intake decision"
            small
            value={decision}
            onChange={(value) => {
              setDecision(value);
              setSaved(false);
            }}
            options={reference.decisions}
            error={errors.action}
          />

          <TextArea
            id="note"
            label="Reviewer note"
            hint={
              supersedes
                ? 'Explain why the earlier decision is being changed. Recorded with your name and timestamp.'
                : 'Recorded with your name and timestamp.'
            }
            required
            value={note}
            onChange={(value) => {
              setNote(value);
              setSaved(false);
            }}
            error={errors.note}
            placeholder="Why this decision?"
            style={{ minHeight: 110 }}
            maxLength={5000}
          />

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={!canSubmit || busy}
            style={{ marginTop: 16 }}
          >
            {busy
              ? 'Recording…'
              : decisionLabel
                ? `${supersedes ? 'Override with' : 'Record'} ${decisionLabel.toLowerCase()}`
                : 'Select an action'}
          </button>

          {saved && (
            <div className="decision-panel__flash" role="status">
              Decision recorded and status updated.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
