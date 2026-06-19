import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AppLayout from "./pages/AppLayout";
import Uncrop from "./pages/Uncrop";
import Batch from "./pages/Batch";
import Resize from "./pages/Resize";
import History from "./pages/History";
import Account from "./pages/Account";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Users from "./pages/admin/Users";
import Tickets from "./pages/admin/Tickets";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container">Loading…</div>;
  // Web requires a real account (Google/Apple/email). Anonymous guests are sent
  // to sign in, since incognito would otherwise reset their free quota.
  if (!user || user.isAnonymous) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="container">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <div className="container">You are signed in but not an admin.</div>;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* The app - un-crop, resize, account. Requires any signed-in account. */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Uncrop />} />
        <Route path="batch" element={<Batch />} />
        <Route path="resize" element={<Resize />} />
        <Route path="history" element={<History />} />
        <Route path="account" element={<Account />} />
      </Route>

      {/* Admin dashboard - requires the admin custom claim */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="tickets" element={<Tickets />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
