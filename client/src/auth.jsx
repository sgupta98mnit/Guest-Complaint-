import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

const REVIEWER_TITLE = 'Intake analyst · CMS NSG';

const initialsOf = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

const toReviewer = (name, title) => ({
  name,
  title: title || REVIEWER_TITLE,
  initials: initialsOf(name),
});

export function AuthProvider({ children }) {
  // Seeded from sessionStorage so a page refresh does not sign the reviewer out
  // mid-task. The API restarting still invalidates the token server-side; the
  // fetch wrapper clears it locally when that surfaces as a 401.
  const [reviewer, setReviewer] = useState(() =>
    tokenStore.get() ? toReviewer(tokenStore.getName()) : null,
  );

  const login = useCallback(async (username, password) => {
    const { token, name, title } = await api.login(username, password);
    tokenStore.set(token, name);
    setReviewer(toReviewer(name, title));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // A failed logout call should not strand the user in a signed-in UI -
      // clearing the local token is the part that matters.
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
 * A convenience, not a security control - every protected endpoint checks the
 * token server-side too. Hiding a route only stops an honest user wandering
 * into a broken screen.
 */
export function RequireAuth({ children }) {
  const { reviewer } = useAuth();
  const location = useLocation();

  if (!reviewer) {
    return <Navigate to="/reviewer/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
