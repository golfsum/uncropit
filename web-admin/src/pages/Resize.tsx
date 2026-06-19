import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PLATFORMS, PNG_PLATFORMS, SizePreset } from "../lib/presets";
import { recordResize, getMyUsage, MyUsage } from "../lib/api";
import OutOfCreditsModal from "../components/OutOfCreditsModal";

const RESIZE_FREE_DAILY = 3;

type Fit = "fit" | "fill" | "stretch";
type Bg = "white" | "black" | "blur";
type Fmt = "jpg" | "png";

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}

export default function Resize() {
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [usage, setUsage] = useState<MyUsage>({ plan: "free", credits: null, freeUsedToday: 0, resizeUsedToday: 0 });
  const [limit, setLimit] = useState<{ open: boolean; reason: "OUT_OF_FREE_DAILY" | "OUT_OF_CREDITS"; message?: string }>(
    { open: false, reason: "OUT_OF_FREE_DAILY" }
  );
  const [url, setUrl] = useState<string | null>(null);
  const [platformIdx, setPlatformIdx] = useState(0);
  const [preset, setPreset] = useState<SizePreset>(PLATFORMS[0].presets[0]);
  const [custom, setCustom] = useState(false);
  const [cw, setCw] = useState("1080");
  const [ch, setCh] = useState("1080");
  const [fit, setFit] = useState<Fit>("fit");
  const [bg, setBg] = useState<Bg>("white");
  const [format, setFormat] = useState<Fmt>("jpg");
  const [busy, setBusy] = useState(false);

  const target = custom
    ? { w: Math.max(1, parseInt(cw) || 1), h: Math.max(1, parseInt(ch) || 1) }
    : { w: preset.w, h: preset.h };
  const platformName = custom ? "Custom" : PLATFORMS[platformIdx].platform;
  const pngOnly = PNG_PLATFORMS.includes(platformName);
  const isFavicon = platformName === "Favicon";
  const fmt: Fmt = pngOnly ? "png" : format;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setUrl(URL.createObjectURL(f));
  }

  async function exportBlob(): Promise<Blob> {
    const img = await loadImg(url!);
    const c = document.createElement("canvas");
    c.width = target.w;
    c.height = target.h;
    const ctx = c.getContext("2d")!;
    const tAr = target.w / target.h;
    const sAr = img.naturalWidth / img.naturalHeight;

    const cover = () => {
      let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
      if (sAr > tAr) { sw = img.naturalHeight * tAr; sx = (img.naturalWidth - sw) / 2; }
      else { sh = img.naturalWidth / tAr; sy = (img.naturalHeight - sh) / 2; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, target.w, target.h);
    };

    if (fit === "stretch") {
      ctx.drawImage(img, 0, 0, target.w, target.h);
    } else if (fit === "fill") {
      cover();
    } else {
      if (bg === "blur") { ctx.filter = "blur(28px)"; cover(); ctx.filter = "none"; }
      else { ctx.fillStyle = bg === "white" ? "#ffffff" : "#000000"; ctx.fillRect(0, 0, target.w, target.h); }
      let dw = target.w, dh = target.w / sAr;
      if (dh > target.h) { dh = target.h; dw = target.h * sAr; }
      ctx.drawImage(img, (target.w - dw) / 2, (target.h - dh) / 2, dw, dh);
    }
    return new Promise((res) => c.toBlob((b) => res(b!), fmt === "png" ? "image/png" : "image/jpeg", 0.95));
  }

  useEffect(() => {
    getMyUsage().then(setUsage);
  }, []);

  const paid = usage.plan === "pro" || usage.plan === "studio";
  const remaining = Math.max(0, RESIZE_FREE_DAILY - usage.resizeUsedToday);
  const usageLabel =
    usage.plan === "admin"
      ? "Unlimited"
      : paid
      ? `${usage.credits ?? 0} credits left`
      : `${remaining} of ${RESIZE_FREE_DAILY} resizes left today`;

  async function download() {
    if (!url) return;
    setBusy(true);
    try {
      // Render first (so a render failure isn't charged), then reserve a slot.
      const blob = await exportBlob();
      try {
        await recordResize();
      } catch (e: any) {
        const code = e?.code as string | undefined;
        const reason = e?.details?.reason as string | undefined;
        if (code === "functions/resource-exhausted" || reason === "OUT_OF_CREDITS" || reason === "OUT_OF_FREE_DAILY") {
          setLimit({ open: true, reason: reason === "OUT_OF_CREDITS" ? "OUT_OF_CREDITS" : "OUT_OF_FREE_DAILY", message: e?.message });
          return;
        }
        throw e;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = isFavicon ? `favicon.${fmt}` : `uncropit-${target.w}x${target.h}.${fmt}`;
      a.click();
      URL.revokeObjectURL(a.href);
      getMyUsage().then(setUsage);
    } finally {
      setBusy(false);
    }
  }

  const objectFit = fit === "fill" ? "cover" : fit === "stretch" ? "fill" : "contain";

  return (
    <>
      <main className="app-main">
        <div className="app-head">
          <h2>Resize</h2>
          <button className="ghost" onClick={() => fileRef.current?.click()}>{url ? "Change photo" : "Choose photo"}</button>
        </div>

        <div className="app-canvas">
          {!url ? (
            <button className="app-empty" onClick={() => fileRef.current?.click()}>
              <span className="app-empty-icon">＋</span>
              <span>Choose a photo to resize</span>
            </button>
          ) : (
            <div
              className="resize-frame"
              style={{ aspectRatio: `${target.w} / ${target.h}`, maxWidth: `calc(62vh * ${target.w} / ${target.h})` }}
            >
              {fit === "fit" && bg === "blur" && <img src={url} className="rz-blur" alt="" />}
              {fit === "fit" && bg !== "blur" && (
                <div className="rz-bg" style={{ background: bg === "white" ? "#fff" : "#000" }} />
              )}
              <img src={url} className="rz-img" style={{ objectFit }} alt="preview" />
            </div>
          )}
        </div>

        <div className="app-controls">
          {/* Platforms */}
          <div className="rz-row">
            {PLATFORMS.map((p, i) => (
              <button
                key={p.platform}
                className={`chip ${!custom && i === platformIdx ? "on" : ""}`}
                onClick={() => {
                  setCustom(false);
                  setPlatformIdx(i);
                  setPreset(p.presets[0]);
                  if (PNG_PLATFORMS.includes(p.platform)) setFit("fill");
                }}
              >
                {p.platform}
              </button>
            ))}
            <button className={`chip ${custom ? "on" : ""}`} onClick={() => setCustom(true)}>Custom</button>
          </div>

          {/* Sizes or custom */}
          {custom ? (
            <div className="row" style={{ gap: 8 }}>
              <input style={{ width: 100 }} value={cw} onChange={(e) => setCw(e.target.value)} inputMode="numeric" placeholder="W" />
              <span className="muted">×</span>
              <input style={{ width: 100 }} value={ch} onChange={(e) => setCh(e.target.value)} inputMode="numeric" placeholder="H" />
              <span className="muted">px</span>
            </div>
          ) : (
            <div className="rz-row">
              {PLATFORMS[platformIdx].presets.map((s) => (
                <button key={s.id} className={`chip ${preset.id === s.id ? "on" : ""}`} onClick={() => setPreset(s)}>
                  <b>{s.label}</b>
                  <small>{s.w}×{s.h}</small>
                </button>
              ))}
            </div>
          )}

          {/* Fit / format */}
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div className="seg">
              {(["fit", "fill", "stretch"] as Fit[]).map((f) => (
                <button key={f} className={fit === f ? "on" : ""} onClick={() => setFit(f)}>
                  {f === "fit" ? "Fit" : f === "fill" ? "Fill" : "Stretch"}
                </button>
              ))}
            </div>
            {!pngOnly && (
              <div className="seg">
                {(["jpg", "png"] as Fmt[]).map((f) => (
                  <button key={f} className={fmt === f ? "on" : ""} onClick={() => setFormat(f)}>{f.toUpperCase()}</button>
                ))}
              </div>
            )}
          </div>

          {/* Background (fit only) */}
          {fit === "fit" && (
            <div className="row" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 13 }}>Background</span>
              {(["white", "black", "blur"] as Bg[]).map((b) => (
                <button
                  key={b}
                  onClick={() => setBg(b)}
                  className={`swatch ${bg === b ? "on" : ""}`}
                  style={{ background: b === "white" ? "#fff" : b === "black" ? "#000" : "var(--surface-alt)" }}
                  title={b}
                >
                  {b === "blur" ? "blur" : ""}
                </button>
              ))}
            </div>
          )}

          {pngOnly && <div className="muted" style={{ fontSize: 13 }}>{platformName} exports as PNG.</div>}

          <button className="app-cta accent" onClick={download} disabled={!url || busy}>
            {busy ? "Exporting…" : `Download ${target.w}×${target.h} ${fmt.toUpperCase()}`}
          </button>
          <div className="muted" style={{ fontSize: 12, textAlign: "center" }}>{usageLabel}</div>
        </div>
      </main>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />

      <OutOfCreditsModal
        open={limit.open}
        reason={limit.reason}
        message={limit.message}
        onClose={() => setLimit((m) => ({ ...m, open: false }))}
        onUpgrade={() => {
          setLimit((m) => ({ ...m, open: false }));
          navigate("/pricing");
        }}
      />
    </>
  );
}
