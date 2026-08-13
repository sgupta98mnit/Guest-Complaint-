import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth.jsx';
import { TextField } from '../../components/Field.jsx';

export function Login() {
  const { reviewer, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Where the guard sent them from, so sign-in returns them to the page they
  // actually wanted rather than always dumping them on the queue.
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
    <div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1>Reviewer sign in</h1>
      <p className="lede">Internal complaint review. Authorized personnel only.</p>

      {error && (
        <div className="alert alert--error" role="alert">
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
          // spelling corrections; both silently break a login.
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

        <button type="submit" className="btn btn--primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {/* This is a prototype with one hardcoded account and the credentials are
          in the README anyway. A real deployment obviously does not advertise
          them on the login screen. */}
      <div className="dev-note" style={{ marginTop: '1.5rem', marginBottom: 0 }}>
        <strong>Demo credentials:</strong> <span className="mono">reviewer</span> /{' '}
        <span className="mono">reviewer123</span>
      </div>
    </div>
  );
}
