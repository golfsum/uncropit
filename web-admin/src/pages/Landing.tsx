import { Link } from "react-router-dom";

const features = [
  { title: "Un-crop to Widescreen", body: "Turn a tight vertical shot into a cinematic frame. AI fills the background seamlessly." },
  { title: "Animate Photos", body: "Bring still portraits to life with subtle, natural micro-expressions." },
  { title: "Private by design", body: "Built to run on the iPhone Neural Engine — your photos stay on your device." },
];

export default function Landing() {
  return (
    <div>
      <div className="topbar">
        <span className="brand">◈ Expand AI</span>
        <Link to="/login"><button className="ghost">Admin sign-in</button></Link>
      </div>

      <div className="hero">
        <h1>Un-crop & animate<br />your photos with AI</h1>
        <p>
          Expand AI extends any photo to a beautiful widescreen frame and animates faces —
          fast, private, and right on your iPhone.
        </p>
        <a href="#" onClick={(e) => e.preventDefault()}>
          <button>Download on the App Store</button>
        </a>
      </div>

      <div className="container">
        <div className="features">
          {features.map((f) => (
            <div className="card" key={f.title}>
              <h3 style={{ marginTop: 0 }}>{f.title}</h3>
              <p className="muted">{f.body}</p>
            </div>
          ))}
        </div>

        <p className="muted" style={{ textAlign: "center", marginTop: 60, fontSize: 13 }}>
          © {new Date().getFullYear()} Expand AI · <Link to="/login">Admin</Link>
        </p>
      </div>
    </div>
  );
}
