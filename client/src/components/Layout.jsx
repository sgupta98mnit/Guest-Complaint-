import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export function Layout({ children }) {
  const { reviewer, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/reviewer/login');
  }

  return (
    <>
      {/* First tab stop on the page - lets keyboard users jump the header. */}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="site-header__brand">
            ASETT
            <span className="site-header__tagline">
              Administrative Simplification Enforcement and Testing Tool
            </span>
          </Link>

          <div className="row">
            {reviewer ? (
              <>
                <span className="text-small text-muted">
                  Signed in as <strong>{reviewer.name}</strong>
                </span>
                <button type="button" className="btn btn--secondary" onClick={handleLogout}>
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/reviewer/login" className="btn btn--primary">
                Reviewer sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="page" tabIndex={-1}>
        {children}
      </main>

      <footer className="site-footer">
        <div className="page" style={{ padding: 0 }}>
          <p style={{ margin: 0 }}>
            Prototype built for a take-home exercise. Not affiliated with CMS. All data shown is
            synthetic.
          </p>
        </div>
      </footer>
    </>
  );
}
