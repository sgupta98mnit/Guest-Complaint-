import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { TextField } from '../../components/Field.jsx';

/**
 * The prototype jumps straight from "Reviewer sign in" to the queue as a demo
 * convenience. The handoff's state notes call for a real gate, so this screen
 * sits in between - a single hardcoded account, as specified.
 */
export function Login() {
  const { reviewer, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Where the guard sent them from, so sign-in returns them to the page they
  // actually wanted rather than always the queue.
  const destination = location.state?.from || '/reviewer/complaints';

  if (reviewer) return <Navigate to={destination} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.status === 401 ? 'Incorrect username or password.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 72 }}>
      <div className="card card--pad" style={{ maxWidth: 460, margin: '0 auto' }}>
        <div className="eyebrow">Intake review</div>
        <h1 style={{ fontSize: 27, letterSpacing: '-0.015em', margin: '8px 0 6px' }}>
          Reviewer sign in
        </h1>
        <p style={{ color: 'var(--muted)', margin: '0 0 22px' }}>
          Internal complaint review. Authorized personnel only.
        </p>

        {error && (
          <div className="callout callout--error" role="alert" style={{ marginBottom: 20 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <TextField
            id="username"
            label="Username"
            required
            value={username}
            onChange={setUsername}
            autoComplete="username"
            // Mobile keyboards capitalise the first letter and browsers offer
            // spelling corrections; both silently break a sign-in.
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <TextField
            id="password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          <button type="submit" className="btn btn--primary btn--full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* One hardcoded account, and the credentials are in the README anyway.
            A real deployment obviously does not advertise them on the form. */}
        <div className="callout callout--scope" style={{ marginTop: 24 }}>
          <strong>Demo credentials:</strong> <span className="mono">reviewer</span> /{' '}
          <span className="mono">reviewer123</span>
        </div>
      </div>
    </div>
  );
}
