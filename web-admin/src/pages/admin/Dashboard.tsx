import { useEffect, useState } from "react";
import { listUsers, listTickets, getUsageStats, setIdeogramBalance, UsageStats } from "../../lib/api";

function usd(n: number | null | undefined) {
  if (n == null) return "n/a";
  return "$" + n.toFixed(2);
}

export default function Dashboard() {
  const [stats, setStats] = useState({ users: 0, anon: 0, admins: 0, openTickets: 0 });
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [balanceInput, setBalanceInput] = useState("");
  const [savingBal, setSavingBal] = useState(false);

  async function loadUsage() {
    try {
      setUsage(await getUsageStats());
    } catch {
      // stats/usage may not exist yet (no calls made), leave it null
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [{ users }, open] = await Promise.all([listUsers(), listTickets("open")]);
        setStats({
          users: users.length,
          anon: users.filter((u) => u.isAnonymous).length,
          admins: users.filter((u) => u.admin).length,
          openTickets: open.length,
        });
        await loadUsage();
      } catch (e: any) {
        setError(e?.message ?? "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveBalance() {
    const v = parseFloat(balanceInput);
    if (!Number.isFinite(v) || v < 0) return alert("Enter your current Ideogram balance, e.g. 14.55");
    try {
      setSavingBal(true);
      await setIdeogramBalance(v);
      setBalanceInput("");
      await loadUsage();
    } catch (e: any) {
      alert(e?.message ?? "Could not save.");
    } finally {
      setSavingBal(false);
    }
  }

  if (loading) return <p>Loading dashboard…</p>;
  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;

  const cards = [
    { label: "Total users (first page)", value: stats.users },
    { label: "Guest (anonymous)", value: stats.anon },
    { label: "Admins", value: stats.admins },
    { label: "Open tickets", value: stats.openTickets },
  ];

  return (
    <div>
      <h2>Overview</h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {cards.map((c) => (
          <div className="card" key={c.label}>
            <div className="stat">{c.value}</div>
            <div className="muted">{c.label}</div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 18 }}>
        Counts reflect the first page (up to 200) of users. Use the Users tab to page through all accounts.
      </p>

      {/* AI provider usage (Ideogram) */}
      <h2 style={{ marginTop: 32 }}>AI usage (Ideogram)</h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="card">
          <div className="stat" style={{ color: "var(--accent)" }}>{usd(usage?.availableUsd)}</div>
          <div className="muted">Available credits (est.)</div>
        </div>
        <div className="card">
          <div className="stat">{usd(usage?.ideogramCostUsd)}</div>
          <div className="muted">Total consumed (est.)</div>
        </div>
        <div className="card">
          <div className="stat">{usage?.ideogramCalls ?? 0}</div>
          <div className="muted">Ideogram calls</div>
        </div>
        <div className="card">
          <div className="stat" style={{ fontSize: 18 }}>
            {usage?.balanceUsd != null ? usd(usage.balanceUsd) : "Not set"}
          </div>
          <div className="muted">
            Last balance entered{usage?.balanceSetAt ? ` (${fmt(usage.balanceSetAt)})` : ""}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <strong>Reconcile balance</strong>
        <p className="muted" style={{ margin: "6px 0 12px" }}>
          Ideogram has no public balance API, so paste your current balance from{" "}
          <a href="https://ideogram.ai" target="_blank" rel="noreferrer">ideogram.ai</a> billing. We then
          subtract every metered call to keep "available" current. Per-call cost is estimated from
          IDEOGRAM_COST_USD.
        </p>
        <div className="row" style={{ gap: 8, maxWidth: 360 }}>
          <input
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            inputMode="decimal"
            placeholder="Current balance, e.g. 14.55"
          />
          <button onClick={saveBalance} disabled={savingBal}>{savingBal ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function fmt(ts?: { seconds: number } | null) {
  if (!ts) return "";
  return new Date(ts.seconds * 1000).toLocaleDateString();
}
