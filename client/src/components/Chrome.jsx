import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

/**
 * Shared page chrome: the official-prototype alert bar, the header (which
 * differs for guests and signed-in reviewers), and the footer.
 */
export function Chrome({ children }) {
  const { reviewer, logout } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await logout();
    navigate('/');
  }

  return (
    <div className="app-shell">
      {/* First tab stop on the page - lets keyboard users jump the header. */}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <div className="alert-bar">
        <div className="container alert-bar__inner">
          <span className="alert-bar__dot" aria-hidden="true" />
          <span>An official prototype — Centers for Medicare &amp; Medicaid Services pattern study</span>
        </div>
      </div>

      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand">
            <span className="brand__tile" aria-hidden="true">
              AS
            </span>
            <span>
              <span className="brand__name">ASETT</span>
              <span className="brand__sub">
                Administrative Simplification Enforcement &amp; Testing Tool
              </span>
            </span>
          </Link>

          {reviewer ? (
            <div className="reviewer-chip">
              <div className="reviewer-chip__text">
                <div className="reviewer-chip__name">{reviewer.name}</div>
                <div className="reviewer-chip__role">{reviewer.title}</div>
              </div>
              <div className="reviewer-chip__avatar" aria-hidden="true">
                {reviewer.initials}
              </div>
              <button type="button" className="btn btn--secondary" onClick={handleSignOut}>
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/reviewer/login" className="btn btn--outline-primary">
              Reviewer sign in
            </Link>
          )}
        </div>
      </header>

      <main id="main-content" className="app-shell__main" tabIndex={-1}>
        {children}
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div>
            Prototype built for a take-home exercise. Not affiliated with CMS. All data shown is
            synthetic.
          </div>
          <div className="site-footer__links">
            <a href="https://github.com/sgupta98mnit/Guest-Complaint-#data-model">Data model</a>
            <a href="https://github.com/sgupta98mnit/Guest-Complaint-#readme">README</a>
            <a href="https://github.com/sgupta98mnit/Guest-Complaint-#accessibility">Accessibility</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
