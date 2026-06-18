import { useEffect, useState } from "react";
import { listUsers, setDisabled, setAdmin, sendPasswordReset, AdminUser } from "../../lib/api";

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);

  async function load(pageToken?: string) {
    setLoading(true);
    try {
      const data = await listUsers(pageToken);
      setUsers((prev) => (pageToken ? [...prev, ...data.users] : data.users));
      setNextPage(data.nextPageToken);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function act(uid: string, fn: () => Promise<unknown>) {
    setBusyUid(uid);
    try {
      await fn();
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Action failed.");
    } finally {
      setBusyUid(null);
    }
  }

  async function reset(email: string | null) {
    if (!email) return alert("This account has no email (anonymous or provider-only).");
    try {
      const { link } = await sendPasswordReset(email);
      await navigator.clipboard.writeText(link).catch(() => undefined);
      alert("Password reset link generated and copied to clipboard.\n\n" + link);
    } catch (e: any) {
      alert(e?.message ?? "Could not generate a reset link.");
    }
  }

  const shown = users.filter(
    (u) =>
      !filter ||
      u.email?.toLowerCase().includes(filter.toLowerCase()) ||
      u.uid.includes(filter) ||
      u.displayName?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div className="spread" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Users</h2>
        <input
          placeholder="Search email, name, or UID"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ maxWidth: 300 }}
        />
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="card" style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Providers</th>
              <th>Created</th>
              <th>Last sign-in</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.uid}>
                <td>
                  <div style={{ fontWeight: 600 }}>{u.displayName || (u.isAnonymous ? "Guest" : "—")}</div>
                  <div className="muted">{u.email || u.uid.slice(0, 12) + "…"}</div>
                  {u.admin && <span className="badge on">admin</span>}
                </td>
                <td className="muted">{u.isAnonymous ? "anonymous" : u.providers.join(", ")}</td>
                <td className="muted">{fmt(u.createdAt)}</td>
                <td className="muted">{fmt(u.lastSignInAt)}</td>
                <td>
                  <span className={"badge " + (u.disabled ? "off" : "on")}>
                    {u.disabled ? "disabled" : "active"}
                  </span>
                </td>
                <td>
                  <div className="row" style={{ flexWrap: "wrap" }}>
                    <button
                      className="ghost"
                      disabled={busyUid === u.uid}
                      onClick={() => act(u.uid, () => setDisabled(u.uid, !u.disabled))}
                    >
                      {u.disabled ? "Enable" : "Disable"}
                    </button>
                    <button className="ghost" onClick={() => reset(u.email)}>Reset password</button>
                    <button
                      className="outline"
                      disabled={busyUid === u.uid}
                      onClick={() => act(u.uid, () => setAdmin(u.uid, !u.admin))}
                    >
                      {u.admin ? "Revoke admin" : "Make admin"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        {nextPage && (
          <button className="ghost" disabled={loading} onClick={() => load(nextPage)}>
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
        <span className="muted">{users.length} loaded</span>
      </div>
    </div>
  );
}

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}
