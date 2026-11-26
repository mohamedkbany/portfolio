import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { trackVisit, trackVideoPlay } from "../analytics";
import { thumb, thumbFallback } from "../youtube";
import PlayerOverlay from "../PlayerOverlay";
import { WA } from "../App";
import { useOwner, OwnerBar, CardControls } from "../ownerTools";

const CATS = [
  { key: "ai", label: "AI Creative Solutions" },
  { key: "motion", label: "Motion Magic" },
  { key: "editing", label: "Video Editing" },
  { key: "tv", label: "TV & Broadcast" },
];

export default function Works() {
  const { cat = "ai" } = useParams();
  const [videos, setVideos] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [kind, setKind] = useState("short");
  const owner = useOwner();
  const [allRaw, setAllRaw] = useState([]);
  const [search] = useSearchParams();
  const formats = ["short", "long"].filter(type => videos.some(v => v.category === cat && (v.type || "short") === type));
  const activeKind = formats.includes(kind) ? kind : formats[0];
  const categoryVideos = videos.filter(v => v.category === cat);
  useEffect(() => {
    const selected = videos.find(v => v.id === search.get("project") && v.category === cat);
    if (selected) { setKind(selected.type || "short"); setPlaying(selected); trackVideoPlay(selected); }
  }, [videos, cat, search]);

  function loadVideos() {
    return getDocs(collection(db, "videos")).then((s) => {
      const raw = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((v) => !v.id.startsWith("_")).map(v => v.id === "OHkdV3yEbsNBHUsfCDXW" ? {...v,url:"https://res.cloudinary.com/m6ukdjvl/video/upload/v1795649072/1-virone-ad23.mp4"} : v);
      setAllRaw(raw);
      const all = raw.filter((v) => !v.deleted);
      setVideos(all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }).catch(() => {});
  }
  useEffect(() => {
    trackVisit();
    loadVideos();
    setPlaying(null);
  }, [cat]);

  const current = CATS.find((c) => c.key === cat) || CATS[0];

  function open(v) {
    setPlaying(v);
    trackVideoPlay(v);
  }

  function suggestionsFor(v) {
    const pool = videos.filter((x) => x.id !== v.id && (x.category === "ai" || x.category === "motion"));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }

  return (
    <section className="works"><Link to="/" className="back-btn">← Back</Link>
      <h3>{{ai:"AI Works",motion:"Motion Works",editing:"Editing Works",tv:"TV & Broadcast Works"}[cat]}</h3>
      <div className="cat-tabs">{formats.map(type => <button key={type} className={activeKind===type?"tab active":"tab"} onClick={()=>setKind(type)}>{type === "short" ? "Short Videos" : "Long Videos"}</button>)}</div>
      <a className="audit-gallery-contact" href={WA} target="_blank" rel="noreferrer">Discuss a similar project on WhatsApp ↗</a><div className="category-links">
        {CATS.map((c) => (
          <Link key={c.key} to={`/works/${c.key}`} className={c.key === cat ? "tab active" : "tab"}>{c.label}</Link>
        ))}
      </div>
      {owner && <OwnerBar category={cat} allVideos={allRaw} onChanged={loadVideos} defaultType={activeKind || "short"} />}
      <div className={activeKind==="short"?"gallery shorts-gallery":"gallery"}>
        {(() => { const shownList = videos.filter(v=>v.category===cat && (v.type||"short")===activeKind); return shownList.map((v, i) => { const cardEl = (
          <button key={v.id} className="card" onClick={() => open(v)}>
            {thumb(v.url) && <img src={thumb(v.url)} onError={thumbFallback} alt={v.title || "video"} loading="lazy" />}
            <span className="play">▶</span>
            {v.title && <span className="card-title">{v.title}</span>}
          </button>); return owner ? <div key={v.id} style={{ position: "relative" }}>{cardEl}<CardControls list={shownList} allVideos={allRaw} index={i} onChanged={loadVideos} /></div> : cardEl; }); })()}
        {categoryVideos.length === 0 && <p className="hint">No videos in this category yet.</p>}
      </div>

      {playing && (
        <PlayerOverlay
          key={playing.id || playing.url}
          video={playing}
          suggestions={suggestionsFor(playing)}
          onClose={() => setPlaying(null)}
          onPick={(v) => setPlaying(v)}
        />
      )}
    </section>
  );
}
