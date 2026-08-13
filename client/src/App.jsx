import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './auth.jsx';
import { Layout } from './components/Layout.jsx';
import { Home } from './pages/Home.jsx';
import { GuestWizard } from './pages/guest/GuestWizard.jsx';
import { Login } from './pages/reviewer/Login.jsx';
import { ComplaintList } from './pages/reviewer/ComplaintList.jsx';
import { ComplaintDetail } from './pages/reviewer/ComplaintDetail.jsx';

export function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/complaints/new" element={<GuestWizard />} />

          <Route path="/reviewer/login" element={<Login />} />
          <Route
            path="/reviewer/complaints"
            element={
              <RequireAuth>
                <ComplaintList />
              </RequireAuth>
            }
          />
          <Route
            path="/reviewer/complaints/:id"
            element={
              <RequireAuth>
                <ComplaintDetail />
              </RequireAuth>
            }
          />
          <Route path="/reviewer" element={<Navigate to="/reviewer/complaints" replace />} />

          <Route
            path="*"
            element={
              <div className="card">
                <h1>Page not found</h1>
                <p className="lede">That page does not exist.</p>
              </div>
            }
          />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}
