import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

// Keep in sync with functions/src/password policy if you enforce one server-side.
const RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One number", test: (p: string) => /[0-9]/.test(p) },
  { label: "One special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function Signup() {
  const { signup, loginGoogle, loginApple } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const checks = RULES.map((r) => ({ ...r, met: r.test(password) }));
  const valid = checks.every((c) => c.met) && email.includes("@");

  async function withProvider(fn: () => Promise<void>, label: string) {
    setError("");
    setBusy(true);
    try {
      await fn();
      nav("/app", { replace: true });
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
        setError(err?.message ?? `${label} failed.`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setError("");
    setBusy(true);
    try {
      await signup(email, password);
      nav("/app", { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: 64 }}>
      <Link to="/" className="brand">◈ Uncrop it AI</Link>
      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Create account</h2>
        <form onSubmit={submit} className="grid">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div style={{ display: "grid", gap: 4 }}>
            {checks.map((c) => (
              <div key={c.label} style={{ fontSize: 13, color: c.met ? "var(--accent)" : "var(--dim)" }}>
                {c.met ? "✓" : "○"} {c.label}
              </div>
            ))}
          </div>
          {error && <div style={{ color: "var(--danger)", fontSize: 14 }}>{error}</div>}
          <button disabled={busy || !valid}>{busy ? "Creating…" : "Create account"}</button>
        </form>
        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <button className="ghost" style={{ width: "100%" }} onClick={() => withProvider(loginGoogle, "Google sign-in")} disabled={busy}>
            Continue with Google
          </button>
          <button className="ghost" style={{ width: "100%" }} onClick={() => withProvider(loginApple, "Apple sign-in")} disabled={busy}>
             Continue with Apple
          </button>
        </div>
        <p className="muted" style={{ marginTop: 16, textAlign: "center" }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
