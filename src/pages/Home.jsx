import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { trackVisit, trackCvDownload, bumpLogoViews } from "../analytics";
import { thumb, embedUrl } from "../youtube";
import { WA } from "../App";

const SERVICES = [
  { n: "01", title: "AI Creative Solutions", desc: "AI-powered workflows that accelerate production and unlock new creative possibilities.", img: "/ai.webp", cat: "ai" },
  { n: "02", title: "Motion Magic", desc: "Cinematic motion graphics that strengthen brand identity and enhance clarity.", img: "/motion.webp", cat: "motion" },
  { n: "03", title: "Video Editing", desc: "High-end editing for YouTube, ads and branded content — optimized for retention.", img: "/editing.webp", cat: "editing" },
  { n: "04", title: "TV & Broadcast", desc: "Broadcast-quality production for TV, streaming and live events.", img: "/tv.webp", cat: "tv" },
];

export default function Home() {
  const [homeVids, setHomeVids] = useState([]);
  const [logos, setLogos] = useState([]);
  const [brand, setBrand] = useState(null);
  const [playing, setPlaying] = useState(null);

  useEffect(() => {
    trackVisit();
    getDocs(collection(db, "videos")).then((s) => {
      const all = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      setHomeVids(all.filter((v) => v.category === "home").sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }).catch(() => {});
    getDocs(collection(db, "Logos")).then((s) => {
      setLogos(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }).catch(() => {});
  }, []);

  return (
    <>
      <section className="hero"><div className="hero-copy">
        <h1>Professional Video Editing</h1>
        <h2>AI Creator &amp; Motion Magic Specialist</h2>
        <p className="tagline">Cinematic Edits • AI-Generated Videos • Creative Motion Design • Visual Storytelling That Captures Attention</p>
        <div className="hero-btns">
          <Link className="btn primary" to="/works">View My Works</Link>
          <a className="btn" href="/mohamed_kbany.pdf" target="_blank" rel="noreferrer" onClick={trackCvDownload}>Download CV</a>
        </div>

        </div><img className="hero-logo" src="/logo.webp" alt="Mohamed Kbany logo" />
      </section>

      <section className="brands">
        <p className="hint">Explore projects and creative work for each brand.</p>
        <div className="logo-row">
          {logos.map((l) => (
            <button key={l.id} className="brand-card" onClick={() => {setBrand(l); setPlaying(null); bumpLogoViews(l.id);}}><img src={l.logo} alt={l.name || "brand"} loading="lazy" /><span>▶</span></button>
          ))}
        </div>
      </section>
        <div className="stats">
          <div><strong>5+</strong><span>Years of experience</span></div>
          <div><strong>550+</strong><span>Projects completed</span></div>
          <div><strong>95%</strong><span>Performance Rate</span></div>
          <div><strong>250+</strong><span>Happy Clients</span></div>
        </div>
      <section className="services">
        <p className="kicker">WHAT I DO</p>
        <h3>Services</h3>
        <p className="hint">HOVER TO PREVIEW</p>
        <div className="service-grid">
          {SERVICES.map((s) => (
            <Link key={s.cat} to={`/works/${s.cat}`} className="service-card">
              <img src={s.img} alt={s.title} loading="lazy" />
              <div className="service-body">
                <span className="num">{s.n}</span>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
                <span className="arrow">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="selection">
        <h3>A Selection of My Work</h3>
        <p className="hint">A glimpse into my creative work. Explore the full portfolio for more projects and collaborations.</p>
        <div className="vid-strip">
          {homeVids.map((v) => (
            <Link key={v.id} to="/works" className="vid-thumb">
              {thumb(v.url) && <img src={thumb(v.url)} alt={v.title || "video"} loading="lazy" />}
            </Link>
          ))}
        </div>
        <Link className="btn primary" to="/works">CLICK TO VIEW MY WORKS</Link>
      </section>


      {brand && <div className="lightbox" onClick={()=>setBrand(null)}><div className="lightbox-inner brand-dialog" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setBrand(null)}>✕</button><h3>{brand.name}</h3>{playing ? <div className="player"><iframe src={embedUrl(playing)} title={brand.name} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div> : <div className="brand-videos">{(brand.videos || []).map((url,i)=><button key={i} onClick={()=>setPlaying(url)}><img src={thumb(url)} alt="Play project"/><span>▶</span></button>)}</div>}</div></div>}
    </>
  );
}
