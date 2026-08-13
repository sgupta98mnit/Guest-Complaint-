import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api.js';
import { StatusBadge, statusLabel } from '../../components/StatusBadge.jsx';
import { SelectField } from '../../components/Field.jsx';

const FILTERS = ['submitted', 'approved', 'denied', 'needs_info'];

const formatDate = (value) =>
  value ? new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString() : '';

export function ComplaintList() {
  const [complaints, setComplaints] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (filter) => {
    setLoading(true);
    setError(null);
    try {
      const { complaints: rows } = await api.listComplaints(filter || undefined);
      setComplaints(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  return (
    <>
      <div className="row row--between" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: 0 }}>Complaint queue</h1>
          <p className="text-muted" style={{ margin: 0 }}>
            Submitted complaints awaiting or completed intake review.
          </p>
        </div>

        <div style={{ minWidth: 240 }}>
          <SelectField
            id="status-filter"
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={FILTERS.map((value) => ({ value, label: statusLabel(value) }))}
            placeholder="All statuses"
          />
        </div>
      </div>

      {error && (
        <div className="alert alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="card">
        {/* aria-live so the count is announced when the filter changes -
            otherwise a screen-reader user gets no feedback that anything
            happened. */}
        <p className="text-small text-muted" aria-live="polite">
          {loading
            ? 'Loading complaints...'
            : `${complaints.length} complaint${complaints.length === 1 ? '' : 's'}${
                status ? ` with status "${statusLabel(status)}"` : ''
              }`}
        </p>

        {!loading && complaints.length === 0 ? (
          <p>
            No complaints to show. Run <span className="mono">npm run seed</span> to load demo data,
            or file one through the guest flow.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">
                Submitted complaints, newest first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Tracking ID</th>
                  <th scope="col">Filed against</th>
                  <th scope="col">Type</th>
                  <th scope="col">Incident date</th>
                  <th scope="col">Received</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {complaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td className="table__id">
                      <Link to={`/reviewer/complaints/${complaint.id}`}>
                        {complaint.trackingId}
                      </Link>
                    </td>
                    <td>
                      {complaint.faeOrgName}
                      {complaint.complainantAnonymous && (
                        <>
                          <br />
                          <span className="text-small text-muted">Anonymous complainant</span>
                        </>
                      )}
                    </td>
                    <td>{complaint.complaintType}</td>
                    <td>{complaint.incidentDate}</td>
                    <td>{formatDate(complaint.createdAt)}</td>
                    <td>
                      <StatusBadge status={complaint.status} />
                      {complaint.reviewCount > 0 && (
                        <>
                          <br />
                          <span className="text-small text-muted">
                            {complaint.reviewCount} action
                            {complaint.reviewCount === 1 ? '' : 's'}
                          </span>
                        </>
                      )}
                    </td>
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
