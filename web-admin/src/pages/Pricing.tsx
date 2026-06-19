import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSeo } from "../lib/seo";


type Period = "monthly" | "yearly";

const TIERS = [
  {
    id: "free",
    name: "Free",
    blurb: "For trying it out",
    monthly: 0,
    yearly: 0,
    cta: "Start free",
    highlight: false,
    features: [
      "3 un-crops every day",
      "3 resizes every day",
      "HD downloads, no watermark",
      "Works in browser + iPhone app",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For regular creators",
    monthly: 9.99,
    yearly: 99.99,
    cta: "Get Pro",
    highlight: true,
    features: [
      "100 credits / mo (un-crops + resizes)",
      "Fast TURBO processing",
      "No watermarks",
      "Saved history (30 days)",
      "Syncs across browser + app",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    blurb: "For power users & teams",
    monthly: 29.99,
    yearly: 299.99,
    cta: "Get Studio",
    highlight: false,
    features: [
      "300 credits / mo (un-crops + resizes)",
      "Everything in Pro",
      "Batch editing (multi-image)",
      "Early access to new features",
    ],
  },
];

// Full breakdown. Values are either text or a boolean (✓ / ✕).
const COMPARE: { label: string; free: string | boolean; pro: string | boolean; studio: string | boolean }[] = [
  { label: "Un-crops", free: "3 / day", pro: "100 / mo", studio: "300 / mo" },
  { label: "Resizes", free: "3 / day", pro: "1 credit ea.", studio: "1 credit ea." },
  { label: "Credits roll over", free: false, pro: false, studio: false },
  { label: "Processing", free: "Fast (TURBO)", pro: "Fast (TURBO)", studio: "Fast (TURBO)" },
  { label: "Watermark", free: "None", pro: "None", studio: "None" },
  { label: "HD downloads", free: true, pro: true, studio: true },
  { label: "Saved history (30 days)", free: false, pro: true, studio: true },
  { label: "Batch editing", free: false, pro: false, studio: true },
  { label: "Browser + iPhone app", free: true, pro: true, studio: true },
  { label: "Support", free: "Community", pro: "Email", studio: "Priority email" },
];

function cell(v: string | boolean) {
  if (v === true) return <span className="cmp-yes">✓</span>;
  if (v === false) return <span className="cmp-no">✕</span>;
  return <span>{v}</span>;
}

function savePct(monthly: number, yearly: number) {
  if (!monthly || !yearly) return 0;
  return Math.round((1 - yearly / (monthly * 12)) * 100);
}

export default function Pricing() {
  const { user, isAdmin } = useAuth();
  const [period, setPeriod] = useState<Period>("yearly");
  const buyHref = user ? "/app/account" : "/signup";

  useSeo({
    title: "Pricing | Uncrop it AI: Photo Extender & Resizer",
    description:
      "Uncrop it AI pricing: free daily un-crops and resizes, or upgrade to Pro and Studio for monthly AI credits, batch editing, and saved history. 1 credit = 1 un-crop or resize.",
    path: "/pricing",
  });

  return (
    <div>
      <div className="topbar">
        <Link to="/" className="brand">◈ Uncrop it AI</Link>
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
        <section style={{ textAlign: "center", paddingTop: 28 }}>
          <h1 className="section-title" style={{ fontSize: 40 }}>Simple, honest pricing</h1>
          <p className="section-sub">
            Start free with 3 un-crops and 3 resizes a day. Upgrade for monthly credits, batch editing, and
            saved history. 1 credit = 1 un-crop or 1 resize.
          </p>

          {/* Billing period toggle */}
          <div className="price-toggle">
            <button className={period === "monthly" ? "active" : ""} onClick={() => setPeriod("monthly")}>
              Monthly
            </button>
            <button className={period === "yearly" ? "active" : ""} onClick={() => setPeriod("yearly")}>
              Yearly <span className="save-tag">save ~17%</span>
            </button>
          </div>
        </section>

        {/* Tier cards */}
        <div className="tier-grid">
          {TIERS.map((t) => {
            const price = period === "yearly" ? t.yearly : t.monthly;
            const suffix = t.id === "free" ? "" : period === "yearly" ? "/yr" : "/mo";
            const save = savePct(t.monthly, t.yearly);
            return (
              <div key={t.id} className={"tier-card" + (t.highlight ? " featured" : "")}>
                {t.highlight && <div className="tier-flag">Most popular</div>}
                <h3 className="tier-name">{t.name}</h3>
                <p className="tier-blurb">{t.blurb}</p>
                <div className="tier-price">
                  <span className="tier-amt">${price.toFixed(price % 1 ? 2 : 0)}</span>
                  <span className="tier-suffix">{suffix}</span>
                </div>
                {t.id !== "free" && period === "yearly" && save > 0 && (
                  <div className="tier-sub">≈ ${(t.yearly / 12).toFixed(2)}/mo · save {save}%</div>
                )}
                {t.id !== "free" && period === "monthly" && (
                  <div className="tier-sub">billed monthly</div>
                )}
                {t.id === "free" && <div className="tier-sub">free forever</div>}

                <Link to={t.id === "free" ? (user ? "/app" : "/signup") : buyHref}>
                  <button className={"tier-cta" + (t.highlight ? "" : " ghost")} style={{ width: "100%", marginTop: 18 }}>
                    {t.cta}
                  </button>
                </Link>

                <ul className="tier-list">
                  {t.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="section-sub" style={{ marginTop: 18, fontSize: 13 }}>
          Paid plans are billed through the App Store in the iPhone app. Web checkout is coming soon.
          Cancel anytime; unused monthly credits do not roll over.
        </p>

        {/* Full breakdown */}
        <h2 className="section-title" style={{ marginTop: 56 }}>Compare every feature</h2>
        <div className="cmp-wrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th></th>
                <th>Free</th>
                <th className="cmp-featured">Pro</th>
                <th>Studio</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.label}>
                  <td className="cmp-label">{r.label}</td>
                  <td>{cell(r.free)}</td>
                  <td className="cmp-featured">{cell(r.pro)}</td>
                  <td>{cell(r.studio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lp-cta" style={{ marginTop: 40, textAlign: "center" }}>
          <Link to={user ? "/app" : "/signup"}><button className="btn-lg">Start free</button></Link>
        </div>
      </div>

      <footer className="lp-footer">
        <div style={{ marginBottom: 10 }}>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/login">Sign in</Link>
        </div>
        © {new Date().getFullYear()} Uncrop it AI: Photo Extender &amp; Resizer. All rights reserved.
      </footer>
    </div>
  );
}
