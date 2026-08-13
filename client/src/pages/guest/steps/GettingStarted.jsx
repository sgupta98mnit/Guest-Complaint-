/**
 * Static orientation step. The real tool leads with this so a filer knows what
 * they are committing to before typing anything, and it sets the expectation
 * that a guest submission cannot be revisited.
 */
export function GettingStarted() {
  const steps = [
    {
      title: 'Step 1: Identify the type of HIPAA/ACA complaint',
      body: 'Choose the complaint type related to the non-compliance issue.',
    },
    {
      title: 'Step 2: Describe the violation',
      body: 'Provide details about the HIPAA/ACA non-compliance you are experiencing.',
    },
    {
      title: 'Step 3: Describe the transaction issue, if any',
      body: 'Select the HIPAA-standard transaction in question.',
    },
    {
      title: 'Step 4: Complainant information',
      body: 'Enter your details so CMS can communicate investigation results.',
    },
    {
      title: 'Step 5: Filed-Against Entity (FAE) information',
      body: 'Specify the entity responsible for the alleged non-compliance.',
    },
    {
      title: 'Step 6: Review and submit',
      body: 'Verify all provided information before submitting the allegation for processing.',
    },
  ];

  return (
    <>
      <p>
        <strong>Disclaimer:</strong> if you file a complaint without registering, you will not be
        able to view your complaint, correspond electronically, or test transactions.
      </p>

      <p>
        The following is the list of steps you will take in order to file a complaint regarding
        HIPAA Transactions and Code Sets, Unique Identifiers, and/or Operating Rules. If you wish to
        file a health insurance privacy complaint, contact the Office for Civil Rights (OCR)
        instead.
      </p>

      {steps.map((step) => (
        <div key={step.title} style={{ marginBottom: '0.85rem' }}>
          <h3 style={{ marginBottom: '0.1rem' }}>{step.title}</h3>
          <p style={{ margin: 0 }}>{step.body}</p>
        </div>
      ))}

      <p className="text-muted">
        Please review all information for accuracy and completeness before submitting. Select{' '}
        <strong>Get Started</strong> to begin.
      </p>
    </>
  );
}
