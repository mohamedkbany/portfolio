import { useEffect, useState } from "react";
import { db, auth, googleProvider, ADMIN_EMAIL } from "../firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { thumb, ytId } from "../youtube";

const CATS = ["home", "ai", "motion", "editing", "tv"];

export default function Admin() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [cat, setCat] = useState("ai");
  const [videos, setVideos] = useState([]);
  const [form, setForm] = useState({ url: "", title: "", type: "short", category: "ai" });
  const [msg, setMsg] = useState("");

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setChecking(false); }), []);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, cat]);

  async function load() {
    const s = await getDocs(collection(db, "videos"));
    const all = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    setVideos(all.filter((v) => v.category === cat).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  }

  if (checking) return <div className="admin"><p>Loading…</p></div>;

  if (!user) {
    return (
      <div className="admin login">
        <h3>Admin</h3>
        <button className="btn primary" onClick={() => signInWithPopup(auth, googleProvider).catch((e) => setMsg(e.message))}>
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

  async function addVideo(e) {
    e.preventDefault();
    if (!ytId(form.url)) { setMsg("Invalid YouTube URL"); return; }
    const sAll = await getDocs(collection(db, "videos"));
    const catDocs = sAll.docs.map((d) => d.data()).filter((v) => v.category === form.category);
    const minOrder = catDocs.length ? Math.min(...catDocs.map((v) => v.order ?? 0)) : 0;
    await addDoc(collection(db, "videos"), {
      url: form.url, title: form.title, type: form.type, category: form.category,
      order: minOrder - 1, views: 0, createdAt: serverTimestamp(),
    });
    setForm({ url: "", title: "", type: "short", category: form.category });
    setMsg("Added.");
    if (form.category === cat) load();
  }

  async function saveTitle(v) {
    await updateDoc(doc(db, "videos", v.id), { title: v.title ?? "" });
    setMsg("Saved.");
  }

  async function remove(v) {
    if (!window.confirm(`Delete "${v.title || v.url}"?`)) return;
    await deleteDoc(doc(db, "videos", v.id));
    load();
  }

  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= videos.length) return;
    const a = videos[i], b = videos[j];
    const ao = a.order ?? 0, bo = b.order ?? 0;
    await updateDoc(doc(db, "videos", a.id), { order: bo });
    await updateDoc(doc(db, "videos", b.id), { order: ao });
    load();
  }

  return (
    <div className="admin">
      <div className="admin-head">
        <h3>Video Manager</h3>
        <button className="btn" onClick={() => signOut(auth)}>Sign out</button>
      </div>

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
          <button key={c} className={c === cat ? "tab active" : "tab"} onClick={() => setCat(c)}>{c} ({c === cat ? videos.length : "…"})</button>
        ))}
      </div>

      <div className="admin-list">
        {videos.map((v, i) => (
          <div key={v.id} className="admin-row">
            {thumb(v.url) && <img src={thumb(v.url)} alt="" />}
            <input value={v.title ?? ""} onChange={(e) => setVideos(videos.map((x) => x.id === v.id ? { ...x, title: e.target.value } : x))} />
            <button className="btn" onClick={() => saveTitle(v)}>Save</button>
            <button className="btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button className="btn" onClick={() => move(i, 1)} disabled={i === videos.length - 1}>↓</button>
            <button className="btn danger" onClick={() => remove(v)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
