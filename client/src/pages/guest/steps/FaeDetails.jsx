import { SectionTitle, SelectField, TextField } from '../../../components/Field.jsx';
import {
  OrganizationPicker,
  orgSelectPatch,
  ORG_CLEAR_PATCH,
} from '../../../components/OrganizationPicker.jsx';

/**
 * The Filed-Against Entity: the organization the complaint is about.
 *
 * Uses the same organization lookup as the complainant step, which is the point
 * of making organizations a shared record - an FAE named in one complaint is
 * findable when the next filer names the same one.
 */
export function FaeDetails({ form, update, updateMany, errors, reference }) {
  if (!reference) return <p>Loading options...</p>;

  const { fae } = form;
  const set = (field) => (value) => update('fae', field, value);
  const fromOrg = Boolean(fae.orgId);

  return (
    <>
      <p className="required-key">All fields marked with an asterisk ( * ) are required.</p>

      <SectionTitle>FAE Organization Information</SectionTitle>
      <div className="grid-2">
        <OrganizationPicker
          id="fae.orgName"
          label="FAE Organization"
          required
          value={{
            orgId: fae.orgId,
            orgName: fae.orgName,
            orgCity: fae.city,
            orgState: fae.state,
          }}
          onSelect={(organization) => updateMany('fae', orgSelectPatch(organization))}
          onClear={() => updateMany('fae', ORG_CLEAR_PATCH)}
          error={errors['fae.orgName']}
          hint="Search for the organization you believe is out of compliance."
          states={reference.states}
        />
        <SelectField
          id="fae.orgType"
          label="Organization Type"
          value={fae.orgType}
          onChange={set('orgType')}
          options={reference.orgTypes}
          error={errors['fae.orgType']}
        />
      </div>

      <SectionTitle>FAE Point of Contact Information</SectionTitle>
      <div className="grid-2">
        <TextField
          id="fae.contactFirstName"
          label="First Name"
          required
          value={fae.contactFirstName}
          onChange={set('contactFirstName')}
          error={errors['fae.contactFirstName']}
        />
        <TextField
          id="fae.contactLastName"
          label="Last Name"
          required
          value={fae.contactLastName}
          onChange={set('contactLastName')}
          error={errors['fae.contactLastName']}
        />
      </div>

      <SectionTitle>FAE Address Information</SectionTitle>
      {fromOrg && (
        <p className="text-small text-muted">
          Address details come from the selected organization. Choose{' '}
          <strong>Change</strong> above to use a different one.
        </p>
      )}
      <div className="grid-2">
        <TextField
          id="fae.addressLine1"
          label="Address Line 1"
          value={fae.addressLine1}
          onChange={set('addressLine1')}
          error={errors['fae.addressLine1']}
          readOnly={fromOrg}
        />
        <TextField
          id="fae.addressLine2"
          label="Address Line 2"
          value={fae.addressLine2}
          onChange={set('addressLine2')}
          error={errors['fae.addressLine2']}
          readOnly={fromOrg}
        />
        <TextField
          id="fae.city"
          label="City/Town"
          value={fae.city}
          onChange={set('city')}
          error={errors['fae.city']}
          readOnly={fromOrg}
        />
        {fromOrg ? (
          <TextField
            id="fae.state"
            label="State/Territory"
            value={fae.state}
            onChange={set('state')}
            error={errors['fae.state']}
            readOnly
          />
        ) : (
          <SelectField
            id="fae.state"
            label="State/Territory"
            value={fae.state}
            onChange={set('state')}
            options={reference.states}
            error={errors['fae.state']}
          />
        )}
        <TextField
          id="fae.zip"
          label="ZIP Code"
          value={fae.zip}
          onChange={set('zip')}
          error={errors['fae.zip']}
          readOnly={fromOrg}
        />
      </div>

      <SectionTitle>FAE Contact Information</SectionTitle>
      <div className="grid-2">
        <TextField
          id="fae.email"
          label="Contact Email Address"
          type="email"
          required
          value={fae.email}
          onChange={set('email')}
          error={errors['fae.email']}
        />
        <TextField
          id="fae.phone"
          label="Phone Number"
          type="tel"
          required
          value={fae.phone}
          onChange={set('phone')}
          error={errors['fae.phone']}
          placeholder="(555) 123-4567"
        />
      </div>
    </>
  );
}
