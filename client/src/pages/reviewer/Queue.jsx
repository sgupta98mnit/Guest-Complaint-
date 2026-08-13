import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useReference } from '../../reference.jsx';
import { StatusPill } from '../../components/StatusPill.jsx';
import { formatDay } from '../../format.js';

const TILES = [
  { status: 'submitted', label: 'Awaiting review', sub: 'oldest 5 days', color: '#1a4480' },
  { status: 'needs_more_info', label: 'Needs more info', sub: 'internal hold', color: '#e5a000' },
  { status: 'approved_for_intake', label: 'Approved', sub: 'last 30 days', color: '#2e8540' },
  { status: 'denied_for_intake', label: 'Denied', sub: 'last 30 days', color: '#b50909' },
];

export function Queue() {
  const { reference } = useReference();
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState([]);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (status) => {
    setLoading(true);
    setError(null);
    try {
      const payload = await api.listComplaints(status || undefined);
      setComplaints(payload.complaints);
      setCounts(payload.counts);
      setTotal(Object.values(payload.counts).reduce((sum, n) => sum + n, 0));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  const statusLabel = (status) => reference?.statuses?.[status]?.label ?? status;

  return (
    <div className="container" style={{ paddingTop: 34, paddingBottom: 72 }}>
      <div className="queue__head">
        <div>
          <div className="eyebrow">Intake review</div>
          <h1 style={{ fontSize: 32, letterSpacing: '-0.02em', margin: '8px 0 0' }}>
            Complaint queue
          </h1>
        </div>
      </div>

      <div className="stats">
        {TILES.map((tile) => (
          <div key={tile.status} className="stat" style={{ borderTopColor: tile.color }}>
            <div className="stat__label">{tile.label}</div>
            <div className="stat__value">{counts[tile.status] ?? 0}</div>
            <div className="stat__sub">{tile.sub}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="callout callout--error" role="alert" style={{ marginBottom: 22 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="queue__toolbar">
          <div className="queue__chips" role="group" aria-label="Filter by status">
            <button
              type="button"
              className={`chip${filter === '' ? ' chip--on' : ''}`}
              aria-pressed={filter === ''}
              onClick={() => setFilter('')}
            >
              All statuses
            </button>
            {(reference?.statusFilters ?? []).map((status) => (
              <button
                key={status}
                type="button"
                className={`chip${filter === status ? ' chip--on' : ''}`}
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>

          {/* Announced politely so the count is spoken when the filter changes. */}
          <div style={{ fontSize: 14, color: 'var(--muted)' }} aria-live="polite">
            {loading ? 'Loading…' : `${complaints.length} of ${total} complaints`}
          </div>
        </div>

        <div className="qtable__head" aria-hidden="true">
          <div>Tracking ID</div>
          <div>Filed against</div>
          <div>Type</div>
          <div>Incident</div>
          <div>Status</div>
        </div>

        {!loading && complaints.length === 0 ? (
          <p style={{ padding: '22px' }}>
            No complaints with this status. Run <span className="mono">npm run seed</span> for demo
            data, or file one through the guest wizard.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {complaints.map((complaint) => (
              <li key={complaint.id}>
                {/* A button, not a div with onClick - the whole row is the
                    control, so it must be reachable and operable by keyboard. */}
                <button
                  type="button"
                  className="qtable__row"
                  onClick={() => navigate(`/reviewer/complaints/${complaint.id}`)}
                >
                  <span className="qtable__id">{complaint.trackingId}</span>
                  <span>
                    <span className="qtable__org" style={{ display: 'block' }}>
                      {complaint.faeOrgName}
                    </span>
                    <span className="qtable__filer" style={{ display: 'block' }}>
                      {complaint.filer}
                    </span>
                  </span>
                  <span className="qtable__cell">{complaint.complaintType}</span>
                  <span className="qtable__cell">{formatDay(complaint.incidentDate)}</span>
                  <span>
                    <StatusPill status={complaint.status} />
                    {complaint.actionCount > 0 && (
                      <span className="qtable__actions" style={{ display: 'block' }}>
                        {complaint.actionCount} action{complaint.actionCount === 1 ? '' : 's'} ·{' '}
                        {complaint.lastReviewer}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
