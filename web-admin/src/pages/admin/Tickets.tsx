import { useEffect, useState, useCallback } from "react";
import {
  listTickets,
  updateTicket,
  replyTicket,
  getTicketMessages,
  AdminTicket,
  TicketMessage,
} from "../../lib/api";

const STATUSES = ["all", "open", "pending", "closed"];

export default function Tickets() {
  const [status, setStatus] = useState("open");
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [selected, setSelected] = useState<AdminTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(await listTickets(status));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function open(t: AdminTicket) {
    setSelected(t);
    setMessages(await getTicketMessages(t.id));
  }

  async function send() {
    if (!selected || reply.trim().length === 0) return;
    await replyTicket(selected.id, reply.trim());
    setReply("");
    setMessages(await getTicketMessages(selected.id));
    load();
  }

  async function changeStatus(s: string) {
    if (!selected) return;
    await updateTicket(selected.id, s);
    setSelected({ ...selected, status: s as AdminTicket["status"] });
    load();
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Support tickets</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 180 }}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr" }}>
        <div className="card" style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="muted">No tickets.</p>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => open(t)}
                style={{
                  padding: "12px 8px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: selected?.id === t.id ? "var(--surface-alt)" : "transparent",
                  borderRadius: 8,
                }}
              >
                <div className="spread">
                  <strong>{t.subject}</strong>
                  <span className={"badge " + t.status}>{t.status}</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {t.category} · {t.email || t.uid.slice(0, 10) + "…"}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          {!selected ? (
            <p className="muted">Select a ticket to view the conversation.</p>
          ) : (
            <div>
              <div className="spread">
                <h3 style={{ margin: 0 }}>{selected.subject}</h3>
                <select value={selected.status} onChange={(e) => changeStatus(e.target.value)}>
                  <option value="open">open</option>
                  <option value="pending">pending</option>
                  <option value="closed">closed</option>
                </select>
              </div>
              <p className="muted">{selected.category} · {selected.email || selected.uid}</p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "16px 0" }}>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.authorRole === "admin" ? "flex-end" : "flex-start",
                      maxWidth: "80%",
                      background: m.authorRole === "admin" ? "var(--primary)" : "var(--surface-alt)",
                      color: m.authorRole === "admin" ? "#fff" : "var(--text)",
                      padding: "10px 14px",
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>{m.authorRole}</div>
                    {m.body}
                  </div>
                ))}
              </div>

              <div className="grid">
                <textarea
                  placeholder="Type a reply…"
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <div className="row">
                  <button onClick={send} disabled={!reply.trim()}>Send reply</button>
                  <button className="outline" onClick={() => changeStatus("closed")}>Close ticket</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
