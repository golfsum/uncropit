import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getMyUsage, MyUsage } from "../lib/api";

const FREE_DAILY = 3;

export default function AppLayout() {
  const { logout } = useAuth();
  const [usage, setUsage] = useState<MyUsage>({ plan: "free", credits: null, freeUsedToday: 0 });
  useEffect(() => {
    getMyUsage().then(setUsage);
  }, []);

  const paid = usage.plan === "pro" || usage.plan === "studio";
  const remaining = Math.max(0, FREE_DAILY - usage.freeUsedToday);
  const pill =
    usage.plan === "admin"
      ? "Admin"
      : paid
      ? `${usage.plan === "studio" ? "Studio" : "Pro"} · ${usage.credits ?? 0} credits`
      : `${remaining} free today`;

  return (
    <div className="app-shell">
      <header className="app-bar">
        <Link to="/" className="brand">◈ UnCrop It</Link>
        <div className="row">
          <span className="pill">{pill}</span>
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
