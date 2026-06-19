import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
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
  const { user, logout } = useAuth();
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
      // resource-exhausted = free limit reached (enforced server-side)
      setError(e?.message ?? "Something went wrong. Try again.");
    } finally {
      setStage("idle");
    }
  }

  async function download() {
    if (!resultUrl) return;
    const res = await fetch(resultUrl);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "uncropit.jpg";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const limitReached = !usage.pro && remaining <= 0;

  return (
    <div>
      <div className="topbar">
        <Link to="/" className="brand">◈ UnCrop It</Link>
        <div className="row">
          <span className="muted">{usage.pro ? "Pro" : `${remaining} free left`}</span>
          <span className="muted">{user?.email}</span>
          <button className="outline" onClick={logout}>Sign out</button>
        </div>
      </div>

      <div className="container" style={{ maxWidth: 760 }}>
        <h2>Un-crop a photo</h2>
        <p className="muted">Extend any photo to a new shape with AI. Pick a target ratio and go.</p>

        {limitReached && (
          <div className="card" style={{ borderColor: "var(--primary)", marginBottom: 16 }}>
            <strong>You've used all {FREE_LIMIT} free un-crops.</strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Upgrade to Pro for unlimited un-cropping. (Subscription coming soon.)
            </p>
          </div>
        )}

        <div className="card">
          {!localUrl ? (
            <button onClick={() => fileRef.current?.click()}>Choose a photo</button>
          ) : (
            <>
              <img
                src={resultUrl ?? localUrl}
                alt="preview"
                style={{ width: "100%", borderRadius: 12, background: "var(--surface-alt)" }}
              />
              <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {ASPECTS.map((a) => (
                  <button
                    key={a.id}
                    className={aspect === a.id ? "" : "ghost"}
                    onClick={() => setAspect(a.id)}
                  >
                    {a.id}
                  </button>
                ))}
              </div>

              <div className="row" style={{ marginTop: 14, gap: 10 }}>
                <button className="ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
                  Change photo
                </button>
                <button onClick={run} disabled={busy || limitReached}>
                  {stage === "uploading" ? "Uploading…" : stage === "processing" ? "Un-cropping…" : "Un-crop"}
                </button>
                {resultUrl && (
                  <button className="ghost" onClick={download}>
                    Download
                  </button>
                )}
              </div>
            </>
          )}

          {error && <p style={{ color: "var(--danger)", marginTop: 12 }}>{error}</p>}
        </div>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
      </div>
    </div>
  );
}
