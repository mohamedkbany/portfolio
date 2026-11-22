import { db, CV_DOC } from "./firebase";
import { doc, setDoc, addDoc, collection, serverTimestamp, increment } from "firebase/firestore";

export function visitorId() {
  let id = localStorage.getItem("mk_visitor_id");
  if (!id) {
    id = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("mk_visitor_id", id);
  }
  return id;
}

export function trackVisit() {
  if (sessionStorage.getItem("mk_visited")) return;
  sessionStorage.setItem("mk_visited", "1");
  addDoc(collection(db, "analytics"), {
    type: "visit",
    visitorId: visitorId(),
    page: window.location.pathname,
    createdAt: serverTimestamp(),
  }).catch(() => {});
}

export function bumpVideoViews(videoId) {
  setDoc(doc(db, "videos", videoId), { views: increment(1) }, { merge: true }).catch(() => {});
}

export function bumpLogoViews(logoId) {
  setDoc(doc(db, "Logos", logoId), { views: increment(1) }, { merge: true }).catch(() => {});
}

export function trackCvDownload() {
  setDoc(doc(db, "Cv", CV_DOC), { views: increment(1) }, { merge: true }).catch(() => {});
  addDoc(collection(db, "notifications"), {
    type: "cv",
    title: "CV Download",
    message: "Someone downloaded your CV.",
    icon: "\u{1F4C4}",
    read: false,
    createdAt: serverTimestamp(),
  }).catch(() => {});
}
