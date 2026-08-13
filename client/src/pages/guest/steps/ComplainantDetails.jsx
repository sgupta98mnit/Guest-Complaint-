import { RadioGroup, SectionTitle, SelectField, TextField } from '../../../components/Field.jsx';

export function ComplainantDetails({ form, update, errors, reference, verifiedEmail }) {
  if (!reference) return <p>Loading options...</p>;

  const { complainant } = form;
  const set = (field) => (value) => update('complainant', field, value);

  return (
    <>
      <p className="required-key">All fields marked with an asterisk ( * ) are required.</p>

      <RadioGroup
        id="complainant.anonymous"
        legend="Do you want to remain anonymous?"
        value={complainant.anonymous ? 'yes' : 'no'}
        onChange={(value) => update('complainant', 'anonymous', value === 'yes')}
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]}
      />

      {complainant.anonymous && (
        <p className="text-legal">
          If you select yes, please note CMS will not share your information with the Filed-Against
          Entity (FAE) during the investigation process. However, information provided in this
          complaint is subject to rules and policy under the Freedom of Information Act (FOIA).
          Your contact details are still required so CMS can reach you about the investigation.
        </p>
      )}

      <SectionTitle>Complainant Organization Information</SectionTitle>
      <div className="grid-2">
        <TextField
          id="complainant.orgName"
          label="Complainant Organization"
          required
          value={complainant.orgName}
          onChange={set('orgName')}
          error={errors['complainant.orgName']}
          autoComplete="organization"
        />
        <SelectField
          id="complainant.orgType"
          label="Organization Type"
          required
          value={complainant.orgType}
          onChange={set('orgType')}
          options={reference.orgTypes}
          error={errors['complainant.orgType']}
        />
      </div>

      <SectionTitle>Complainant Personal Information</SectionTitle>
      <div className="grid-2">
        <TextField
          id="complainant.firstName"
          label="First Name"
          required
          value={complainant.firstName}
          onChange={set('firstName')}
          error={errors['complainant.firstName']}
          autoComplete="given-name"
        />
        <TextField
          id="complainant.lastName"
          label="Last Name"
          required
          value={complainant.lastName}
          onChange={set('lastName')}
          error={errors['complainant.lastName']}
          autoComplete="family-name"
        />
      </div>

      <SectionTitle>Complainant Address Information</SectionTitle>
      <div className="grid-2">
        <TextField
          id="complainant.addressLine1"
          label="Address Line 1"
          value={complainant.addressLine1}
          onChange={set('addressLine1')}
          error={errors['complainant.addressLine1']}
          autoComplete="address-line1"
        />
        <TextField
          id="complainant.addressLine2"
          label="Address Line 2"
          value={complainant.addressLine2}
          onChange={set('addressLine2')}
          error={errors['complainant.addressLine2']}
          autoComplete="address-line2"
        />
        <TextField
          id="complainant.city"
          label="City/Town"
          value={complainant.city}
          onChange={set('city')}
          error={errors['complainant.city']}
          autoComplete="address-level2"
        />
        <SelectField
          id="complainant.state"
          label="State/Territory"
          value={complainant.state}
          onChange={set('state')}
          options={reference.states}
          error={errors['complainant.state']}
        />
        <TextField
          id="complainant.zip"
          label="ZIP Code"
          value={complainant.zip}
          onChange={set('zip')}
          error={errors['complainant.zip']}
          autoComplete="postal-code"
        />
      </div>

      <SectionTitle>Complainant Contact Information</SectionTitle>
      <div className="grid-2">
        {/* Read-only on purpose: this address was proven by the verification
            code, and the server rejects a submission whose complainant email
            does not match the verified one. Changing it here would produce a
            confusing failure at submit time. */}
        <TextField
          id="complainant.email"
          label="Email Address"
          type="email"
          required
          readOnly
          value={complainant.email}
          onChange={set('email')}
          error={errors['complainant.email']}
          hint={
            verifiedEmail
              ? 'Verified. To file under a different address, exit and start again.'
              : undefined
          }
        />
        <TextField
          id="complainant.phone"
          label="Contact Phone Number"
          type="tel"
          required
          value={complainant.phone}
          onChange={set('phone')}
          error={errors['complainant.phone']}
          placeholder="(555) 123-4567"
          autoComplete="tel"
        />
      </div>
    </>
  );
}
