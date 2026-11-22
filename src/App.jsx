import { BrowserRouter, Routes, Route, Navigate, Link, NavLink } from "react-router-dom";
import { useEffect } from "react";
import Home from "./pages/Home";
import Works from "./pages/Works";
import Admin from "./pages/Admin";
import { trackCvDownload } from "./analytics";

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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin-218405" element={<Admin />} />
        <Route
          path="*"
          element={
            <>
              <Nav />
              <main>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/works" element={<Navigate to="/works/ai" replace />} />
                  <Route path="/works/:cat" element={<Works />} />
                </Routes>
              </main>
              <Footer />
              <WhatsAppFloat />
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
