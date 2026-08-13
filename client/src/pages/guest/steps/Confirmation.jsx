/**
 * Terminal screen. The tracking id is the only artefact a guest leaves with, so
 * it is the loudest thing on the page - and the copy is explicit that it cannot
 * be used to look the complaint up later, because there is no guest-facing
 * status lookup by design.
 */
export function Confirmation({ trackingId }) {
  return (
    <div className="confirmation">
      <div className="alert alert--success" role="status">
        <h2 style={{ marginBottom: 0 }}>Complaint submitted successfully</h2>
      </div>

      <p className="lede" style={{ marginBottom: 0 }}>
        Complaint Reference Number
      </p>
      <strong className="confirmation__id">{trackingId}</strong>

      <p style={{ textAlign: 'left' }}>
        Thank you for submitting your complaint for compliance with the Health Insurance
        Portability and Accountability Act of 1996 (HIPAA) and the Administrative Simplification
        provisions of the Affordable Care Act (ACA). The enforcement team will review your complaint
        and contact you with a status update.
      </p>

      <div className="alert alert--warning" style={{ textAlign: 'left' }}>
        <p style={{ margin: 0 }}>
          <strong>Save this reference number now.</strong> You filed as a guest, so this complaint
          cannot be viewed, tracked, or edited online. Quote this number in any correspondence
          about it.
        </p>
      </div>

      <p className="text-small text-muted" style={{ textAlign: 'left' }}>
        If your complaint falls under the HIPAA Privacy Rule it will be referred to the Office for
        Civil Rights (OCR) and closed in this system.
      </p>
    </div>
  );
}
