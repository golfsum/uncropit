import { useEffect, useState } from "react";
import { listUsers, listTickets } from "../../lib/api";

export default function Dashboard() {
  const [stats, setStats] = useState({ users: 0, anon: 0, admins: 0, openTickets: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      } catch (e: any) {
        setError(e?.message ?? "Failed to load.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    </div>
  );
}
