import { SectionTitle, SelectField, TextField } from '../../../components/Field.jsx';

/**
 * The Filed-Against Entity: the organization the complaint is about.
 *
 * The live tool backs the organization field with a Salesforce lookup plus a
 * "New Organization" modal. Here it is a plain text field - see the README on
 * why the lookup was cut.
 */
export function FaeDetails({ form, update, errors, reference }) {
  if (!reference) return <p>Loading options...</p>;

  const { fae } = form;
  const set = (field) => (value) => update('fae', field, value);

  return (
    <>
      <p className="required-key">All fields marked with an asterisk ( * ) are required.</p>

      <SectionTitle>FAE Organization Information</SectionTitle>
      <div className="grid-2">
        <TextField
          id="fae.orgName"
          label="FAE Organization"
          required
          value={fae.orgName}
          onChange={set('orgName')}
          error={errors['fae.orgName']}
          hint="The organization you believe is out of compliance."
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
      <div className="grid-2">
        <TextField
          id="fae.addressLine1"
          label="Address Line 1"
          value={fae.addressLine1}
          onChange={set('addressLine1')}
          error={errors['fae.addressLine1']}
        />
        <TextField
          id="fae.addressLine2"
          label="Address Line 2"
          value={fae.addressLine2}
          onChange={set('addressLine2')}
          error={errors['fae.addressLine2']}
        />
        <TextField
          id="fae.city"
          label="City/Town"
          value={fae.city}
          onChange={set('city')}
          error={errors['fae.city']}
        />
        <SelectField
          id="fae.state"
          label="State/Territory"
          value={fae.state}
          onChange={set('state')}
          options={reference.states}
          error={errors['fae.state']}
        />
        <TextField
          id="fae.zip"
          label="ZIP Code"
          value={fae.zip}
          onChange={set('zip')}
          error={errors['fae.zip']}
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
