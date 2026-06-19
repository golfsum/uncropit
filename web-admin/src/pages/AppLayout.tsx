import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../lib/auth";
import { db, auth } from "../lib/firebase";

const FREE_DAILY = 3;
type Plan = "free" | "pro" | "studio" | "admin";

export default function AppLayout() {
  const { logout } = useAuth();
  const [plan, setPlan] = useState<Plan>("free");
  const [credits, setCredits] = useState<number | null>(null);
  const [freeUsedToday, setFreeUsedToday] = useState(0);

  // Live-read plan / credits / daily usage so the pill updates after each job.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const today = new Date().toISOString().slice(0, 10);
    return onSnapshot(doc(db, "users", uid), (snap) => {
      const d = snap.data() || {};
      const p: Plan =
        d.role === "admin" ? "admin" : d.plan === "pro" || d.plan === "studio" ? d.plan : "free";
      setPlan(p);
      setCredits(p === "pro" || p === "studio" ? d.credits ?? 0 : null);
      setFreeUsedToday(d.freeDate === today ? d.freeUsed || 0 : 0);
    });
  }, []);

  const paid = plan === "pro" || plan === "studio";
  const remaining = Math.max(0, FREE_DAILY - freeUsedToday);
  const pill =
    plan === "admin"
      ? "Admin"
      : paid
      ? `${plan === "studio" ? "Studio" : "Pro"} · ${credits ?? 0} credits`
      : `${remaining} free today`;

  return (
    <div className="app-shell">
      <header className="app-bar">
        <Link to="/" className="brand">◈ UnCrop It</Link>
        <div className="row">
          <Link to="/app/account" className={"pill" + (!paid && remaining <= 0 ? " pill-low" : "")} title="View plan & credits">
            {pill}
          </Link>
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
