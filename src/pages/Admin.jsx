import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db, auth, googleProvider, ADMIN_EMAIL, CV_DOC } from "../firebase";
import { signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { thumb, ytId, thumbFallback } from "../youtube";
import { setTrackingOptOut } from "../analytics";


function playDing() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = playDing.ctx || (playDing.ctx = new Ctx());
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    [880, 1174.66].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const start = t + i * 0.13;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + 0.45);
    });
  } catch (e) {}
}

const CATS = ["home", "ai", "motion", "editing", "tv"];
const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/vgnnxs1g/image/upload";
const CLOUDINARY_PRESET = "kbany_uploads";

const tsOf = (e) => (e.createdAt && e.createdAt.toMillis ? e.createdAt.toMillis() : 0);
const dayKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const DAY = 86400000;
function relTime(ms) {
  if (!ms) return "";
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}


const OAUTH_CLIENT_ID = "341838685083-r2tvhqlr82mqnhtlqg0a5tr2apgv2nlf.apps.googleusercontent.com";

function manualGoogleRedirect() {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const nonce = Math.random().toString(36).slice(2);
  try {
    localStorage.setItem("mk_oauth_state", state);
    localStorage.setItem("mk_oauth_nonce", nonce);
  } catch (e) {}
  const p = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    redirect_uri: location.origin + "/",
    response_type: "id_token",
    scope: "openid email profile",
    state, nonce,
    prompt: "select_account",
  });
  location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
}

function consumeGoogleRedirect(setMsg) {
  if (!location.hash.includes("id_token=")) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const idToken = params.get("id_token");
  const state = params.get("state");
  let savedState = null, savedNonce = null;
  try {
    savedState = localStorage.getItem("mk_oauth_state");
    savedNonce = localStorage.getItem("mk_oauth_nonce");
    localStorage.removeItem("mk_oauth_state");
    localStorage.removeItem("mk_oauth_nonce");
  } catch (e) {}
  history.replaceState(null, "", location.pathname);
  if (!idToken) return;
  if (savedState && state !== savedState) { setMsg("Sign-in could not be verified. Please try again."); return; }
  try {
    const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (savedNonce && payload.nonce !== savedNonce) { setMsg("Sign-in could not be verified. Please try again."); return; }
  } catch (e) { setMsg("Sign-in could not be verified. Please try again."); return; }
  signInWithCredential(auth, GoogleAuthProvider.credential(idToken)).catch((e) => setMsg(friendlyAuthError(e)));
}

function friendlyAuthError(e) {
  if (e && (e.code === "auth/missing-initial-state" || (e.message || "").includes("missing initial state"))) {
    return "Sign-in was interrupted by this browser. Please tap the three dots menu and open this page in Chrome, then sign in again.";
  }
  return (e && e.message) || "Sign-in failed. Please try again.";
}

function Icn({ d }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
const ICONS = {
  analytics: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  logos: "M4 5h16v12H4zM4 13l4-4 5 5 3-3 4 4",
  videos: "M3 5h13v14H3zM16 10l5-3v10l-5-3",
  vanalytics: "M3 17l5-5 4 4 6-7 3 3",
  home: "M3 11l9-8 9 8M5 10v10h14V10",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 21a2 2 0 004 0",
  refresh: "M21 12a9 9 0 11-2.6-6.4M21 4v5h-5",
  sound: "M11 5L6 9H3v6h3l5 4zM15 9a4 4 0 010 6M18 6a8 8 0 010 12",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
};

function BarChart({ data, label }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="chart">
      <p className="chart-label">{label}</p>
      <div className="bars">
        {data.map((d) => (
          <div key={d.key} className="bar-col" title={`${d.key}: ${d.value}`}>
            <span className="bar-val">{d.value || ""}</span>
            <div className="bar" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
            <span className="bar-day">{d.key.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ data, label }) {
  const W = 700, H = 180, P = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const pts = data.map((d, i) => [P + (i * (W - 2 * P)) / (data.length - 1), H - P - (d.value / max) * (H - 2 * P - 20)]);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + ` L${pts[pts.length - 1][0].toFixed(1)} ${H - P} L${pts[0][0].toFixed(1)} ${H - P} Z`;
  return (
    <div className="chart">
      <p className="chart-label">{label}</p>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="line-chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lc-fill)" stroke="none" />
        <path d={line} fill="none" stroke="#2dd4bf" strokeWidth="2.5" />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#0b0b13" stroke="#2dd4bf" strokeWidth="2" />)}
        {data.map((d, i) => <text key={d.key} x={pts[i][0]} y={H + 12} textAnchor="middle" className="lc-day">{d.key.slice(5)}</text>)}
      </svg>
    </div>
  );
}

function last14(events, type) {
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const start = today.getTime() - i * DAY;
    const key = dayKey(start);
    const value = events.filter((e) => e.type === type && tsOf(e) >= start && tsOf(e) < start + DAY).length;
    out.push({ key, value });
  }
  return out;
}

function AnalyticsView({ events, videos, logos, cvViews, refreshedAt }) {
  const now = Date.now();
  const visits = events.filter((e) => e.type === "visit");
  const todayKey = dayKey(now);
  const yKey = dayKey(now - DAY);
  const monthKey = todayKey.slice(0, 7);
  const today = visits.filter((e) => dayKey(tsOf(e)) === todayKey).length;
  const yesterday = visits.filter((e) => dayKey(tsOf(e)) === yKey).length;
  const month = visits.filter((e) => dayKey(tsOf(e)).startsWith(monthKey)).length;
  const videoViews = videos.reduce((a, v) => a + (v.views || 0), 0);
  const brandOpens = logos.reduce((a, l) => a + (l.views || 0), 0);
  const online = new Set(events.filter((e) => now - tsOf(e) < 5 * 60000).map((e) => e.visitorId)).size;
  const diff = today - yesterday;
  const pct = yesterday ? Math.round((diff / yesterday) * 100) : (today ? 100 : 0);

  const feed = [...events].sort((a, b) => tsOf(b) - tsOf(a)).slice(0, 25);
  const icon = { visit: "👁", video_play: "▶", brand_open: "🏢", cv_download: "📄", heartbeat: "💓" };
  const text = (e) => {
    if (e.type === "visit") return `Visit on ${e.page || "/"}`;
    if (e.type === "video_play") return `Played "${e.title || e.videoId}" (${e.category || "?"} ${e.format || ""})`;
    if (e.type === "brand_open") return `Opened brand "${e.name || "?"}"`;
    if (e.type === "cv_download") return "CV downloaded";
    if (e.type === "heartbeat") return "Visitor still browsing";
    if (e.type === "session_end") return `Left after ${Math.round(e.seconds || 0)}s on ${e.page || "/"}`;
    return e.type;
  };

  return (
    <div>
      <div className="view-head"><h3><span className="head-icon"><Icn d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></span>Analytics</h3><span className="muted">Updated {refreshedAt}</span></div>
      <p className="muted">Website traffic overview</p>
      <div className="cards">
        <div className="card"><span>Total Visits</span><strong>{visits.length}</strong></div>
        <div className="card"><span>Today</span><strong>{today}</strong></div>
        <div className="card"><span>This Month</span><strong>{month}</strong></div>
        <div className="card"><span>CV Downloads</span><strong>{cvViews}</strong></div>
        <div className="card"><span>Video Views</span><strong>{videoViews}</strong></div>
        <div className="card"><span>Brand Opens</span><strong>{brandOpens}</strong></div>
        <div className="card live"><span>Online Now</span><strong>{online}</strong><em>LIVE</em></div>
      </div>

      <div className="panel">
        <h4>Today vs. yesterday</h4>
        <div className="vs">
          <div><span>Yesterday</span><strong>{yesterday}</strong></div>
          <div className={diff >= 0 ? "delta up" : "delta down"}>{diff >= 0 ? "+" : ""}{diff} ({diff >= 0 ? "+" : ""}{pct}%)</div>
          <div><span>Today</span><strong>{today}</strong></div>
        </div>
      </div>

      <div className="panel">
        <h4>Daily visits</h4>
        <LineChart data={last14(events, "visit")} label="Last 14 days" />
      </div>

      <div className="panel">
        <h4>Recent activity</h4>
        <div className="feed">
          {feed.length === 0 && <p className="muted">No events yet.</p>}
          {feed.map((e) => (
            <div key={e.id} className="feed-row">
              <span className="feed-icon">{icon[e.type] || "•"}</span>
              <span className="feed-text">{text(e)}</span>
              <span className="feed-time">{relTime(tsOf(e))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function VideoAnalytics({ videos, events, refreshedAt }) {
  const total = videos.length;
  const totalViews = videos.reduce((a, v) => a + (v.views || 0), 0);
  const top = [...videos].sort((a, b) => (b.views || 0) - (a.views || 0));
  const topViews = top[0] ? top[0].views || 0 : 0;
  const cats = new Set(videos.map((v) => v.category)).size;
  const byCat = CATS.map((c) => ({ key: c, value: videos.filter((v) => v.category === c).length }));
  const shorts = videos.filter((v) => v.type === "short").length;
  const longs = videos.filter((v) => v.type !== "short").length;

  const watchEvents = events.filter((e) => e.type === "video_watch");
  const watchByVideo = {};
  watchEvents.forEach((e) => {
    const k = e.videoId || "?";
    const w = (watchByVideo[k] = watchByVideo[k] || { title: e.title || k, n: 0, secs: 0, done: 0, cont: 0 });
    w.n += 1;
    w.secs += e.seconds || 0;
    if (e.completed) w.done += 1;
    if (e.followed) w.cont += 1;
  });
  const watchRows = Object.values(watchByVideo).sort((a, b) => b.n - a.n);
  const sessions = watchEvents
    .slice()
    .sort((a, b) => tsOf(b) - tsOf(a))
    .slice(0, 50);

  return (
    <div>
      <div className="view-head"><h3><span className="head-icon"><Icn d="M3 17l5-5 4 4 6-7 3 3" /></span>Video Performance</h3><span className="muted">Updated {refreshedAt}</span></div>
      <p className="muted">Track your portfolio videos and discover which ones attract the most attention.</p>

      <div className="cards">
        <div className="card"><span>Total Videos</span><strong>{total}</strong></div>
        <div className="card"><span>Total Views</span><strong>{totalViews}</strong></div>
        <div className="card"><span>Top Video Views</span><strong>{topViews}</strong></div>
        <div className="card"><span>Categories</span><strong>{cats}</strong></div>
      </div>

      <div className="panel">
        <h4>Top 5 Videos</h4>
        {top.slice(0, 5).map((v, i) => (
          <div key={v.id} className="top-row">
            <span className="rank">#{i + 1}</span>
            {thumb(v.url) && <img src={thumb(v.url)} onError={thumbFallback} alt="" />}
            <div className="top-info">
              <strong>{v.title || ytId(v.url)}</strong>
              <span className="muted">{v.category} · {v.type}</span>
            </div>
            <span className="top-views">{v.views || 0} views</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h4>Plays per day</h4>
        <BarChart data={last14(events, "video_play")} label="Last 14 days" />
      </div>

      <div className="panel">
        <h4>Watch depth per video</h4>
        {watchRows.length === 0 && <p className="muted">No watch data yet.</p>}
        {watchRows.map((w) => (
          <div key={w.title} className="top-row">
            <div className="top-info">
              <strong>{w.title}</strong>
              <span className="muted">{w.n} watches · avg {Math.round(w.secs / w.n)}s</span>
            </div>
            <span className="top-views">{Math.round((w.done / w.n) * 100)}% finished · {Math.round((w.cont / w.n) * 100)}% continued</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h4>Visitor watch sessions</h4>
        {sessions.length === 0 && <p className="muted">No sessions yet.</p>}
        {sessions.map((e) => (
          <div key={e.id} className="feed-row">
            <span className="feed-icon">{e.completed ? "✅" : "⏱"}</span>
            <span className="feed-text">{e.title || e.videoId} — {e.seconds}s{e.completed ? " (finished)" : ""}{e.followed ? " → kept watching" : ""}</span>
            <span className="feed-time">{relTime(tsOf(e))}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h4>Content Distribution</h4>
        <BarChart data={byCat} label="Videos by category" />
        <p className="muted">Short: {shorts} · Long: {longs}</p>
      </div>

      <div className="panel">
        <h4>All videos by views</h4>
        <table className="vtable">
          <thead><tr><th>#</th><th></th><th>Title</th><th>Category</th><th>Format</th><th>Views</th></tr></thead>
          <tbody>
            {top.map((v, i) => (
              <tr key={v.id}>
                <td>{i + 1}</td>
                <td>{thumb(v.url) && <img className="tthumb" src={thumb(v.url)} onError={thumbFallback} alt="" />}</td>
                <td>{v.title || ytId(v.url)}</td>
                <td>{v.category}</td>
                <td>{v.type}</td>
                <td>{v.views || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogosManager({ logos, reload, setMsg, msg }) {
  const [form, setForm] = useState({ name: "", logoUrl: "" });
  const [file, setFile] = useState(null);
  const [newVids, setNewVids] = useState([""]);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editVids, setEditVids] = useState([]);

  async function uploadLogo() {
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", CLOUDINARY_PRESET);
      const r = await fetch(CLOUDINARY_URL, { method: "POST", body: fd });
      const j = await r.json();
      if (!j.secure_url) throw new Error("Logo upload failed");
      return j.secure_url;
    }
    return form.logoUrl.trim();
  }

  async function addCompany(e) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const logo = await uploadLogo();
      if (!logo) { setMsg("Add a logo file or URL."); setBusy(false); return; }
      const urls = newVids.map((u) => u.trim()).filter((u) => ytId(u));
      const maxOrder = logos.length ? Math.max(...logos.map((l) => l.order ?? 0)) : 0;
      await addDoc(collection(db, "Logos"), {
        name: form.name.trim(), logo, videos: urls, order: maxOrder + 1, views: 0, createdAt: serverTimestamp(),
      });
      setForm({ name: "", logoUrl: "" });
      setFile(null);
      setNewVids([""]);
      setMsg("Company added.");
      reload();
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  }

  async function saveName(l) {
    await updateDoc(doc(db, "Logos", l.id), { name: l.name ?? "" });
    setMsg("Saved.");
  }

  async function remove(l) {
    if (!window.confirm(`Delete "${l.name || "company"}"?`)) return;
    await deleteDoc(doc(db, "Logos", l.id));
    reload();
  }

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= logos.length) return;
    const a = logos[i], b = logos[j];
    await updateDoc(doc(db, "Logos", a.id), { order: b.order ?? 0 });
    await updateDoc(doc(db, "Logos", b.id), { order: a.order ?? 0 });
    reload();
  }

  function startEdit(l) {
    setEditId(l.id);
    setEditVids([...(l.videos || [])]);
  }

  async function saveVids(l) {
    const urls = editVids.map((u) => u.trim()).filter((u) => ytId(u));
    await updateDoc(doc(db, "Logos", l.id), { videos: urls });
    setEditId(null);
    setMsg("Videos saved.");
    reload();
  }

  return (
    <div>
      <div className="view-head"><h3>Add company</h3></div>
      <p className="muted">Manage companies, logos and YouTube projects</p>
      <form className="add-form" onSubmit={addCompany}>
        <input placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        <input placeholder="…or logo image URL" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
        {newVids.map((u, i) => (
          <div key={i} className="vid-input-row">
            <input placeholder="YouTube video URL" value={u} onChange={(e) => setNewVids(newVids.map((x, xi) => xi === i ? e.target.value : x))} />
            <button type="button" className="btn" onClick={() => setNewVids(newVids.filter((_, xi) => xi !== i))} disabled={newVids.length === 1}>✕</button>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => setNewVids([...newVids, ""])}>+ Add video</button>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? "Uploading…" : "Add company"}</button>
      </form>
      {msg && <p className="msg">{msg}</p>}

      <div className="view-head"><h3>Companies</h3><span className="muted">{logos.length}</span></div>
      <div className="admin-list">
        {logos.map((l, i) => (
          <div key={l.id} className="admin-block">
            <div className="admin-row logo-row">
              <span className="ord">{i + 1}</span>
              <img src={l.logo} alt="" />
              <input value={l.name ?? ""} onChange={(e) => reload({ ...l, name: e.target.value })} />
              <span className="muted">{(l.videos || []).length} videos · 👁 {l.views || 0}</span>
              <button className="btn" onClick={() => saveName(l)}>Save</button>
              <button className="btn" onClick={() => (editId === l.id ? setEditId(null) : startEdit(l))}>Videos</button>
              <button className="btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button className="btn" onClick={() => move(i, 1)} disabled={i === logos.length - 1}>↓</button>
              <button className="btn danger" onClick={() => remove(l)}>Delete</button>
            </div>
            {editId === l.id && (
              <div className="edit-vids">
                {editVids.map((u, vi) => (
                  <div key={vi} className="vid-input-row">
                    {thumb(u) && <img src={thumb(u)} onError={thumbFallback} alt="" />}
                    <input value={u} onChange={(e) => setEditVids(editVids.map((x, xi) => xi === vi ? e.target.value : x))} />
                    <button className="btn" onClick={() => setEditVids(editVids.filter((_, xi) => xi !== vi))}>✕</button>
                  </div>
                ))}
                <button className="btn" onClick={() => setEditVids([...editVids, ""])}>+ Add video</button>
                <button className="btn primary" onClick={() => saveVids(l)}>Save videos</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function VideoManager({ videos, reload, setMsg, msg }) {
  const [cat, setCat] = useState("ai");
  const [fmt, setFmt] = useState("all");
  const [form, setForm] = useState({ url: "", title: "", type: "short", category: "ai" });

  const shown = videos
    .filter((v) => v.category === cat && (fmt === "all" || v.type === fmt))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  async function addVideo(e) {
    e.preventDefault();
    if (!ytId(form.url)) { setMsg("Invalid YouTube URL"); return; }
    const catDocs = videos.filter((v) => v.category === form.category);
    const minOrder = catDocs.length ? Math.min(...catDocs.map((v) => v.order ?? 0)) : 0;
    await addDoc(collection(db, "videos"), {
      url: form.url, title: form.title, type: form.type, category: form.category,
      order: minOrder - 1, views: 0, createdAt: serverTimestamp(),
    });
    setForm({ url: "", title: "", type: "short", category: form.category });
    setMsg("Added.");
    reload();
  }

  async function saveTitle(v) {
    await updateDoc(doc(db, "videos", v.id), { title: v.title ?? "" });
    setMsg("Saved.");
  }

  async function remove(v) {
    if (!window.confirm(`Delete "${v.title || v.url}"?`)) return;
    await deleteDoc(doc(db, "videos", v.id));
    reload();
  }

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= shown.length) return;
    const a = shown[i], b = shown[j];
    const ao = a.order ?? 0, bo = b.order ?? 0;
    await updateDoc(doc(db, "videos", a.id), { order: bo });
    await updateDoc(doc(db, "videos", b.id), { order: ao });
    reload();
  }

  return (
    <div>
      <div className="view-head"><h3>Video Manager</h3><span className="muted">Total: {videos.length} · On home strip: {videos.filter((v) => v.category === "home").length}</span></div>
      <form className="add-form" onSubmit={addVideo}>
        <input placeholder="YouTube URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required />
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="short">Short</option>
          <option value="long">Long</option>
        </select>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn primary" type="submit">Add to Library</button>
      </form>
      {msg && <p className="msg">{msg}</p>}

      <div className="cat-tabs">
        {CATS.map((c) => (
          <button key={c} className={c === cat ? "tab active" : "tab"} onClick={() => setCat(c)}>
            {c} ({videos.filter((v) => v.category === c).length})
          </button>
        ))}
        <select value={fmt} onChange={(e) => setFmt(e.target.value)}>
          <option value="all">All Formats</option>
          <option value="short">Shorts</option>
          <option value="long">Long Videos</option>
        </select>
      </div>

      <div className="admin-list">
        {shown.map((v, i) => (
          <div key={v.id} className="admin-row">
            {thumb(v.url) && <img src={thumb(v.url)} onError={thumbFallback} alt="" />}
            <input value={v.title ?? ""} onChange={(e) => reload({ ...v, title: e.target.value })} />
            <span className="muted">👁 {v.views || 0}</span>
            <button className="btn" onClick={() => saveTitle(v)}>Save</button>
            <button className="btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button className="btn" onClick={() => move(i, 1)} disabled={i === shown.length - 1}>↓</button>
            <button className="btn danger" onClick={() => remove(v)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ user }) {
  const [view, setView] = useState("analytics");
  const [videos, setVideos] = useState([]);
  const [logos, setLogos] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [cvViews, setCvViews] = useState(0);
  const [msg, setMsg] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem("mk_admin_sound") !== "0"; } catch (e) { return true; }
  });
  const soundRef = useRef(soundOn);
  useEffect(() => {
    soundRef.current = soundOn;
    try { localStorage.setItem("mk_admin_sound", soundOn ? "1" : "0"); } catch (e) {}
  }, [soundOn]);

  async function reload(localEdit) {
    if (localEdit) {
      if (localEdit.url !== undefined) setVideos((vs) => vs.map((v) => (v.id === localEdit.id ? localEdit : v)));
      else setLogos((ls) => ls.map((l) => (l.id === localEdit.id ? localEdit : l)));
      return;
    }
    const [v, l, a, n, cv] = await Promise.all([
      getDocs(collection(db, "videos")),
      getDocs(collection(db, "Logos")),
      getDocs(collection(db, "analytics")),
      getDocs(collection(db, "notifications")),
      getDocs(collection(db, "Cv")),
    ]);
    setVideos(v.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLogos(l.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => (x.order ?? 0) - (y.order ?? 0)));
    setEvents(a.docs.map((d) => ({ id: d.id, ...d.data() })));
    setNotifs(n.docs.map((d) => ({ id: d.id, ...d.data() })).sort((x, y) => tsOf(y) - tsOf(x)));
    const cvDoc = cv.docs.find((d) => d.id === CV_DOC) || cv.docs[0];
    setCvViews(cvDoc ? cvDoc.data().views || 0 : 0);
    setRefreshedAt(new Date().toLocaleTimeString());
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  const countsRef = useRef(null);
  const interactedRef = useRef(false);
  useEffect(() => {
    const onGesture = () => { interactedRef.current = true; };
    window.addEventListener("pointerdown", onGesture);
    const tick = async () => {
      try {
        const [a, n] = await Promise.all([
          getDocs(collection(db, "analytics")),
          getDocs(collection(db, "notifications")),
        ]);
        const c = a.size + n.size;
        if (countsRef.current === null) { countsRef.current = c; return; }
        if (c > countsRef.current) {
          countsRef.current = c;
          if (soundRef.current && interactedRef.current) playDing();
          reload();
        }
      } catch (e) {}
    };
    const iv = setInterval(tick, 15000);
    return () => { clearInterval(iv); window.removeEventListener("pointerdown", onGesture); };
  }, []);

  async function markAllRead() {
    await Promise.all(notifs.filter((n) => !n.read).map((n) => updateDoc(doc(db, "notifications", n.id), { read: true })));
    reload();
  }

  const unread = notifs.filter((n) => !n.read).length;
  const MENU = [
    ["analytics", "Analytics"],
    ["logos", "Logos"],
    ["videos", "Video Manager"],
    ["vanalytics", "Video Analytics"],
  ];

  return (
    <div className="dash">
      <aside className="side">
        <h2>Kbany Dashboard</h2>
        <p className="muted side-label">MAIN MENU</p>
        {MENU.map(([k, label]) => (
          <button key={k} className={view === k ? "side-btn active" : "side-btn"} onClick={() => setView(k)}><Icn d={ICONS[k]} />{label}</button>
        ))}
        <a className="side-btn" href="https://mohamedkbany.vercel.app"><Icn d={ICONS.home} />Back to home</a>
        <div className="side-bottom">
          <button className="side-btn notif-btn" onClick={() => setNotifOpen(!notifOpen)}>
            <Icn d={ICONS.bell} />Notifications {unread > 0 && <span className="badge">{unread}</span>}
          </button>
          <button className="side-btn" onClick={() => { setSoundOn(!soundOn); if (!soundOn) setTimeout(playDing, 50); }}>
            <Icn d={ICONS.sound} />Sound: {soundOn ? "On" : "Off"}
          </button>
          <button className="side-btn" onClick={() => reload()}><Icn d={ICONS.refresh} />Refresh</button>
          <button className="side-btn logout-btn" onClick={() => signOut(auth)}><Icn d={ICONS.logout} />Logout</button>
        </div>
      </aside>
      <main className="dash-main">
        {notifOpen && (
          <div className="panel notif-panel">
            <div className="view-head"><h4>Notifications</h4>{unread > 0 && <button className="btn" onClick={markAllRead}>Mark all read</button>}</div>
            {notifs.length === 0 && <p className="muted">No notifications yet.</p>}
            {notifs.slice(0, 30).map((n) => (
              <div key={n.id} className={n.read ? "feed-row read" : "feed-row"}>
                <span className="feed-icon">{n.icon || "🔔"}</span>
                <span className="feed-text">{n.message || n.title}</span>
                <span className="feed-time">{relTime(tsOf(n))}</span>
              </div>
            ))}
          </div>
        )}
        {loading ? <p>Loading…</p> : (
          <>
            {view === "analytics" && <AnalyticsView events={events} videos={videos} logos={logos} cvViews={cvViews} refreshedAt={refreshedAt} />}
            {view === "vanalytics" && <VideoAnalytics videos={videos} events={events} refreshedAt={refreshedAt} />}
            {view === "logos" && <LogosManager logos={logos} reload={reload} setMsg={setMsg} msg={msg} />}
            {view === "videos" && <VideoManager videos={videos} reload={reload} setMsg={setMsg} msg={msg} />}
          </>
        )}
      </main>
    </div>
  );
}

export default function Admin() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => { consumeGoogleRedirect(setMsg); }, []);
  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (u && u.email === ADMIN_EMAIL) setTrackingOptOut(true);
    setUser(u); setChecking(false);
  }), []);

  if (checking) return <div className="admin"><p>Loading…</p></div>;

  if (!user) {
    return (
      <div className="admin login">
        <h3>Admin</h3>
        <button className="btn primary" onClick={async () => {
          setMsg("");
          if (/WhatsApp|Instagram|FBAN|FBAV|FB_IAB|LinkedInApp|Telegram|TikTok|Snapchat/i.test(navigator.userAgent)) {
            manualGoogleRedirect();
            return;
          }
          try {
            await signInWithPopup(auth, googleProvider);
          } catch (e) {
            if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported", "auth/internal-error", "auth/network-request-failed", "auth/missing-initial-state"].includes(e.code)) {
              manualGoogleRedirect();
            } else if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") {
              setMsg(friendlyAuthError(e));
            }
          }
        }}>
          Sign in with Google
        </button>
        {msg && <p className="error">{msg}</p>}
      </div>
    );
  }

  if (user.email !== ADMIN_EMAIL) {
    return (
      <div className="admin login">
        <p>Signed in as {user.email}. This account is not authorized.</p>
        <button className="btn" onClick={() => signOut(auth)}>Sign out</button>
      </div>
    );
  }

  return <Dashboard user={user} />;
}
