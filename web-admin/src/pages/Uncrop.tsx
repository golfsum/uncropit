import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadUserImage, uncropImage, getMyUsage, MyUsage } from "../lib/api";
import OutOfCreditsModal from "../components/OutOfCreditsModal";

const FREE_DAILY = 3;
const ASPECTS = [
  { id: "1:1", label: "Square" },
  { id: "4:5", label: "4:5" },
  { id: "3:2", label: "Photo" },
  { id: "16:9", label: "Wide" },
  { id: "9:16", label: "Tall" },
];

export default function Uncrop() {
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [aspect, setAspect] = useState("16:9");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "processing">("idle");
  const [error, setError] = useState("");
  const [usage, setUsage] = useState<MyUsage>({ plan: "free", credits: null, freeUsedToday: 0 });
  const [limitModal, setLimitModal] = useState<{
    open: boolean;
    reason: "OUT_OF_FREE_DAILY" | "OUT_OF_CREDITS" | "GENERIC";
    message?: string;
  }>({ open: false, reason: "GENERIC" });

  useEffect(() => {
    getMyUsage().then(setUsage);
  }, [resultUrl]);

  const remaining = Math.max(0, FREE_DAILY - usage.freeUsedToday);
  const busy = stage !== "idle";
  const limitReached = usage.plan === "free" && remaining <= 0;

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
      const out = await uncropImage({ imageUrl, aspectRatio: aspect, fileName: file.name });
      setResultUrl(out.resultUrl);
    } catch (e: any) {
      const code = e?.code as string | undefined;
      const reason = e?.details?.reason as string | undefined;
      if (code === "functions/resource-exhausted" || reason === "OUT_OF_CREDITS" || reason === "OUT_OF_FREE_DAILY") {
        setLimitModal({
          open: true,
          reason: reason === "OUT_OF_CREDITS" ? "OUT_OF_CREDITS" : "OUT_OF_FREE_DAILY",
          message: e?.message,
        });
      } else {
        setError(e?.message ?? "Something went wrong. Try again.");
      }
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
            You've used all {FREE_DAILY} free un-crops for today. They reset tomorrow, or upgrade in the
            app for monthly credits.
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

      <OutOfCreditsModal
        open={limitModal.open}
        reason={limitModal.reason}
        message={limitModal.message}
        onClose={() => setLimitModal((m) => ({ ...m, open: false }))}
        onUpgrade={() => {
          setLimitModal((m) => ({ ...m, open: false }));
          navigate("/pricing");
        }}
      />
    </>
  );
}
