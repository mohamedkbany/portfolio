import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { trackVisit, bumpVideoViews } from "../analytics";
import { thumb, embedUrl, thumbFallback } from "../youtube";

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

  useEffect(() => {
    trackVisit();
    getDocs(collection(db, "videos")).then((s) => {
      const all = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      setVideos(all.filter((v) => v.category === cat).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }).catch(() => {});
    setPlaying(null);
  }, [cat]);

  const current = CATS.find((c) => c.key === cat) || CATS[0];

  function open(v) {
    setPlaying(v);
    bumpVideoViews(v.id);
  }

  return (
    <section className="works"><Link to="/" className="back-btn">← Back</Link>
      <h3>{{ai:"AI Works",motion:"Motion Works",editing:"Editing Works",tv:"TV & Broadcast Works"}[cat]}</h3>
      <div className="cat-tabs"><button className={kind==="short"?"tab active":"tab"} onClick={()=>setKind("short")}>Short Videos</button><button className={kind==="long"?"tab active":"tab"} onClick={()=>setKind("long")}>Long Videos</button></div><div className="category-links">
        {CATS.map((c) => (
          <Link key={c.key} to={`/works/${c.key}`} className={c.key === cat ? "tab active" : "tab"}>{c.label}</Link>
        ))}
      </div>
      <div className={kind==="short"?"gallery shorts-gallery":"gallery"}>
        {videos.filter(v=>(v.type||"short")===kind).map((v) => (
          <button key={v.id} className="card" onClick={() => open(v)}>
            {thumb(v.url) && <img src={thumb(v.url)} onError={thumbFallback} alt={v.title || "video"} loading="lazy" />}
            <span className="play">▶</span>
            {v.title && <span className="card-title">{v.title}</span>}
          </button>
        ))}
        {videos.length === 0 && <p className="hint">No videos in this category yet.</p>}
      </div>

      {playing && (
        <div className="lightbox" onClick={() => setPlaying(null)}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setPlaying(null)}>✕</button>
            {playing.title && <p className="lightbox-title">{playing.title}</p>}
            <div className={playing.type === "short" ? "player short" : "player"}>
              <iframe
                src={embedUrl(playing.url)}
                title={playing.title || "video"}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
