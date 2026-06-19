import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

const TERMS_URL = "https://www.ndsoft.dev/apps/uncrop-it/terms";
const PRIVACY_URL = "https://www.ndsoft.dev/apps/uncrop-it/privacy";

// Royalty-free photos (Unsplash, served via Lorem Picsum) shown being uncropped.
// Same seed at a narrow vs wide size demonstrates the AI expanding the scene.
function Demo({ seed }: { seed: string }) {
  return (
    <div className="demo">
      <div className="demo-card before">
        <img src={`https://picsum.photos/seed/${seed}/440/580`} alt="original" loading="lazy" />
        <span className="demo-tag">Original</span>
      </div>
      <span className="demo-arrow">›</span>
      <div className="demo-card after">
        <img src={`https://picsum.photos/seed/${seed}/920/580`} alt="uncropped" loading="lazy" />
        <span className="demo-tag ai">AI expanded</span>
      </div>
    </div>
  );
}

const STEPS = [
  { t: "Upload your image", d: "Choose a JPG, PNG, or HEIC file to uncrop." },
  { t: "Adjust the canvas", d: "Pick a preset aspect ratio or extend in any direction." },
  { t: "Un-crop", d: "Click Un-crop and the AI fills in the missing background in seconds." },
  { t: "Download", d: "Save your new image, share it, or keep editing." },
];

const FEATURES = [
  {
    h: "Uncrop and expand images with AI",
    p: "Extend the background of any photo to add text, fit a new layout, or meet exact dimensions. Upload your photo, choose a target shape, and the AI completes the scene in seconds.",
    seed: "studio7",
  },
  {
    h: "Extend product photos beyond their borders",
    p: "Give product shots room for promotional text or resize them for any marketplace. In a few clicks you get ready-to-use images for every listing.",
    seed: "product3",
  },
  {
    h: "Resize without losing quality",
    p: "Expand your photos in any direction while keeping the original quality. Built for photographers, designers, and social media managers who need high quality images instantly.",
    seed: "travel9",
  },
];

const FAQ = [
  { q: "What is Uncrop?", a: "Uncrop is an AI tool that extends your photo beyond its original edges, filling in new background so you can change the shape or aspect ratio without cutting out the subject." },
  { q: "Is it free?", a: "Yes. Every account gets a few free un-crops. Upgrade to Pro for unlimited use." },
  { q: "Can I use it on my phone?", a: "Yes. UnCrop It runs in any browser, and there is an iPhone app too. Your account syncs across both." },
  { q: "How does AI image expanding work?", a: "The AI analyzes the pixels at the edges of your photo and generates a natural continuation of the scene, matching the lighting, color, and detail." },
  { q: "Will it lower my image quality?", a: "No. Your original pixels are preserved and the new area is generated at high resolution, so the result stays sharp." },
];

export default function Landing() {
  const { user, isAdmin } = useAuth();
  const startHref = user ? "/app" : "/signup";

  return (
    <div>
      <div className="topbar">
        <span className="brand">◈ UnCrop It</span>
        <div className="row">
          {user ? (
            <Link to="/app"><button>Open app</button></Link>
          ) : (
            <>
              <Link to="/login"><button className="ghost">Sign in</button></Link>
              <Link to="/signup"><button>Get started</button></Link>
            </>
          )}
          {isAdmin && <Link to="/admin"><button className="outline">Admin</button></Link>}
        </div>
      </div>

      <div className="lp">
        {/* Hero */}
        <section className="lp-hero">
          <h1>
            Uncrop and <span className="grad">AI Expand</span><br />any image
          </h1>
          <p>
            Extend your photo beyond its edges with AI. Upload an image, set the new canvas,
            and watch the background complete itself in seconds.
          </p>
          <div className="lp-badges">
            <span>✓ Free HD download</span>
            <span>✓ No watermark</span>
            <span>✓ Works in your browser</span>
          </div>
          <div className="lp-cta">
            <Link to={startHref}><button className="btn-lg">Upload image</button></Link>
          </div>
          <div style={{ marginTop: 36 }}>
            <Demo seed="hero42" />
          </div>
        </section>

        {/* How to */}
        <h2 className="section-title">How to uncrop a photo</h2>
        <p className="section-sub">Four steps, a few seconds.</p>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div className="step" key={s.t}>
              <div className="step-num">{i + 1}</div>
              <h4>{s.t}</h4>
              <p>{s.d}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        {FEATURES.map((f, i) => (
          <div className={`feature-row ${i % 2 ? "reverse" : ""}`} key={f.h}>
            <div className="feature-text">
              <h3>{f.h}</h3>
              <p>{f.p}</p>
              <Link to={startHref}><button style={{ marginTop: 16 }}>Try it free</button></Link>
            </div>
            <div className="feature-media">
              <img src={`https://picsum.photos/seed/${f.seed}/960/600`} alt={f.h} loading="lazy" />
            </div>
          </div>
        ))}

        {/* FAQ */}
        <h2 className="section-title">Frequently asked questions</h2>
        <div className="faq" style={{ marginTop: 20 }}>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      <footer className="lp-footer">
        <div style={{ marginBottom: 10 }}>
          <a href={TERMS_URL}>Terms</a>
          <a href={PRIVACY_URL}>Privacy</a>
          <Link to="/login">Sign in</Link>
        </div>
        © {new Date().getFullYear()} UnCrop It. All rights reserved.
      </footer>
    </div>
  );
}
