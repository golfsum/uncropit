import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadUserImage, uncropImage, getMyUsage, MyUsage } from "../lib/api";
import OutOfCreditsModal from "../components/OutOfCreditsModal";

const ASPECTS = [
  { id: "1:1", label: "Square" },
  { id: "4:5", label: "4:5" },
  { id: "3:2", label: "Photo" },
  { id: "16:9", label: "Wide" },
  { id: "9:16", label: "Tall" },
];

type Status = "pending" | "processing" | "done" | "error" | "skipped";
interface Item {
  file: File;
  localUrl: string;
  status: Status;
  resultUrl?: string;
  error?: string;
}

export default function Batch() {
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [usage, setUsage] = useState<MyUsage>({ plan: "free", credits: null, freeUsedToday: 0, resizeUsedToday: 0 });
  const [aspect, setAspect] = useState("16:9");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [limitModal, setLimitModal] = useState(false);

  useEffect(() => {
    getMyUsage().then(setUsage);
  }, []);

  const isStudio = usage.plan === "studio" || usage.plan === "admin";

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 50);
    setItems(
      files.map((f) => ({ file: f, localUrl: URL.createObjectURL(f), status: "pending" as Status }))
    );
  }

  function update(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function run() {
    if (!items.length || running) return;

    // Pre-flight credit check (admins are unlimited). Re-read usage so the count
    // is fresh, then only process what the user can afford.
    const fresh = await getMyUsage();
    setUsage(fresh);
    const unlimited = fresh.plan === "admin";
    const remaining = fresh.credits ?? 0;
    const pending = items.filter((i) => i.status !== "done").length;
    let toProcess = items.length;

    if (!unlimited) {
      if (remaining <= 0) {
        setLimitModal(true);
        return;
      }
      if (pending > remaining) {
        const ok = window.confirm(
          `You have ${remaining} credit${remaining === 1 ? "" : "s"} left but ${pending} photo${
            pending === 1 ? " is" : "s are"
          } queued.\n\nProcess the first ${remaining} now? The rest will be skipped.`
        );
        if (!ok) return;
        toProcess = remaining;
      }
    }

    setRunning(true);
    let processed = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === "done") continue;
      if (!unlimited && processed >= toProcess) {
        update(i, { status: "skipped", error: "Skipped (out of credits)" });
        continue;
      }
      processed++;
      update(i, { status: "processing", error: undefined });
      try {
        const imageUrl = await uploadUserImage(items[i].file);
        const out = await uncropImage({ imageUrl, aspectRatio: aspect, fileName: items[i].file.name });
        update(i, { status: "done", resultUrl: out.resultUrl });
      } catch (e: any) {
        const code = e?.code as string | undefined;
        const reason = e?.details?.reason as string | undefined;
        update(i, { status: "error", error: e?.message ?? "Failed" });
        if (code === "functions/resource-exhausted" || reason === "OUT_OF_CREDITS" || reason === "OUT_OF_FREE_DAILY") {
          setLimitModal(true);
          break; // out of credits - stop the batch
        }
      }
    }
    setRunning(false);
    getMyUsage().then(setUsage);
  }

  async function downloadOne(it: Item, idx: number) {
    if (!it.resultUrl) return;
    const blob = await (await fetch(it.resultUrl)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `uncropit-${idx + 1}.jpg`;
    a.click();
  }

  async function downloadAll() {
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === "done") await downloadOne(items[i], i);
    }
  }

  const doneCount = items.filter((i) => i.status === "done").length;
  const pendingCount = items.filter((i) => i.status !== "done").length;

  // --- Upsell for non-Studio users ---
  if (!isStudio) {
    return (
      <main className="app-main">
        <h2>Batch editing</h2>
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✦</div>
          <strong style={{ fontSize: 20 }}>A Studio feature</strong>
          <p className="muted" style={{ margin: "10px 0 18px" }}>
            Un-crop many photos at once with the same aspect ratio. Batch editing is included with the
            Studio plan (300 credits a month).
          </p>
          <button className="app-cta" onClick={() => navigate("/pricing")}>
            See Studio plan
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main">
      <div className="app-head">
        <h2>Batch un-crop</h2>
        <button className="ghost" onClick={() => fileRef.current?.click()} disabled={running}>
          {items.length ? "Change photos" : "Select photos"}
        </button>
      </div>

      {!items.length ? (
        <button className="app-empty" onClick={() => fileRef.current?.click()}>
          <div className="app-empty-icon">🗂️</div>
          Select multiple photos to un-crop them all
        </button>
      ) : (
        <>
          <div className="app-controls">
            <div className="ratio-label">Expand all to</div>
            <div className="ratios">
              {ASPECTS.map((a) => (
                <button
                  key={a.id}
                  className={"ratio-chip" + (aspect === a.id ? " on" : "")}
                  onClick={() => setAspect(a.id)}
                  disabled={running}
                >
                  <b>{a.id}</b>
                  <small>{a.label}</small>
                </button>
              ))}
            </div>
          </div>

          <button className="app-cta" onClick={run} disabled={running || doneCount === items.length}>
            {running
              ? `Processing ${items.filter((i) => i.status === "done").length + 1} of ${items.length}…`
              : `Un-crop all (${pendingCount} credit${pendingCount === 1 ? "" : "s"})`}
          </button>

          {doneCount > 0 && !running && (
            <div className="app-actions">
              <button className="accent" onClick={downloadAll}>Download all ({doneCount})</button>
            </div>
          )}

          <div className="batch-grid">
            {items.map((it, i) => (
              <div className="batch-item" key={i}>
                <img src={it.resultUrl || it.localUrl} alt={it.file.name} />
                <div className={"batch-status " + it.status}>
                  {it.status === "pending" && "Ready"}
                  {it.status === "processing" && "Processing…"}
                  {it.status === "done" && "Done ✓"}
                  {it.status === "skipped" && (it.error || "Skipped")}
                  {it.status === "error" && (it.error || "Failed")}
                </div>
                {it.status === "done" && (
                  <button className="ghost" onClick={() => downloadOne(it, i)}>Download</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPick} />

      <OutOfCreditsModal
        open={limitModal}
        reason="OUT_OF_CREDITS"
        onClose={() => setLimitModal(false)}
        onUpgrade={() => {
          setLimitModal(false);
          navigate("/pricing");
        }}
      />
    </main>
  );
}
