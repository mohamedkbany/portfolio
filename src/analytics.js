import { db, CV_DOC, FB_PROJECT_ID, FB_API_KEY } from "./firebase";
import { doc, setDoc, addDoc, collection, serverTimestamp, increment } from "firebase/firestore";

// Honor ?notrack=1 / ?track=1 at module load, before any component effect runs,
// so even the very first page view of a notrack link is never recorded.
try {
  const q = new URLSearchParams(window.location.search);
  if (q.get("notrack") === "1") localStorage.setItem("mk_optout", "1");
  if (q.get("track") === "1") localStorage.removeItem("mk_optout");
} catch (e) {}

export function trackingDisabled() {
  try {
    return localStorage.getItem("mk_optout") === "1";
  } catch (e) {
    return false;
  }
}

export function setTrackingOptOut(on) {
  try {
    if (on) localStorage.setItem("mk_optout", "1");
    else localStorage.removeItem("mk_optout");
  } catch (e) {}
}

export function visitorId() {
  let id = localStorage.getItem("mk_visitor_id");
  if (!id) {
    id = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("mk_visitor_id", id);
  }
  return id;
}

export function logEvent(type, extra = {}) {
  if (trackingDisabled()) return;
  addDoc(collection(db, "analytics"), {
    type,
    visitorId: visitorId(),
    page: window.location.pathname,
    createdAt: serverTimestamp(),
    ...extra,
  }).catch(() => {});
}

export function trackVisit() {
  if (trackingDisabled()) return;
  if (sessionStorage.getItem("mk_visited")) return;
  sessionStorage.setItem("mk_visited", "1");
  logEvent("visit");
}

let hbStarted = false;
export function startHeartbeat() {
  if (trackingDisabled()) return;
  if (hbStarted) return;
  hbStarted = true;
  setInterval(() => {
    if (document.visibilityState === "visible") logEvent("heartbeat");
  }, 120000);
}

// --- Session duration + tab-close flush (REST beacon, survives pagehide) ---
const REST_BASE = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT_ID}/databases/(default)/documents`;

function toField(v) {
  if (typeof v === "number") return { integerValue: String(Math.round(v)) };
  if (typeof v === "boolean") return { booleanValue: v };
  return { stringValue: String(v ?? "") };
}

// Fire-and-forget write that outlives the page (keepalive). Used for events
// fired while the tab is hiding/closing, where the Firestore SDK may not flush.
export function beaconEvent(type, extra = {}) {
  if (trackingDisabled()) return;
  const fields = {
    type: toField(type),
    visitorId: toField(visitorId()),
    page: toField(window.location.pathname),
    createdAt: { timestampValue: new Date().toISOString() },
  };
  for (const [k, v] of Object.entries(extra)) fields[k] = toField(v);
  try {
    fetch(`${REST_BASE}/analytics?key=${FB_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
}

let watchFlush = null;
export function setWatchFlush(fn) {
  watchFlush = fn;
}

let sessionStarted = false;
let visStart = null;

function flushSession(reason) {
  if (visStart == null) return;
  const secs = (Date.now() - visStart) / 1000;
  visStart = null;
  // Flush any in-progress video watch first, so watch depth survives a tab close.
  try { if (watchFlush) watchFlush(); } catch (e) {}
  if (secs >= 1) beaconEvent("session_end", { seconds: secs, reason });
}

export function startSessionClock() {
  if (trackingDisabled()) return;
  if (sessionStarted) return;
  sessionStarted = true;
  if (document.visibilityState === "visible") visStart = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (trackingDisabled()) return;
    if (document.visibilityState === "hidden") flushSession("hidden");
    else if (visStart == null) visStart = Date.now();
  });
  window.addEventListener("pagehide", () => {
    if (trackingDisabled()) return;
    flushSession("pagehide");
  });
}

export function bumpVideoViews(videoId) {
  if (trackingDisabled()) return;
  setDoc(doc(db, "videos", videoId), { views: increment(1) }, { merge: true }).catch(() => {});
}

export function trackVideoPlay(v) {
  bumpVideoViews(v.id);
  logEvent("video_play", {
    videoId: v.id,
    title: v.title || "",
    category: v.category || "",
    format: v.type || "",
  });
}

export function bumpLogoViews(logoId) {
  if (trackingDisabled()) return;
  setDoc(doc(db, "Logos", logoId), { views: increment(1) }, { merge: true }).catch(() => {});
}

export function trackLogoOpen(l) {
  bumpLogoViews(l.id);
  logEvent("brand_open", { logoId: l.id, name: l.name || "" });
}

export function trackCvDownload() {
  if (trackingDisabled()) return;
  setDoc(doc(db, "Cv", CV_DOC), { views: increment(1) }, { merge: true }).catch(() => {});
  logEvent("cv_download");
  addDoc(collection(db, "notifications"), {
    type: "cv",
    title: "CV Download",
    message: "Someone downloaded your CV.",
    icon: "\u{1F4C4}",
    read: false,
    createdAt: serverTimestamp(),
  }).catch(() => {});
}

export function trackWatch(v, seconds, completed, followed) {
  if (trackingDisabled()) return;
  logEvent("video_watch", {
    videoId: v.id || v.url || "",
    title: v.title || "",
    category: v.category || "",
    seconds: Math.round(seconds),
    completed: !!completed,
    followed: !!followed,
  });
}
