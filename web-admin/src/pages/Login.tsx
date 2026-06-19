import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { login, loginGoogle, loginApple } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Admins land on /admin, everyone else on the app - RequireAdmin guards /admin.
  async function go() {
    nav("/app", { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      go();
    } catch (err: any) {
      setError(err?.message ?? "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function withProvider(fn: () => Promise<void>, label: string) {
    setError("");
    setBusy(true);
    try {
      await fn();
      go();
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") {
        setError(err?.message ?? `${label} failed.`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, marginTop: 64 }}>
      <Link to="/" className="brand">◈ Uncrop it AI</Link>
      <div className="card" style={{ marginTop: 20 }}>
        <h2 style={{ marginTop: 0 }}>Sign in</h2>
        <form onSubmit={submit} className="grid">
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div style={{ color: "var(--danger)", fontSize: 14 }}>{error}</div>}
          <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
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
          No account? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}
