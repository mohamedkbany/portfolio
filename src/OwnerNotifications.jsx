import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { auth, db, ADMIN_EMAIL } from "./firebase";
import { setTrackingOptOut } from "./analytics";
import "./owner-notifications.css";
import { isVerifiedOwner, visibleNotifications } from "./notification-policy";

const Bell = () => <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 21h4M2 8c0-2 1-4 2-5m18 5c0-2-1-4-2-5"/></svg>;
export function OwnerBellView({ items, onRead, soundOn, onSound, banner, error }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const unread = items.filter(n => !n.read).length;
  const visible = filter === "unread" ? items.filter(n => !n.read) : items;
  return <div className="owner-notifications">
    {banner && <div className="owner-banner" role="status">{banner}</div>}
    <button className="owner-bell" aria-label="Notifications" aria-expanded={open} onClick={() => setOpen(!open)}><Bell/>{unread > 0 && <span className="owner-count">{unread > 99 ? "99+" : unread}</span>}</button>
    {open && <section className="owner-notif-panel" aria-label="Notification feed">
      <header><strong>Notifications</strong><button aria-label="Close notifications" onClick={() => setOpen(false)}>×</button></header>
      <div className="owner-notif-actions"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>All ({items.length})</button><button className={filter === "unread" ? "selected" : ""} onClick={() => setFilter("unread")}>Unread ({unread})</button>{unread > 0 && <button onClick={() => onRead(items.filter(n => !n.read))}>Mark all read</button>}</div>
      <button className="owner-sound" onClick={onSound}>Sound: {soundOn ? "On" : "Off"} <span>Tap to test</span></button>
      <p className="owner-notif-note">Live alerts while this page is open. Sound needs a tap first.</p>
      <div className="owner-notif-list">{error ? <p>Notifications could not load. Try again later.</p> : visible.length ? visible.map(n => <button key={n.id} className={`owner-notif-row ${n.read ? "read" : ""}`} onClick={() => onRead([n])}><span>{n.icon || "🔔"}</span><div><strong>{n.title || "Activity"}</strong><p>{n.message}</p><small>{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : n.timeLabel || "Just now"}</small></div>{!n.read && <i/>}</button>) : <p className="owner-empty">No notifications yet.</p>}</div>
    </section>}
  </div>;
}

export default function OwnerNotifications() {
  const [owner, setOwner] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(false);
  const [banner, setBanner] = useState("");
  const [soundOn, setSound] = useState(() => localStorage.getItem("mk_admin_sound") !== "0");
  const audio = useRef(null), seen = useRef(null), sound = useRef(soundOn);
  sound.current = soundOn;
  function ding() {
    if (!audio.current || audio.current.state !== "running") return;
    [880, 1318].forEach((f, i) => { const o=audio.current.createOscillator(), g=audio.current.createGain(), t=audio.current.currentTime+i*.15; o.frequency.value=f; g.gain.setValueAtTime(.1,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.connect(g);g.connect(audio.current.destination);o.start(t);o.stop(t+.26); });
  }
  useEffect(() => onAuthStateChanged(auth, u => {
    const ok=isVerifiedOwner(u, ADMIN_EMAIL);
    if(ok) setTrackingOptOut(true);
    setOwner(ok); if(!ok){setItems([]);seen.current=null;}
  }), []);
  useEffect(() => {
    if(!owner) return;
    const unlock=()=>{ const C=window.AudioContext||window.webkitAudioContext; if(C){audio.current ||= new C(); audio.current.resume().catch(()=>{});} };
    window.addEventListener("pointerdown",unlock);return()=>window.removeEventListener("pointerdown",unlock);
  },[owner]);
  useEffect(() => {
    if(!owner) return;
    let raw = [], timer;
    const publish = () => {
      const clean = visibleNotifications(raw, Date.now());
      if (seen.current) {
        const fresh = clean.filter(n => !seen.current.has(n.id) && Date.now()-(n.createdAt?.toMillis?.()||0)<60000);
        if (fresh.length) { setBanner(fresh[0].message||fresh[0].title); if(sound.current) ding(); navigator.vibrate?.([200,100,200]); clearTimeout(timer); timer=setTimeout(()=>setBanner(""),7000); }
        clean.forEach(n=>seen.current.add(n.id));
      } else seen.current=new Set(raw.map(n=>n.id));
      setItems(clean);
    };
    const unsubscribe = onSnapshot(collection(db,"notifications"), snap => {
      raw=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
      publish();setError(false);
    },()=>setError(true));
    const cadence=setInterval(publish,1000);
    return ()=>{unsubscribe();clearInterval(cadence);clearTimeout(timer);};
  },[owner]);
  if(!owner) return null;
  return <OwnerBellView items={items} error={error} banner={banner} soundOn={soundOn} onSound={()=>{const next=!soundOn;setSound(next);localStorage.setItem("mk_admin_sound",next?"1":"0");if(next)ding();}} onRead={rows=>Promise.all(rows.filter(n=>!n.read).map(n=>updateDoc(doc(db,"notifications",n.id),{read:true}))).catch(()=>setError(true))}/>;
}
