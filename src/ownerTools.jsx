import { useEffect, useState } from "react";
import { auth, db, ADMIN_EMAIL } from "./firebase";
import { onAuthStateChanged, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc, getDocs, collection, addDoc, updateDoc, setDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { ytId } from "./youtube";

const OAUTH_CLIENT_ID = "341838685083-r2tvhqlr82mqnhtlqg0a5tr2apgv2nlf.apps.googleusercontent.com";
const META_ID = "_ownerBackup";

export function isOwnerUser(u) {
  return !!(u && u.emailVerified && u.email && u.email.toLowerCase() === ADMIN_EMAIL);
}

export function useOwner() {
  const [owner, setOwner] = useState(isOwnerUser(auth.currentUser));
  useEffect(() => onAuthStateChanged(auth, (u) => setOwner(isOwnerUser(u))), []);
  return owner;
}

// Silent Google sign-in for the owner only (prompt=none: no screen is ever shown to a visitor).
export function startOwnerAutoSignIn() {
  try {
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("mk_owner_state", state);
    localStorage.setItem("mk_owner_nonce", nonce);
    sessionStorage.setItem("mk_owner_next", location.pathname + location.search);
    const p = new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      redirect_uri: location.origin + "/",
      response_type: "id_token",
      scope: "openid email profile",
      state, nonce,
      prompt: "none",
      login_hint: ADMIN_EMAIL,
    });
    location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
  } catch (e) {}
}

// Runs at load. Only acts on a response to a request we started (state must match).
export function consumeOwnerRedirect() {
  try {
    if (!location.hash || !/[#&](id_token|error)=/.test(location.hash)) return false;
    const savedState = localStorage.getItem("mk_owner_state");
    if (!savedState) return false;
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.get("state") !== savedState) return false;
    const savedNonce = localStorage.getItem("mk_owner_nonce");
    localStorage.removeItem("mk_owner_state");
    localStorage.removeItem("mk_owner_nonce");
    const next = sessionStorage.getItem("mk_owner_next") || "/";
    sessionStorage.removeItem("mk_owner_next");
    history.replaceState(null, "", next);
    const idToken = params.get("id_token");
    if (!idToken) return true;
    const payload = JSON.parse(atob(idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.nonce !== savedNonce) return true;
    if (!payload.email_verified || String(payload.email || "").toLowerCase() !== ADMIN_EMAIL) return true;
    signInWithCredential(auth, GoogleAuthProvider.credential(idToken)).catch(() => {});
    return true;
  } catch (e) { return false; }
}

const num = (v) => (typeof v.order === "number" ? v.order : Number(v.order) || 0);

async function metaGet() {
  const s = await getDoc(doc(db, "videos", META_ID));
  return s.exists() ? s.data() : { category: "_meta" };
}

// Back up every video's order/deleted values once per day-session before the first change.
async function ensureBackup(allVideos) {
  const key = "mk_owner_backup_" + new Date().toISOString().slice(0, 10);
  if (sessionStorage.getItem(key)) return;
  const snap = {};
  allVideos.forEach((v) => { snap[v.id] = { order: v.order ?? null, deleted: !!v.deleted }; });
  const stamp = "b" + Date.now();
  await setDoc(doc(db, "videos", META_ID), { category: "_meta", backups: { [stamp]: JSON.stringify(snap) } }, { merge: true });
  sessionStorage.setItem(key, "1");
}

async function saveUndo(action) {
  await setDoc(doc(db, "videos", META_ID), { category: "_meta", lastAction: JSON.stringify({ ...action, at: Date.now() }) }, { merge: true });
}

// list = the videos shown in this gallery, in displayed order. Returns after writing.
export async function moveVideo(list, allVideos, index, dir) {
  const j = index + dir;
  if (j < 0 || j >= list.length) return;
  await ensureBackup(allVideos);
  const before = list.map((v) => ({ id: v.id, order: v.order ?? null }));
  const next = [...list];
  [next[index], next[j]] = [next[j], next[index]];
  const orders = list.map((v) => num(v));
  const tie = new Set(orders).size !== orders.length;
  const batch = writeBatch(db);
  const touched = [];
  if (!tie) {
    const a = list[index], b = list[j];
    batch.update(doc(db, "videos", a.id), { order: num(b) });
    batch.update(doc(db, "videos", b.id), { order: num(a) });
    touched.push(a.id, b.id);
  } else {
    // Ties make a swap meaningless: renumber this list so the displayed order is kept and the move applies.
    const base = Math.min(...orders);
    next.forEach((v, i) => { batch.update(doc(db, "videos", v.id), { order: base + i }); touched.push(v.id); });
  }
  await batch.commit();
  await saveUndo({ type: "move", before: before.filter((b) => touched.includes(b.id)) });
}

export async function moveToTop(list, allVideos, index) {
  if (index <= 0) return;
  await ensureBackup(allVideos);
  const v = list[index];
  const min = Math.min(...list.map(num));
  await updateDoc(doc(db, "videos", v.id), { order: min - 1 });
  await saveUndo({ type: "move", before: [{ id: v.id, order: v.order ?? null }] });
}

export async function softDelete(v, allVideos) {
  if (!window.confirm('Delete "' + (v.title || v.url || v.id) + '" from the site?\nIt is hidden, not erased, and you can restore it from the Owner bar.')) return false;
  await ensureBackup(allVideos);
  await updateDoc(doc(db, "videos", v.id), { deleted: true, deletedAt: serverTimestamp() });
  await saveUndo({ type: "delete", id: v.id });
  return true;
}

export async function restoreVideo(id) {
  await updateDoc(doc(db, "videos", id), { deleted: false });
  await saveUndo({ type: "restore", id });
}

export async function addVideo(form, allVideos) {
  if (!ytId(form.url)) throw new Error("Invalid YouTube URL");
  await ensureBackup(allVideos);
  const inCat = allVideos.filter((v) => v.category === form.category && !v.deleted);
  const min = inCat.length ? Math.min(...inCat.map(num)) : 0;
  const ref = await addDoc(collection(db, "videos"), {
    url: form.url.trim(), title: (form.title || "").trim(), type: form.type, category: form.category,
    order: min - 1, views: 0, createdAt: serverTimestamp(),
  });
  await saveUndo({ type: "add", id: ref.id });
  return ref.id;
}

export async function undoLast() {
  const m = await metaGet();
  if (!m.lastAction) return "Nothing to undo.";
  const a = JSON.parse(m.lastAction);
  const batch = writeBatch(db);
  if (a.type === "move") a.before.forEach((b) => batch.update(doc(db, "videos", b.id), { order: b.order }));
  else if (a.type === "delete") batch.update(doc(db, "videos", a.id), { deleted: false });
  else if (a.type === "restore") batch.update(doc(db, "videos", a.id), { deleted: true });
  else if (a.type === "add") batch.update(doc(db, "videos", a.id), { deleted: true });
  else return "Nothing to undo.";
  batch.update(doc(db, "videos", META_ID), { lastAction: "" });
  await batch.commit();
  return "Undid last " + a.type + ".";
}

export async function listDeleted() {
  const s = await getDocs(collection(db, "videos"));
  return s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((v) => v.deleted && !v.id.startsWith("_"));
}

const bar = { position: "sticky", top: 0, zIndex: 9997, background: "#2b1238", border: "1px solid #a855f7", borderRadius: 12, padding: "10px 12px", margin: "10px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", color: "#fff", fontSize: 13 };
const btn = { font: "inherit", fontSize: 13, border: "1px solid #a855f7", borderRadius: 8, background: "#3b1a50", color: "#fff", padding: "6px 10px", cursor: "pointer" };

export function OwnerBar({ category, allVideos, onChanged, defaultType = "short" }) {
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState({ url: "", title: "", type: defaultType });
  const [deleted, setDeleted] = useState([]);
  const run = async (fn) => { try { const r = await fn(); if (typeof r === "string") setMsg(r); onChanged && onChanged(); } catch (e) { setMsg("Failed: " + (e.message || "could not save")); } };
  return (
    <div style={bar} data-owner-bar>
      <strong>Owner mode</strong>
      <button style={btn} onClick={() => run(undoLast)}>Undo last change</button>
      <button style={btn} onClick={() => setOpen(open === "add" ? null : "add")}>+ Add video</button>
      <button style={btn} onClick={async () => { setOpen(open === "del" ? null : "del"); setDeleted(await listDeleted()); }}>Restore deleted</button>
      {msg && <span>{msg}</span>}
      {open === "add" && (
        <form style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%" }} onSubmit={(e) => { e.preventDefault(); run(async () => { await addVideo({ ...form, category }, allVideos); setForm({ url: "", title: "", type: form.type }); return "Added to the top of " + category + "."; }); }}>
          <input placeholder="YouTube URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} style={{ flex: "2 1 220px" }} />
          <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ flex: "1 1 140px" }} />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="short">short</option><option value="long">long</option></select>
          <button style={btn} type="submit">Add</button>
        </form>
      )}
      {open === "del" && (
        <div style={{ width: "100%" }}>
          {deleted.length === 0 && <span>No deleted videos.</span>}
          {deleted.map((v) => (
            <div key={v.id} style={{ display: "flex", gap: 8, alignItems: "center", margin: "4px 0" }}>
              <span>{v.title || v.url} ({v.category})</span>
              <button style={btn} onClick={() => run(async () => { await restoreVideo(v.id); setDeleted(deleted.filter((x) => x.id !== v.id)); return "Restored."; })}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CardControls({ list, allVideos, index, onChanged, canMove = true }) {
  const v = list[index];
  const run = async (fn) => { try { await fn(); onChanged && onChanged(); } catch (e) { window.alert("Failed: " + (e.message || "could not save")); } };
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center", margin: "4px 0", flexWrap: "wrap" }} data-owner-controls>
      {canMove && <button style={btn} disabled={index === 0} onClick={() => run(() => moveVideo(list, allVideos, index, -1))} aria-label="Move up">↑</button>}
      {canMove && <button style={btn} disabled={index === list.length - 1} onClick={() => run(() => moveVideo(list, allVideos, index, 1))} aria-label="Move down">↓</button>}
      {canMove && <button style={btn} disabled={index === 0} onClick={() => run(() => moveToTop(list, allVideos, index))}>Top</button>}
      <button style={{ ...btn, borderColor: "#ef4444" }} onClick={() => run(() => softDelete(v, allVideos))}>Delete</button>
    </div>
  );
}
