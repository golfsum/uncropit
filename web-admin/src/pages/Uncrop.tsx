import { useEffect, useRef, useState } from "react";
import { uploadUserImage, uncropImage, getMyUsage } from "../lib/api";

const FREE_LIMIT = 3;
const ASPECTS = [
  { id: "1:1", label: "Square" },
  { id: "4:5", label: "4:5" },
  { id: "3:2", label: "Photo" },
  { id: "16:9", label: "Wide" },
  { id: "9:16", label: "Tall" },
];

export default function Uncrop() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [aspect, setAspect] = useState("16:9");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "processing">("idle");
  const [error, setError] = useState("");
  const [usage, setUsage] = useState({ used: 0, pro: false });

  useEffect(() => {
    getMyUsage().then(setUsage);
  }, [resultUrl]);

  const remaining = Math.max(0, FREE_LIMIT - usage.used);
  const busy = stage !== "idle";
  const limitReached = !usage.pro && remaining <= 0;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setLocalUrl(URL.createObjectURL(f));
    setResultUrl(null);
    setError("");
  }

  async function run() {
    if (!file) return;
    setError("");
    try {
      setStage("uploading");
      const imageUrl = await uploadUserImage(file);
      setStage("processing");
      const out = await uncropImage({ imageUrl, aspectRatio: aspect });
      setResultUrl(out.resultUrl);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Try again.");
    } finally {
      setStage("idle");
    }
  }

  async function download() {
    if (!resultUrl) return;
    const blob = await (await fetch(resultUrl)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "uncropit.jpg";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function share() {
    if (!resultUrl) return;
    try {
      const blob = await (await fetch(resultUrl)).blob();
      const f = new File([blob], "uncropit.jpg", { type: blob.type || "image/jpeg" });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [f] })) {
        await nav.share({ files: [f], title: "UnCrop It" });
        return;
      }
    } catch {
      /* fall through to download */
    }
    download();
  }

  const ctaLabel =
    stage === "uploading" ? "Uploading…"
    : stage === "processing" ? "Un-cropping…"
    : resultUrl ? "Un-crop again"
    : "Un-crop photo";

  return (
    <>
      <main className="app-main">
        <div className="app-head">
          <h2>Un-crop a photo</h2>
          <button className="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
            {localUrl ? "Change photo" : "Choose photo"}
          </button>
        </div>

        <div className="app-canvas">
          {!localUrl ? (
            <button className="app-empty" onClick={() => fileRef.current?.click()}>
              <span className="app-empty-icon">＋</span>
              <span>Choose a photo to un-crop</span>
            </button>
          ) : (
            <>
              <img className="app-img" src={resultUrl ?? localUrl} alt="preview" />
              {resultUrl && <span className="app-badge">✨ Result</span>}
              {busy && (
                <div className="app-overlay">
                  <div className="spinner" />
                  <span>{stage === "uploading" ? "Uploading…" : "AI is working its magic…"}</span>
                </div>
              )}
            </>
          )}
        </div>

        {limitReached && (
          <div className="app-note">
            You've used all {FREE_LIMIT} free un-crops. Upgrade to Pro for unlimited use. (Coming soon.)
          </div>
        )}

        <div className="app-controls">
          <div className="ratio-label">Expand to</div>
          <div className="ratios">
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                className={`ratio-chip ${aspect === a.id ? "on" : ""}`}
                onClick={() => setAspect(a.id)}
                disabled={busy}
              >
                <b>{a.id}</b>
                <small>{a.label}</small>
              </button>
            ))}
          </div>

          <button className="app-cta" onClick={run} disabled={!file || busy || limitReached}>
            {ctaLabel}
          </button>

          {resultUrl && !busy && (
            <div className="app-actions">
              <button className="ghost" onClick={share}>Share</button>
              <button className="accent" onClick={download}>Download</button>
            </div>
          )}

          {error && <div className="app-error">{error}</div>}
        </div>
      </main>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
    </>
  );
}
