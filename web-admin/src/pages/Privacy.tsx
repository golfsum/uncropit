import { Link } from "react-router-dom";
import { useSeo } from "../lib/seo";

export default function Privacy() {
  useSeo({
    title: "Privacy Policy | Uncrop it AI",
    description: "How Uncrop it AI collects, stores, and retains your data, and the choices you have.",
    path: "/privacy",
  });

  return (
    <div>
      <div className="topbar">
        <Link to="/" className="brand">◈ Uncrop it AI</Link>
        <div className="row">
          <Link to="/terms"><button className="ghost">Terms</button></Link>
        </div>
      </div>

      <div className="legal-doc">
        <h1>Privacy Policy</h1>
        <p className="muted">Last updated: June 19, 2026</p>
        <p>
          This policy explains what Uncrop it AI ("we", "us") collects, where it is stored, how long we
          keep it, and the choices you have. It applies to the Uncrop it AI iOS app and the website at
          uncropit.com.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Account info</strong>: your email address and the sign-in method you use (Email, Google, or Apple). A real account is required to use the service.</li>
          <li><strong>Photos you upload</strong>: the images you choose to un-crop.</li>
          <li><strong>AI results</strong>: the expanded images our service generates from your uploads.</li>
          <li><strong>Usage data</strong>: counts of your daily free un-crops and resizes (to enforce the free limits), your plan and remaining credits, the platform you use (app or web), and basic history records (file name, date, target ratio).</li>
          <li><strong>Support messages</strong>: anything you send us through the in-app support form.</li>
        </ul>
        <p>We do not sell your data, and we do not use your photos to train AI models.</p>

        <h2>Resizing happens on your device</h2>
        <p>
          The resize tool runs entirely in your browser or on your phone. Images you only resize are not
          uploaded to our servers or sent to any third party.
        </p>

        <h2>Where your data is stored</h2>
        <ul>
          <li><strong>Firebase Authentication</strong> holds your account (email, sign-in provider).</li>
          <li><strong>Cloud Firestore</strong> holds your profile, usage counts, plan, history records, and support tickets.</li>
          <li><strong>Cloud Storage for Firebase</strong> holds your uploaded photos and saved results.</li>
        </ul>
        <p>
          To perform an un-crop, the uploaded image is sent to our AI provider (<strong>Ideogram</strong>)
          for processing and the result is returned to us. Subscriptions are handled by Apple and RevenueCat.
          Data is processed and stored on servers located in the United States.
        </p>

        <h2>How long we keep it</h2>
        <ul>
          <li><strong>Uploaded photos</strong> are deleted automatically right after the un-crop finishes.</li>
          <li><strong>AI results</strong> are kept for <strong>30 days</strong> (for subscribers) and then deleted automatically. After deletion, a history record remains (for example, "Un-cropped photo.jpg") but the image itself is gone.</li>
          <li><strong>Account, usage data, and support tickets</strong> are kept until you delete them or close your account.</li>
        </ul>

        <h2>Your choices</h2>
        <ul>
          <li><strong>Delete your data anytime</strong>: under Account, "Delete my data" removes your uploaded photos, saved results, and history while keeping your account.</li>
          <li><strong>Delete your account anytime</strong>: "Delete account" permanently removes your account and all associated data. If you have a paid subscription, cancel it separately in your App Store account settings; deleting your account does not cancel billing.</li>
        </ul>

        <h2>Children</h2>
        <p>Uncrop it AI is not directed to children under 13, and we do not knowingly collect their data.</p>

        <h2>Contact</h2>
        <p>Questions about this policy: use the in-app support form, or contact us at support@uncropit.com.</p>

        <p className="muted" style={{ fontStyle: "italic", marginTop: 24 }}>
          This document is provided as-is and is not legal advice; have it reviewed before relying on it.
        </p>
      </div>

      <footer className="lp-footer">
        <div style={{ marginBottom: 10 }}>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/">Home</Link>
        </div>
        © {new Date().getFullYear()} Uncrop it AI: Photo Extender &amp; Resizer. All rights reserved.
      </footer>
    </div>
  );
}
