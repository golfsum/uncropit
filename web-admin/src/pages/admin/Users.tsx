import { useEffect, useState } from "react";
import {
  listUsers,
  setDisabled,
  setAdmin,
  sendPasswordReset,
  deleteUser,
  listUserJobs,
  AdminUser,
  AdminJob,
} from "../../lib/api";

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [freeLimit, setFreeLimit] = useState(3);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [openUid, setOpenUid] = useState<string | null>(null);

  async function load(pageToken?: string) {
    setLoading(true);
    try {
      const data = await listUsers(pageToken);
      setUsers((prev) => (pageToken ? [...prev, ...data.users] : data.users));
      setFreeLimit(data.freeLimit ?? 3);
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

  async function remove(u: AdminUser) {
    const who = u.email || u.displayName || u.uid;
    if (
      !confirm(
        `Permanently delete ${who}?\n\nThis removes their account, un-crop history, support tickets, and all stored images. This cannot be undone.`
      )
    )
      return;
    await act(u.uid, () => deleteUser(u.uid));
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
              <th>Plan</th>
              <th>Platform</th>
              <th>Providers</th>
              <th>Created</th>
              <th>Last sign-in</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <UserRow
                key={u.uid}
                u={u}
                freeLimit={freeLimit}
                busy={busyUid === u.uid}
                open={openUid === u.uid}
                onToggleHistory={() => setOpenUid(openUid === u.uid ? null : u.uid)}
                onDisable={() => act(u.uid, () => setDisabled(u.uid, !u.disabled))}
                onReset={() => reset(u.email)}
                onAdmin={() => act(u.uid, () => setAdmin(u.uid, !u.admin))}
                onDelete={() => remove(u)}
              />
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

function UserRow(props: {
  u: AdminUser;
  freeLimit: number;
  busy: boolean;
  open: boolean;
  onToggleHistory: () => void;
  onDisable: () => void;
  onReset: () => void;
  onAdmin: () => void;
  onDelete: () => void;
}) {
  const { u, freeLimit, busy, open } = props;
  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight: 600 }}>{u.displayName || (u.isAnonymous ? "Guest" : "-")}</div>
          <div className="muted">{u.email || u.uid.slice(0, 12) + "…"}</div>
          {u.admin && <span className="badge on">admin</span>}
        </td>
        <td>
          {u.pro ? (
            <span className="badge on">Pro</span>
          ) : (
            <span className="badge">
              Free · {Math.min(u.uncropsUsed, freeLimit)}/{freeLimit} used
            </span>
          )}
        </td>
        <td className="muted">{platformLabel(u)}</td>
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
            <button className="ghost" onClick={props.onToggleHistory}>
              {open ? "Hide history" : "History"}
            </button>
            <button className="ghost" disabled={busy} onClick={props.onDisable}>
              {u.disabled ? "Enable" : "Disable"}
            </button>
            <button className="ghost" onClick={props.onReset}>
              Reset password
            </button>
            <button className="outline" disabled={busy} onClick={props.onAdmin}>
              {u.admin ? "Revoke admin" : "Make admin"}
            </button>
            <button
              className="ghost"
              disabled={busy}
              style={{ color: "var(--danger)" }}
              onClick={props.onDelete}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} style={{ background: "rgba(255,255,255,0.02)" }}>
            <HistoryPanel uid={u.uid} />
          </td>
        </tr>
      )}
    </>
  );
}

function HistoryPanel({ uid }: { uid: string }) {
  const [jobs, setJobs] = useState<AdminJob[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    listUserJobs(uid)
      .then((j) => alive && setJobs(j))
      .catch((e) => alive && setErr(e?.message ?? "Could not load history."));
    return () => {
      alive = false;
    };
  }, [uid]);

  if (err) return <p style={{ color: "var(--danger)", margin: "10px 4px" }}>{err}</p>;
  if (!jobs) return <p className="muted" style={{ margin: "10px 4px" }}>Loading history…</p>;
  if (jobs.length === 0)
    return <p className="muted" style={{ margin: "10px 4px" }}>No activity yet.</p>;

  return (
    <div style={{ padding: "8px 4px" }}>
      {jobs.map((j) => (
        <div
          key={j.id}
          className="spread"
          style={{ padding: "6px 0", borderBottom: "1px solid var(--border, rgba(255,255,255,0.06))" }}
        >
          <span>
            {verb(j)}{" "}
            <strong>{j.fileName || "an image"}</strong>
            {j.aspectRatio ? <span className="muted"> · {j.aspectRatio}</span> : null}
            {j.status === "failed" ? <span style={{ color: "var(--danger)" }}> · failed</span> : null}
          </span>
          <span className="muted" style={{ whiteSpace: "nowrap" }}>
            {j.platform ? prettyPlatform(j.platform) + " · " : ""}
            {fmtDateTime(j.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

function verb(j: AdminJob) {
  if (j.type === "animate") return "Animated";
  return "Un-cropped";
}

function prettyPlatform(p: string) {
  if (p === "web") return "Web";
  if (p === "ios" || p === "android") return "App";
  return p;
}

/** Which platforms a user has been active on (web / app), from their profile. */
function platformLabel(u: AdminUser) {
  const set = new Set<string>();
  Object.keys(u.platforms || {}).forEach((k) => {
    if (u.platforms[k]) set.add(prettyPlatform(k));
  });
  if (set.size === 0) return u.lastPlatform ? prettyPlatform(u.lastPlatform) : "-";
  return Array.from(set).join(" + ");
}

function fmt(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}
