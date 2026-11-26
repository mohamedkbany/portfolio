import { BrowserRouter, Routes, Route, Navigate, Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, ADMIN_EMAIL } from "./firebase";
import OwnerNotifications from "./OwnerNotifications";
import Home from "./pages/Home";
import pageMetadata from "./page-metadata.json";
import Works from "./pages/Works";
import Admin from "./pages/Admin";
import { consumeOwnerRedirect, startOwnerAutoSignIn } from "./ownerTools";
import { trackCvDownload, startHeartbeat, startSessionClock, setTrackingOptOut } from "./analytics";

const WA = "https://wa.me/201025510624?text=Hello!%20I'm%20interested%20in%20professional%20video%20editing%20services.";

function Nav() {
  return (
    <header className="nav">
      <Link to="/" className="brand">
        <img src="/logo.webp" alt="Mohamed Kbany" />
        <span>MOHAMED KBANY</span>
      </Link>
      <nav>
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/works">Works</NavLink>
        <NavLink to="/works/ai">AI</NavLink>
        <NavLink to="/works/motion">Motion</NavLink>
        <NavLink to="/works/editing">Editing</NavLink>
        <NavLink to="/works/tv">TV &amp; Broadcast</NavLink>
        <a className="cta" href={WA} target="_blank" rel="noreferrer">Let's Talk</a>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-cols">
        <div>
          <h4>Quick Links</h4>
          <Link to="/">Home</Link>
          <Link to="/works">Works</Link>
          <Link to="/works/ai">Ai Works</Link>
          <Link to="/works/motion">Motion Works</Link>
          <Link to="/works/editing">Editing Works</Link>
          <Link to="/works/tv">Tv Works</Link>
        </div>
        <div>
          <h4>Get in Touch</h4>
          <p>Available for freelance &amp; collaborations</p>
          <a className="cta" href={WA} target="_blank" rel="noreferrer">Contact Me</a>
        </div>
      </div>
      <p className="copy">© 2026 Mohamed Kbany. All rights reserved.</p>
    </footer>
  );
}

function WhatsAppFloat() {
  return (
    <a className="wa-float" href={WA} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.5-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.4-.1.7.2.3.8 1.4 1.8 2.2 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.4.1.1.1.7-.1 1.3z"/></svg>
    </a>
  );
}

export { WA, Nav, Footer, WhatsAppFloat };

export const ADMIN_HOST = "mk-admin-7f3a9c.vercel.app";
const isAdminHost = window.location.hostname === ADMIN_HOST;

// Arriving from the admin app (?from=admin): remember it for this tab session and
// strip the param so shared links never leak the admin host.
try {
  const q = new URLSearchParams(window.location.search);
  if (q.get("from") === "admin") {
    sessionStorage.setItem("mk_from_admin", "1"); localStorage.setItem("mk_optout", "1");
    q.delete("from");
    const clean = window.location.pathname + (q.toString() ? "?" + q.toString() : "") + window.location.hash;
    window.history.replaceState(null, "", clean);
  }
} catch (e) {}

consumeOwnerRedirect();

function fromAdmin() {
  try { return sessionStorage.getItem("mk_from_admin") === "1"; } catch (e) { return false; }
}

export function AdminPill() {
  if (!fromAdmin()) return null;
  return (
    <a
      href="https://mk-admin-7f3a9c.vercel.app"
      style={{ position: "fixed", bottom: 18, left: 16, zIndex: 9998, background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", padding: "11px 18px", borderRadius: 999, fontWeight: 700, fontSize: 14, boxShadow: "0 8px 30px rgba(0,0,0,.45)", textDecoration: "none" }}
    >
      ← Back to Admin
    </a>
  );
}

function PageMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const m = pageMetadata.find(p => p.path === pathname);
    if (!m) return;
    document.title = m.title;
    const content = { description: m.description, 'og:title': m.title, 'og:description': m.description, 'og:url': location.origin + pathname, 'twitter:title': m.title, 'twitter:description': m.description };
    Object.entries(content).forEach(([key,value]) => document.querySelector(`meta[name="${key}"],meta[property="${key}"]`)?.setAttribute('content',value));
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', location.origin + pathname);
  }, [pathname]);
  return null;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    let active = true;
    auth.authStateReady().then(() => {
      if (!active) return;
      const u = auth.currentUser;
      if (u?.emailVerified && u.email?.toLowerCase() === ADMIN_EMAIL) setTrackingOptOut(true);
      if (!isAdminHost && fromAdmin() && !(u?.emailVerified && u.email?.toLowerCase() === ADMIN_EMAIL) && !sessionStorage.getItem("mk_owner_tried")) {
        sessionStorage.setItem("mk_owner_tried", "1"); startOwnerAutoSignIn(); return;
      }
      setAuthReady(true);
    }).catch(() => { /* Fail closed: do not start tracking without restored auth. */ });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!authReady) return;
    if (window.location.hash.includes("id_token=")) { setTrackingOptOut(true); return; }
    const q = new URLSearchParams(window.location.search);
    if (q.get("notrack") === "1") setTrackingOptOut(true);
    if (q.get("track") === "1" && !(auth.currentUser?.emailVerified && auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL)) setTrackingOptOut(false);
    startHeartbeat();
    startSessionClock();
  }, [authReady]);
  if (!authReady) return null;
  if (window.location.hash.includes("id_token=")) return <Admin />;
  return (
    <BrowserRouter><PageMetadata />
      {!isAdminHost && window.location.pathname !== "/owner-access" && <OwnerNotifications />}
      <Routes>
        {isAdminHost && <Route path="*" element={<Admin />} />}
        {!isAdminHost && <Route path="/owner-access" element={<Admin />} />}
        {!isAdminHost && <Route path="/admin-218405" element={<Navigate to="/" replace />} />}
        <Route
          path="*"
          element={
            <>
              <Routes>
                <Route path="/" element={<><main><Home /></main><WhatsAppFloat /><AdminPill /></>} />
                <Route path="/works" element={<Navigate to="/works/ai" replace />} />
                <Route path="/works/:cat" element={<><Works /><AdminPill /></>} />
              </Routes>
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
