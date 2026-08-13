import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Seed from sessionStorage so a page refresh does not log the reviewer out
  // mid-task. The API restarting still invalidates the token server-side; the
  // fetch wrapper clears it locally when that shows up as a 401.
  const [reviewer, setReviewer] = useState(() =>
    tokenStore.get() ? { name: tokenStore.getName() } : null,
  );

  const login = useCallback(async (username, password) => {
    const { token, name } = await api.login(username, password);
    tokenStore.set(token, name);
    setReviewer({ name });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // A failed logout call should not strand the user in a logged-in UI -
      // clearing the local token is the part that actually matters here.
    }
    tokenStore.clear();
    setReviewer(null);
  }, []);

  const value = useMemo(() => ({ reviewer, login, logout }), [reviewer, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}

/**
 * Route guard for the reviewer area.
 *
 * This is a convenience, not a security control - every protected endpoint
 * checks the token server-side as well. Hiding a route in the client only stops
 * an honest user from wandering into a broken screen.
 */
export function RequireAuth({ children }) {
  const { reviewer } = useAuth();
  const location = useLocation();

  if (!reviewer) {
    // Remember where they were headed so login can send them back there.
    return <Navigate to="/reviewer/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
