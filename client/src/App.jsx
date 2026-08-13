import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './auth.jsx';
import { ReferenceProvider } from './reference.jsx';
import { Chrome } from './components/Chrome.jsx';
import { GuestWizard } from './pages/guest/GuestWizard.jsx';
import { Login } from './pages/reviewer/Login.jsx';
import { Queue } from './pages/reviewer/Queue.jsx';
import { Detail } from './pages/reviewer/Detail.jsx';

export function App() {
  return (
    <AuthProvider>
      <ReferenceProvider>
        <Chrome>
          <Routes>
            {/* The guest wizard is the front door - there is no separate
                landing page in this design. */}
            <Route path="/" element={<GuestWizard />} />

            <Route path="/reviewer/login" element={<Login />} />
            <Route
              path="/reviewer/complaints"
              element={
                <RequireAuth>
                  <Queue />
                </RequireAuth>
              }
            />
            <Route
              path="/reviewer/complaints/:id"
              element={
                <RequireAuth>
                  <Detail />
                </RequireAuth>
              }
            />
            <Route path="/reviewer" element={<Navigate to="/reviewer/complaints" replace />} />

            <Route
              path="*"
              element={
                <div className="container" style={{ paddingTop: 36, paddingBottom: 72 }}>
                  <div className="card card--pad">
                    <h1 style={{ fontSize: 27 }}>Page not found</h1>
                    <p style={{ color: 'var(--muted)' }}>That page does not exist.</p>
                  </div>
                </div>
              }
            />
          </Routes>
        </Chrome>
      </ReferenceProvider>
    </AuthProvider>
  );
}
