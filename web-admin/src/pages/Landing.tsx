import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

const features = [
  { title: "Un-crop to any shape", body: "Turn a tight crop into a widescreen, square, or vertical frame. AI extends the scene seamlessly." },
  { title: "Resize for every platform", body: "Export the right size for Instagram, TikTok, the App Store, favicons, and more." },
  { title: "Use it anywhere", body: "Right here in your browser, or on the iPhone app — your account syncs across both." },
];

export default function Landing() {
  const { user, isAdmin } = useAuth();

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

      <div className="hero">
        <h1>Un-crop & resize<br />your photos with AI</h1>
        <p>
          UnCrop It extends any photo to a beautiful new frame and resizes it for any platform —
          fast and right in your browser. Try a few for free.
        </p>
        <Link to={user ? "/app" : "/signup"}>
          <button>{user ? "Open the app" : "Start free"}</button>
        </Link>
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
          © {new Date().getFullYear()} UnCrop It · <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
