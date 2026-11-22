import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { trackVisit, bumpVideoViews } from "../analytics";
import { thumb, embedUrl } from "../youtube";

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
    <section className="works">
      <h3>{current.label}</h3>
      <div className="cat-tabs">
        {CATS.map((c) => (
          <Link key={c.key} to={`/works/${c.key}`} className={c.key === cat ? "tab active" : "tab"}>{c.label}</Link>
        ))}
      </div>
      <div className="gallery">
        {videos.map((v) => (
          <button key={v.id} className="card" onClick={() => open(v)}>
            {thumb(v.url) && <img src={thumb(v.url)} alt={v.title || "video"} loading="lazy" />}
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
