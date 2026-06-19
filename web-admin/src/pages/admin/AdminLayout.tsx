import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth";

export default function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div>
      <div className="topbar">
        <div className="row">
          <span className="brand">◈ Uncrop it AI</span>
          <nav className="admin">
            <NavLink to="/admin" end className={({ isActive }) => (isActive ? "active" : "")}>Dashboard</NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "active" : "")}>Users</NavLink>
            <NavLink to="/admin/tickets" className={({ isActive }) => (isActive ? "active" : "")}>Tickets</NavLink>
          </nav>
        </div>
        <div className="row">
          <span className="muted">{user?.email}</span>
          <button className="outline" onClick={logout}>Sign out</button>
        </div>
      </div>
      <div className="container">
        <Outlet />
      </div>
    </div>
  );
}
