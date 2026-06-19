import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSeo } from "../lib/seo";

const TERMS_URL = "https://www.ndsoft.dev/apps/uncrop-it/terms";
const PRIVACY_URL = "https://www.ndsoft.dev/apps/uncrop-it/privacy";

// One frame that rotates: the original photo resized (letterbox bars) cross-
// fades to the same photo run through aiUncrop (Ideogram V3 Reframe), which
// fills the frame edge to edge. Loops so visitors see the before and after.
function RotatingDemo({ src, expanded }: { src: string; expanded: string }) {
  const [after, setAfter] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setAfter((a) => !a), 2600);
    return () => clearInterval(id);
  }, []);
  return (
    <figure className="rotdemo">
      <div className="cmp-frame">
        <img src={src} alt="original with bars" className={`rot-img bars ${after ? "rot-hide" : ""}`} />
        <img src={expanded} alt="AI un-cropped" className={`rot-img ${after ? "" : "rot-hide"}`} />
        <span className={`rot-tag ${after ? "ai" : ""}`}>
          {after ? "Uncrop it AI: no bars" : "Original: black bars"}
        </span>
      </div>
      <figcaption>Same photo, resized vs AI un-cropped.</figcaption>
    </figure>
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
    img: "/demo/f1.jpg",
  },
  {
    h: "Extend product photos beyond their borders",
    p: "Give product shots room for promotional text or resize them for any marketplace. In a few clicks you get ready-to-use images for every listing.",
    img: "/demo/f2.jpg",
  },
  {
    h: "Resize without losing quality",
    p: "Expand your photos in any direction while keeping the original quality. Built for photographers, designers, and social media managers who need high quality images instantly.",
    img: "/demo/f3.jpg",
  },
];

const FAQ = [
  { q: "What is Uncrop?", a: "Uncrop is an AI tool that extends your photo beyond its original edges, filling in new background so you can change the shape or aspect ratio without cutting out the subject." },
  { q: "Is it free?", a: "Yes. Every account gets a few free un-crops. Upgrade to Pro for unlimited use." },
  { q: "Can I use it on my phone?", a: "Yes. Uncrop it AI runs in any browser, and there is an iPhone app too. Your account syncs across both." },
  { q: "How does AI image expanding work?", a: "The AI analyzes the pixels at the edges of your photo and generates a natural continuation of the scene, matching the lighting, color, and detail." },
  { q: "Will it lower my image quality?", a: "No. Your original pixels are preserved and the new area is generated at high resolution, so the result stays sharp." },
];

export default function Landing() {
  const { user, isAdmin } = useAuth();
  const startHref = user ? "/app" : "/signup";

  useSeo({
    title: "Uncrop it AI: Photo Extender & Resizer | Expand & uncrop images with AI",
    description:
      "Free AI photo extender and image resizer. Uncrop and expand any picture beyond its edges, fill the background with AI, and resize photos for every platform — browser or iPhone.",
    path: "/",
  });

  return (
    <div>
      <div className="topbar">
        <span className="brand">◈ Uncrop it AI</span>
        <div className="row">
          <Link to="/pricing"><button className="ghost">Pricing</button></Link>
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
            Uncrop it AI: <span className="grad">Photo Extender</span><br />&amp; Image Resizer
          </h1>
          <p>
            The free AI photo extender and pic resizer. Uncrop and expand any image beyond its edges,
            let AI fill in the background, and resize for every platform — in seconds.
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
            <RotatingDemo src="/demo/before.jpg" expanded="/demo/after.jpg" />
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
              <img src={f.img} alt={f.h} loading="lazy" />
            </div>
          </div>
        ))}

        {/* Pricing teaser */}
        <h2 className="section-title">Plans for every creator</h2>
        <p className="section-sub">Free every day. Upgrade for monthly credits, batch editing, and saved history.</p>
        <div className="price-teaser">
          <div className="pt-card"><strong>Free</strong><span>3 un-crops / day</span><em>$0</em></div>
          <div className="pt-card featured"><strong>Pro</strong><span>100 credits / mo</span><em>$9.99/mo</em></div>
          <div className="pt-card"><strong>Studio</strong><span>300 credits / mo</span><em>$29.99/mo</em></div>
        </div>
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <Link to="/pricing"><button className="btn-lg">See full pricing</button></Link>
        </div>

        {/* FAQ */}
        <h2 className="section-title" style={{ marginTop: 56 }}>Frequently asked questions</h2>
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
        © {new Date().getFullYear()} Uncrop it AI: Photo Extender &amp; Resizer. All rights reserved.
      </footer>
    </div>
  );
}
