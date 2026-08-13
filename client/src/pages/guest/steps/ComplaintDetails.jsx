import { TextArea, TextField, SelectField } from '../../../components/Field.jsx';
import { todayISO } from '../../../validation.js';

export function ComplaintDetails({ form, update, errors, reference }) {
  if (!reference) return <p>Loading options...</p>;

  const { complaint } = form;

  return (
    <>
      <p className="required-key">All fields marked with an asterisk ( * ) are required.</p>

      <div className="grid-2">
        <div>
          <TextArea
            id="complaint.description"
            label="Complaint Description"
            required
            value={complaint.description}
            onChange={(value) => update('complaint', 'description', value)}
            error={errors['complaint.description']}
            placeholder="Enter detailed information..."
            maxLength={10000}
          />

          <TextArea
            id="complaint.actionsTaken"
            label="Actions Taken to Resolve Complaint"
            value={complaint.actionsTaken}
            onChange={(value) => update('complaint', 'actionsTaken', value)}
            error={errors['complaint.actionsTaken']}
            placeholder="Enter detailed information..."
            maxLength={10000}
          />
        </div>

        <div>
          <TextField
            id="complaint.incidentDate"
            label="Incident Occurred Date"
            type="date"
            required
            value={complaint.incidentDate}
            onChange={(value) => update('complaint', 'incidentDate', value)}
            error={errors['complaint.incidentDate']}
            // Browser-level guard; the server enforces the same rule, since a
            // max attribute is trivially bypassed.
            max={todayISO()}
          />

          <TextField
            id="complaint.prevTrackingId"
            label="Previous Complaint Tracking ID"
            hint="If this continues an earlier complaint, enter its ID (for example CM-26-03384)."
            value={complaint.prevTrackingId}
            onChange={(value) => update('complaint', 'prevTrackingId', value)}
            error={errors['complaint.prevTrackingId']}
          />

          <SelectField
            id="complaint.transactionType"
            label="Complaint Transaction Type"
            required
            value={complaint.transactionType}
            onChange={(value) => update('complaint', 'transactionType', value)}
            options={reference.transactionTypes}
            error={errors['complaint.transactionType']}
          />
        </div>
      </div>

      <div className="alert alert--info" style={{ marginBottom: 0 }}>
        <p style={{ margin: 0 }}>
          The live tool also accepts supporting document uploads at this step. File upload is out of
          scope for this prototype - see the README for why.
        </p>
      </div>
    </>
  );
}
