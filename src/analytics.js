import { TRACKING_VERSION, VIEW_SECONDS, burstReason } from "./traffic-policy";
import { db, auth, ADMIN_EMAIL, CV_DOC, FB_PROJECT_ID, FB_API_KEY } from "./firebase";
import { doc, setDoc, addDoc, updateDoc, collection, serverTimestamp, increment } from "firebase/firestore";

// Honor ?notrack=1 / ?track=1 at module load, before any component effect runs,
// so even the very first page view of a notrack link is never recorded.
try {
  const q = new URLSearchParams(window.location.search);
  if (q.get("notrack") === "1") localStorage.setItem("mk_optout", "1");
  if (q.get("track") === "1") localStorage.removeItem("mk_optout");
} catch (e) {}

export function trackingDisabled() {
  try {
    if (auth.currentUser?.emailVerified && auth.currentUser.email?.toLowerCase() === ADMIN_EMAIL) return true;
    if (window.location.pathname === "/owner-access" || window.location.hostname === "mk-admin-7f3a9c.vercel.app") return true;
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

// Session state stays in this tab and expires after 30 minutes of inactivity.
function trafficState() {
  let state;
  try { state = JSON.parse(sessionStorage.getItem("mk_traffic_v2") || "null"); } catch (e) {}
  if (!state || Date.now() - state.lastAt > 1800000) state = { id: crypto.randomUUID(), lastAt: Date.now(), opens: [], quarantined: false };
  return state;
}
function saveTraffic(state) {
  state.lastAt = Date.now();
  try { sessionStorage.setItem("mk_traffic_v2", JSON.stringify(state)); } catch (e) {}
}
function trafficFields() {
  const state = trafficState(); saveTraffic(state);
  return { sessionId: state.id, trackingVersion: TRACKING_VERSION, trafficStatus: state.quarantined ? "quarantined" : "normal" };
}
export function trackVideoOpen(v) {
  if (trackingDisabled()) return;
  const state = trafficState(), now = Date.now();
  state.opens = [...state.opens.filter(t => now - t <= 60000), now];
  const reason = burstReason(state.opens, now);
  const newlyQuarantined = !!reason && !state.quarantined;
  if (reason) state.quarantined = true;
  saveTraffic(state);
  if (newlyQuarantined) logEvent("session_quarantine", { reason, reviewStatus: "pending", openingsIn60s: state.opens.length });
  logEvent("video_open", { videoId: v.id || v.url || "", title: v.title || "", category: v.category || "", format: v.type || "" });
}
export function trackMeasuredView(v, seconds, playbackId) {
  if (trackingDisabled() || seconds < VIEW_SECONDS || !v.id) return;
  logEvent("video_view", { videoId: v.id, title: v.title || "", category: v.category || "", measuredSeconds: Math.floor(seconds), playbackId });
  if (!trafficState().quarantined) notify("video_view", "Video viewed", `Measured playback: ${v.title || "video"}`, "▶", { videoId: v.id, title: v.title || "" });
}

// Country-level geo, resolved client-side right after a visit is logged and
// merged into the visit's own document. Fire-and-forget: analytics never
// blocks on this, and a failed lookup simply leaves the event without geo.
async function attachGeo(ref) {
  try {
    let g = null;
    try {
      const j = await (await fetch("https://ipwho.is/")).json();
      if (j && j.success !== false && j.country) g = { country: String(j.country), countryCode: String(j.country_code || ""), city: String(j.city || "") };
    } catch (e) {}
    if (!g) {
      try {
        const j = await (await fetch("https://ipapi.co/json/")).json();
        if (j && j.country_name) g = { country: String(j.country_name), countryCode: String(j.country_code || ""), city: String(j.city || "") };
      } catch (e) {}
    }
    if (g) await updateDoc(ref, g);
  } catch (e) {}
}

export function logEvent(type, extra = {}) {
  if (trackingDisabled()) return;
  const p = addDoc(collection(db, "analytics"), {
    type,
    visitorId: visitorId(),
    page: window.location.pathname,
    createdAt: serverTimestamp(),
    ...trafficFields(),
    ...extra,
  });
  if (type === "visit") p.then((ref) => attachGeo(ref)).catch(() => {});
  else p.catch(() => {});
}

// Persist an admin Notifications entry for alert-worthy events. Written by the
// visitor's browser so the record exists even when the admin panel is closed.
// Burst visits are hidden in the panel (same bot filter as Analytics) and
// purged by the sweep, so they never accumulate as visible noise.
export function notify(type, title, message, icon, extra = {}) {
  if (trackingDisabled()) return;
  addDoc(collection(db, "notifications"), {
    type,
    title,
    message,
    icon,
    read: false,
    visitorId: visitorId(),
    page: window.location.pathname,
    createdAt: serverTimestamp(),
    ...trafficFields(),
    ...extra,
  }).catch(() => {});
}

export function trackVisit() {
  if (trackingDisabled()) return;
  if (sessionStorage.getItem("mk_visited")) return;
  sessionStorage.setItem("mk_visited", "1");
  logEvent("visit");
  notify("visit", "New visit", `New visit on ${window.location.pathname}`, "\u{1F441}");
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
    ...Object.fromEntries(Object.entries(trafficFields()).map(([k,v]) => [k, toField(v)])),
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

// Existing callers now record openings, never counter increments.
export function trackVideoPlay(v) { trackVideoOpen(v); }

export function bumpLogoViews(logoId) {
  if (trackingDisabled()) return;
  setDoc(doc(db, "Logos", logoId), { views: increment(1) }, { merge: true }).catch(() => {});
}

export function trackLogoOpen(l) {
  bumpLogoViews(l.id);
  logEvent("brand_open", { logoId: l.id, name: l.name || "" });
  notify("brand_open", "Brand opened", `Opened ${l.name || "a brand logo"}`, "\u{1F3E2}");
}

export function trackCvDownload() {
  if (trackingDisabled()) return;
  setDoc(doc(db, "Cv", CV_DOC), { views: increment(1) }, { merge: true }).catch(() => {});
  logEvent("cv_download");
  notify("cv", "CV Download", "Someone downloaded your CV.", "\u{1F4C4}");
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
