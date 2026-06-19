import { useEffect, useState } from "react";
import { listMyJobs, JobRecord } from "../lib/api";

function fmtDate(ts?: { seconds: number }) {
  if (!ts) return "";
  return new Date(ts.seconds * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function History() {
  const [jobs, setJobs] = useState<JobRecord[] | null>(null);

  useEffect(() => {
    listMyJobs().then(setJobs).catch(() => setJobs([]));
  }, []);

  return (
    <main className="app-main">
      <h2>History</h2>
      <p className="muted">
        Un-crops are kept for 30 days, then the image is removed but the record stays. Delete yours
        anytime from Account.
      </p>

      {jobs === null ? (
        <p className="muted">Loading…</p>
      ) : jobs.length === 0 ? (
        <p className="muted">No un-crops yet.</p>
      ) : (
        <div className="hist">
          {jobs.map((j) => (
            <div className="hist-item" key={j.id}>
              {j.resultUrl && !j.expired ? (
                <a href={j.resultUrl} target="_blank" rel="noreferrer">
                  <img
                    className="hist-thumb"
                    src={j.resultUrl}
                    alt={j.fileName || "result"}
                    onError={(e) => ((e.currentTarget.style.display = "none"))}
                  />
                </a>
              ) : (
                <div className="hist-thumb gone">Image removed</div>
              )}
              <div className="hist-meta">
                <strong>Un-cropped {j.fileName || "photo"}</strong>
                <div className="muted">
                  {fmtDate(j.createdAt)}
                  {j.aspectRatio ? ` · ${j.aspectRatio}` : ""}
                  {j.status === "failed" ? " · failed" : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
