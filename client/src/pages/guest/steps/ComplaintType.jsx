import { RadioGroup } from '../../../components/Field.jsx';

export function ComplaintType({ form, update, errors, reference }) {
  if (!reference) return <p>Loading options...</p>;

  return (
    <>
      <p className="required-key">All fields marked with an asterisk ( * ) are required.</p>

      <RadioGroup
        id="complaint.complaintType"
        legend="Select Complaint Type"
        required
        value={form.complaint.complaintType}
        onChange={(value) => update('complaint', 'complaintType', value)}
        options={reference.complaintTypes}
        error={errors['complaint.complaintType']}
      />
    </>
  );
}
