import { db, CV_DOC } from "./firebase";
import { doc, setDoc, addDoc, collection, serverTimestamp, increment } from "firebase/firestore";

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
