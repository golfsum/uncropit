import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getMyUsage } from "../lib/api";

export default function AppLayout() {
  const { logout } = useAuth();
  const [usage, setUsage] = useState({ used: 0, pro: false });
  useEffect(() => {
    getMyUsage().then(setUsage);
  }, []);
  const remaining = Math.max(0, 3 - usage.used);

  return (
    <div className="app-shell">
      <header className="app-bar">
        <Link to="/" className="brand">◈ UnCrop It</Link>
        <div className="row">
          <span className="pill">{usage.pro ? "Pro" : `${remaining} free left`}</span>
          <button className="outline" onClick={logout}>Sign out</button>
        </div>
      </header>
      <nav className="app-tabs">
        <NavLink to="/app" end className={({ isActive }) => (isActive ? "active" : "")}>Un-crop</NavLink>
        <NavLink to="/app/resize" className={({ isActive }) => (isActive ? "active" : "")}>Resize</NavLink>
        <NavLink to="/app/history" className={({ isActive }) => (isActive ? "active" : "")}>History</NavLink>
        <NavLink to="/app/account" className={({ isActive }) => (isActive ? "active" : "")}>Account</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
