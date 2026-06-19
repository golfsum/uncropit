import { Link } from "react-router-dom";
import { useSeo } from "../lib/seo";

export default function Terms() {
  useSeo({
    title: "Terms of Service | Uncrop it AI",
    description: "The terms that govern your use of the Uncrop it AI app and website.",
    path: "/terms",
  });

  return (
    <div>
      <div className="topbar">
        <Link to="/" className="brand">◈ Uncrop it AI</Link>
        <div className="row">
          <Link to="/privacy"><button className="ghost">Privacy</button></Link>
        </div>
      </div>

      <div className="legal-doc">
        <h1>Terms of Service</h1>
        <p className="muted">Last updated: June 19, 2026</p>
        <p>By using the Uncrop it AI app or website you agree to these terms.</p>

        <h2>The service</h2>
        <p>
          Uncrop it AI lets you extend ("un-crop") and resize your images using AI. You upload or select an
          image, choose a target shape or size, and we return a generated or resized result. A real account
          (Email, Google, or Apple) is required to use the service.
        </p>

        <h2>Your content</h2>
        <ul>
          <li>You keep ownership of the images you upload and the results you generate.</li>
          <li>You confirm you have the rights to any image you upload, and that it does not break the law or infringe anyone else's rights.</li>
          <li>You grant us permission to process your image solely to provide the service (including sending it to our AI provider to generate the result).</li>
        </ul>

        <h2>Data storage and retention</h2>
        <p>
          We store your uploads and results in Google Firebase (Cloud Storage and Firestore). Uploaded photos
          are deleted right after processing, and generated results are kept for 30 days and then deleted
          automatically; a history record (such as the file name and date) may remain afterward. Resizes run
          locally and are not uploaded. You can delete your data, or your entire account, at any time from the
          Account screen. Full details are in our <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Free use and subscriptions</h2>
        <ul>
          <li>Each account includes a limited number of free un-crops and resizes per day, enforced on our servers.</li>
          <li>Continued use beyond the free daily limits requires a paid subscription (Pro or Studio), which grants monthly credits. One credit is one un-crop or one resize.</li>
          <li>Subscriptions purchased on iOS are billed through your Apple App Store account and renew automatically until cancelled. Manage or cancel in your App Store account settings. <strong>Deleting your Uncrop it AI account does not cancel an active subscription</strong>. Cancel it separately. Unused monthly credits do not roll over.</li>
        </ul>

        <h2>Acceptable use</h2>
        <p>
          Do not use Uncrop it AI to create unlawful, harmful, infringing, or deceptive content, or to attempt
          to abuse, overload, or reverse engineer the service.
        </p>

        <h2>Disclaimer and liability</h2>
        <p>
          The service is provided "as is" without warranties. To the maximum extent permitted by law, we are
          not liable for any indirect or consequential damages arising from your use of the service.
        </p>

        <h2>Changes</h2>
        <p>We may update these terms. Continued use after an update means you accept the revised terms.</p>

        <h2>Contact</h2>
        <p>Reach us through the in-app support form or at support@uncropit.com.</p>

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
