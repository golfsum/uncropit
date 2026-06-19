import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getMyUsage, deleteAccount, createTicket } from "../lib/api";

const TERMS_URL = "https://www.ndsoft.dev/apps/uncrop-it/terms";
const PRIVACY_URL = "https://www.ndsoft.dev/apps/uncrop-it/privacy";
const CATEGORIES = ["Bug", "Billing", "Feature request", "Other"];

function provider(user: ReturnType<typeof useAuth>["user"]): string {
  if (!user) return "-";
  const map: Record<string, string> = { "google.com": "Google", "apple.com": "Apple", password: "Email" };
  const labels = user.providerData.map((p) => map[p.providerId]).filter(Boolean);
  return labels.length ? labels.join(", ") : "Email";
}

export default function Account() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [usage, setUsage] = useState({ used: 0, pro: false });
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getMyUsage().then(setUsage);
  }, []);

  const remaining = Math.max(0, 3 - usage.used);

  async function submitTicket() {
    if (subject.trim().length < 3 || message.trim().length < 5) {
      alert("Add a subject and a short description.");
      return;
    }
    try {
      setBusy("ticket");
      await createTicket({ subject, category, message });
      setSubject("");
      setMessage("");
      setSent(true);
    } catch (e: any) {
      alert(e?.message ?? "Could not send.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!confirm("Permanently delete your account, tickets, and uploads? This cannot be undone.")) return;
    try {
      setBusy("delete");
      await deleteAccount();
      await logout();
      nav("/", { replace: true });
    } catch (e: any) {
      alert(e?.message ?? "Could not delete.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="app-main">
      <h2>Account</h2>

      {/* Subscription */}
      <div className="card" style={{ borderColor: usage.pro ? "var(--accent)" : "var(--border)" }}>
        <strong>{usage.pro ? "Pro ✓" : "Free"}</strong>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          {usage.pro ? "Everything unlocked. Thanks for subscribing." : `${remaining} of 3 free un-crops left.`}
        </p>
        {!usage.pro && (
          <button style={{ marginTop: 12 }} onClick={() => alert("Subscriptions on the web are coming soon.")}>
            Upgrade to Pro
          </button>
        )}
      </div>

      {/* Identity */}
      <div className="card">
        <strong>{user?.email || "Signed in"}</strong>
        <p className="muted" style={{ margin: "6px 0 0" }}>Signed in with {provider(user)}</p>
      </div>

      {/* Support */}
      <div className="card">
        <strong>Support & feedback</strong>
        {sent ? (
          <p className="muted" style={{ marginTop: 8 }}>Thanks. We'll get back to you by email.</p>
        ) : (
          <div className="grid" style={{ marginTop: 10 }}>
            <input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea rows={3} placeholder="How can we help?" value={message} onChange={(e) => setMessage(e.target.value)} />
            <button onClick={submitTicket} disabled={busy === "ticket"}>{busy === "ticket" ? "Sending…" : "Send"}</button>
          </div>
        )}
      </div>

      {/* About */}
      <div className="card">
        <strong>About</strong>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          <a href={TERMS_URL}>Terms of Service</a>
          <a href={PRIVACY_URL}>Privacy Policy</a>
        </div>
      </div>

      <button className="outline" style={{ marginTop: 8 }} onClick={logout}>Sign out</button>
      <button className="danger" onClick={confirmDelete} disabled={busy === "delete"}>
        {busy === "delete" ? "Deleting…" : "Delete account & data"}
      </button>
    </main>
  );
}
