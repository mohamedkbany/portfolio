import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db, auth, ADMIN_EMAIL } from "../firebase";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { trackVisit, trackCvDownload, trackLogoOpen, trackVideoPlay } from "../analytics";
import { thumb, thumbFallback, ytId } from "../youtube";
import PlayerOverlay from "../PlayerOverlay";
import { WA } from "../App";
import { useOwner, OwnerBar, CardControls } from "../ownerTools";

function downloadCv(e) {
  e.preventDefault();
  trackCvDownload();
  const a = document.createElement("a");
  a.href = "/mohamed_kbany.pdf";
  a.download = "Mohamed_Kbany_CV.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.open("/mohamed_kbany.pdf", "_blank", "noopener"), 900);
}

const SERVICES = [
  { n: "01", title: "AI Creative Solutions", desc: "AI-powered workflows that accelerate production and unlock new creative possibilities.", img: "/ai.webp", cat: "ai" },
  { n: "02", title: "Motion Magic", desc: "Cinematic motion graphics that strengthen brand identity and enhance clarity.", img: "/motion.webp", cat: "motion" },
  { n: "03", title: "Video Editing", desc: "High-end editing for YouTube, ads and branded content — optimized for retention.", img: "/editing.webp", cat: "editing" },
  { n: "04", title: "TV & Broadcast", desc: "Broadcast-quality production for TV, streaming and live events.", img: "/tv.webp", cat: "tv" },
];


const SERVICE_AR={ai:['حلول إبداعية بالذكاء الاصطناعي','إنتاج بالذكاء الاصطناعي يفتح أفكارًا إبداعية جديدة.'],motion:['موشن جرافيك','موشن جرافيك سينمائي يوضح رسالتك ويقوّي هوية علامتك.'],editing:['مونتاج الفيديو','مونتاج ليوتيوب والإعلانات ومحتوى العلامات التجارية.'],tv:['التلفزيون والبث','إنتاج للتلفزيون والبث والفعاليات المباشرة.']};
const SECTOR_IDS={"pharmacy": ["YjHrzF47akwoqnHMXwcB", "iYtW71Ng8bgCHYkuX6s1", "LHH1q6pC4cHHVpefTM1p", "sector-zahra-2", "TzsgWfpZZdMX7GcuevZa", "sector-zahra-0", "N8DxD2PUd23t6aUYeQhF", "sector-zahra-1", "KqB3EBW13z80HxRs1evG", "sector-zahra-4", "NgDAz6a6KjAuSqXuHOi1", "sector-zahra-3", "uVEyOAdYWd02p8sTVZvW", "sector-zahra-5", "0nDwoBuUJFk39OXhTmJX", "qXaVa7gkZzo9TsuZJS6N", "5ncqqZTJyt9uOXqaYpVx", "hA40dInbLa9acRGEqIYQ", "g5JlmTtfw8Y1m9mskI8S", "WhN9PLWR70EoaMMdn3S7", "8AGPwl5oZ0eGFTbFm3TI", "dAypuEvRscboPOozfqPJ", "0sq1939bY40CV3QNoKZy", "84RM6EfTmFgMbEupXA7W", "3OLeMMLDh9GhCJpkbrgO", "Yq0WKRJppiZN2w0U0ANc", "1K3zwfSv9lIHivac3nbJ", "Qr2iUxembGfxkEwbI3XY", "bqk6ivLdxUDUCjBVw91b", "O68m4ZKDJy5aA959Aovs", "fmBrT0R355zj4SKKW44s", "hbwFmvApkedhcbnIr65W", "MVmvOCXvkWhbVXbrAYni", "dZGV9U8JwbpBAn8QQNFS", "B08qy7xktOqzsAEcnuID", "WDwSG6wR3HJtffapfxz1", "95SUinFLEnZzMh9YAW97", "frNpCX601Zds9mwEXBus", "CQiRltF4mU4FXJ7CRGG0", "pBx9i4ZWJNClm7epIL4Z", "BrIJ3YGI2OXn0mSvL0cB", "My7eFIOcz9D1Ce6areKC"], "perfume": ["Bo8jdDQg2m2j0xsuxUtg", "fVVjmUhTAcMwOF7EdBHh", "78iQa3ONcnlxouYDYpst"], "beauty": ["W9B8tP08mR3WIxDAaOHJ", "hbwFmvApkedhcbnIr65W", "WhN9PLWR70EoaMMdn3S7", "My7eFIOcz9D1Ce6areKC", "Qr2iUxembGfxkEwbI3XY", "uEPkVniZZbbw7j0HfvWo", "naMpJaZiminEdFQJmdnp", "A8A7UsglbQyfZHZn6ado", "uN73Rz0ZwEcpLRHaBi8n", "dAypuEvRscboPOozfqPJ", "KqB3EBW13z80HxRs1evG", "KQHO3aE6JIuLrMwwFjSr"], "sports": ["qrFp2h3DivDq3O82ig3k", "fTPhakpw8YesNjdxJXjW", "QWkrGvBblOJWOyzNvaAp", "bkNl8phg5FERc2rDOgFV", "frNpCX601Zds9mwEXBus", "5KjyMlLimys0b7fMwaUJ"], "electronics": ["AIdpFFFwvmIZP4b2IDwe", "cI2Uo5skBXyfh1hEmg3I", "ngAV1rUR5feX4T2G1O9d", "5KjyMlLimys0b7fMwaUJ", "9Kkhc39qcjLTfBq6AUDR", "nlgl3K7icutCYhiytqhU", "SvRLzcSaC0ybU6R3v4Hb", "Gohp8IObE7dy2V3Pipei", "vGgTn70rcNSmuUcgyvnI", "VuJRWJM95QjP6uxtr4oh"], "food": ["RLKlQ8PYLSCF4e2mnqjV", "0DZtxYA4YAekjVQEomB6", "Ez9rYO015B3FxH2dwTIY", "WmIlW69awGEEDjLPd0nH", "VTHWTkmuPbUVfJDkxBGm", "XFYCSrci6QDqtqAXMuZ6"], "ugc": ["iYtW71Ng8bgCHYkuX6s1", "eifJYy7hEQ7LJhsnK4eq", "sector-zahra-2", "A4uh0M9AU5Md6Wjhi7yy", "sector-zahra-0", "zuqtPXILpuQwC4NYbh3d", "sector-zahra-1", "2epazZK8MBttJn9gy7X8", "sector-zahra-4", "01QkZUeKD5FIeUvvpWBf", "sector-zahra-3", "FKmAWEKM9u1iAegtvr83", "sector-zahra-5"]};
const SECTOR_EXTRAS=[{"id": "sector-zahra-0", "title": "Zahrat Haneen - Huggies UGC", "url": "https://res.cloudinary.com/vgnnxs1g/video/upload/v1795386347/zahrat_haneen/ygzlkpcsu7isnxehe9yx.mp4", "category": "ai", "type": "short"}, {"id": "sector-zahra-1", "title": "Zahrat Haneen - Garnier Color Naturals UGC", "url": "https://res.cloudinary.com/vgnnxs1g/video/upload/v1795386351/zahrat_haneen/bjz3fnpp0sxmd3xl1cvh.mp4", "category": "ai", "type": "short"}, {"id": "sector-zahra-2", "title": "Zahrat Haneen - Sunsilk UGC", "url": "https://res.cloudinary.com/vgnnxs1g/video/upload/v1795386353/zahrat_haneen/yvzfzmk2ak0sbkyx4pon.mp4", "category": "ai", "type": "short"}, {"id": "sector-zahra-3", "title": "Zahrat Haneen - Isilac UGC", "url": "https://res.cloudinary.com/vgnnxs1g/video/upload/v1795386355/zahrat_haneen/sidudt4nrazk2yj5moul.mp4", "category": "ai", "type": "short"}, {"id": "sector-zahra-4", "title": "Zahrat Haneen - NAN Optipro UGC", "url": "https://res.cloudinary.com/vgnnxs1g/video/upload/v1795386357/zahrat_haneen/fnvmcmh9giksxgbw4xut.mp4", "category": "ai", "type": "short"}, {"id": "sector-zahra-5", "title": "Zahrat Haneen - Bambi UGC", "url": "https://res.cloudinary.com/vgnnxs1g/video/upload/v1795386359/zahrat_haneen/izcstjonfhaljlhfg6qx.mp4", "category": "ai", "type": "short"}];
const SECTOR_ORDER_KEYS={pharmacy:"pharmacyNov25",perfume:"perfumeNov25",ugc:"ugcNov25",sports:"sportsNov26",beauty:"beautyNov26"};
function filterSector(all,key){const orderKey=SECTOR_ORDER_KEYS[key]||key;const savedExtras=all.find(v=>v.id==="iYtW71Ng8bgCHYkuX6s1")?.sectorExtraOrders?.[orderKey]||{};const pool=[...all,...SECTOR_EXTRAS.map(v=>({...v,sectorOrder:{[orderKey]:savedExtras[v.id]}}))];return (SECTOR_IDS[key]||[]).map((id,index)=>{const v=pool.find(v=>v.id===id);return v?{...v,_sectorIndex:index}:null;}).filter(Boolean).sort((a,b)=>(a.sectorOrder?.[orderKey]??a._sectorIndex)-(b.sectorOrder?.[orderKey]??b._sectorIndex)||a._sectorIndex-b._sectorIndex);}

const HOME_CSS=`.home-general{max-width:1132px;margin:auto;color:#f7f0fa;padding:0 0 10px}.home-top{display:flex;justify-content:space-between;align-items:center;padding:30px 0 22px;border-bottom:1px solid #49324f}.home-name{font-size:16px;letter-spacing:3px}.lang-switch{font:inherit;font-size:12px;border:1px solid #684277;border-radius:24px;color:inherit;background:transparent;padding:11px 19px;cursor:pointer}.home-intro{display:grid;grid-template-columns:1.2fr 1fr;gap:70px;align-items:center;padding:48px 0}.intro-copy h1{font-size:43px;line-height:1.25;margin:0 0 23px}.intro-copy h1 span{color:#d866df}.intro-copy p{font-size:15px;line-height:1.9;color:#c0adc8}.intro-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.intro-actions .btn{font-size:15px;border-radius:10px;padding:14px 20px}.intro-actions .primary{background:#a800e2}.industry-panel{border:1px solid #654072;border-radius:22px;background:linear-gradient(130deg,#2a1034,#170b22);padding:24px}.industry-panel small{color:#cfa5df;font-size:13px}.industry-panel h2{font-size:25px;margin:8px 0 18px}.industry-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.industry-grid button{font:inherit;font-size:14px;border:1px solid #593465;background:#27122f;border-radius:13px;color:white;min-height:51px;padding:8px;cursor:pointer}.industry-grid button:hover{border-color:#e37ef1}.home-divider{border-top:1px solid #573060;text-align:center;padding:26px 0 20px;font-size:14px;color:#d8b8e6;scroll-margin-top:20px}.home-general .brands{padding:0 0 12px}.home-general .brands .hint{font-weight:normal;color:#c0adc8}.home-general .brands{direction:ltr}.home-general .logo-row{direction:ltr;justify-content:flex-start}.home-general .brand-card img{width:83px;height:83px}.home-general .stats{margin:28px auto}.home-general .stats strong{font-size:29px}.home-general .stats span{font-size:11px}.home-general .services{padding:26px 0}.home-general .service-card img{height:auto;aspect-ratio:2.3}.home-general .service-card{border-radius:18px}.home-general .service-body{padding:18px}.home-general .service-body h4{font-size:21px}.home-general .service-body p{font-size:13px}.home-general .service-grid{direction:ltr}.home-general[dir=rtl] .service-body{direction:rtl;text-align:right}.home-general .selection{padding:28px 0}.home-general .vid-strip{grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.home-footer{border-top:1px solid #573060;padding:28px 0;display:grid;grid-template-columns:1fr 1fr;gap:30px;color:#c0adc8;font-size:13px;line-height:2}.home-footer a{display:block}.home-footer .btn{display:inline-block;font-size:13px;margin-top:12px}.home-copy{grid-column:1/-1;text-align:center;font-size:11px}.sector-owner{padding:12px;border:1px solid #825891;border-radius:10px;margin:10px 0 20px}.order-buttons{display:flex;align-items:center;justify-content:center;gap:8px}.order-buttons button{width:auto;padding:5px 12px;font-size:20px}.sector-dialog .brand-videos>div>button{width:100%}.sector-dialog{width:95%;max-width:1000px}.sector-dialog .brand-videos p{font-size:12px;color:white;padding:10px 0}.sector-dialog .brand-videos button{border:1px solid #573060;border-radius:10px;overflow:hidden}.sector-dialog .brand-videos img{width:100%;aspect-ratio:9/16;object-fit:cover}button:focus-visible,a:focus-visible{outline:3px solid #efb7ff;outline-offset:4px}@media(max-width:1180px){.home-general{margin:0 5%}.home-intro{gap:40px}}@media(max-width:600px){.home-general{margin:0 18px}.home-top{padding:19px 0 22px}.home-name{font-size:11px;letter-spacing:1px}.lang-switch{padding:7px 12px;font-size:11px}.home-intro{display:flex;flex-direction:column;align-items:stretch;padding:24px 0 34px;gap:25px}.intro-copy h1{font-size:32px;margin:0 0 22px}.intro-copy p{font-size:13px}.intro-actions{margin-top:24px}.intro-actions .btn{font-size:12px;padding:13px 18px}.industry-panel{padding:18px;border-radius:20px}.industry-panel h2{font-size:22px}.industry-panel small{font-size:12px}.industry-grid{gap:8px}.industry-grid button{min-height:41px;font-size:11px;border-radius:12px}.home-divider{font-size:12px}.home-general .brand-card img{width:52px;height:52px}.home-general .stats{padding:0;margin:20px auto}.home-general .stats strong{font-size:24px}.home-general .stats span{font-size:10px}.home-general .services h3,.home-general .selection h3{font-size:22px}.home-general .service-body h4{font-size:18px}.home-general .vid-strip{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.home-general .hint{font-size:11px}.home-footer{font-size:11px;gap:20px}.home-copy{font-size:9px}.sector-dialog .brand-videos{grid-template-columns:1fr 1fr}}`;

export default function Home() {
  const [lang, setLanguage] = useState(() => {try {const q=new URLSearchParams(location.search).get('lang');const saved=localStorage.getItem('mk_language');return ['ar','en'].includes(q)?q:['ar','en'].includes(saved)?saved:(navigator.languages||[navigator.language])[0].toLowerCase().startsWith('ar')?'ar':'en';}catch{return 'en';}});
  const ar=lang==='ar';
  const [sector, setSector]=useState(null);
  const [sectorVideo,setSectorVideo]=useState(null);
  const [draftOrder,setDraftOrder]=useState(null);
  const [orderMsg,setOrderMsg]=useState('');
  const [savingOrder,setSavingOrder]=useState(false);
  const isOwner=auth.currentUser?.emailVerified && auth.currentUser.email?.toLowerCase()===ADMIN_EMAIL;
  function shiftSector(index,delta){const arr=[...sectorItems];[arr[index],arr[index+delta]]=[arr[index+delta],arr[index]];setDraftOrder(arr);setOrderMsg('');}
  async function saveSectorOrder(){if(!isOwner||savingOrder)return;setSavingOrder(true);setOrderMsg('');try{const batch=writeBatch(db);const orderKey=SECTOR_ORDER_KEYS[sector]||sector;const extraOrders={};sectorItems.forEach((v,i)=>{if(v.id.startsWith('sector-zahra-'))extraOrders[v.id]=i;else batch.update(doc(db,'videos',v.id),{['sectorOrder.'+orderKey]:i});});if(Object.keys(extraOrders).length)batch.update(doc(db,'videos','iYtW71Ng8bgCHYkuX6s1'),{['sectorExtraOrders.'+orderKey]:extraOrders});await batch.commit();const updated=library.map(v=>{const i=sectorItems.findIndex(x=>x.id===v.id);return {...v,...(i<0?{}:{sectorOrder:{...(v.sectorOrder||{}),[orderKey]:i}}),...(v.id==='iYtW71Ng8bgCHYkuX6s1'&&Object.keys(extraOrders).length?{sectorExtraOrders:{...(v.sectorExtraOrders||{}),[orderKey]:extraOrders}}:{})};});setLibrary(updated);setDraftOrder(null);setOrderMsg(ar?'اتحفظ ترتيب المجال فقط. الأقسام الأصلية لم تتغير.':'Sector order saved. Original sections are unchanged.');}catch{setOrderMsg(ar?'الترتيب لم يتحفظ. حاول مرة أخرى.':'Order could not be saved. Please retry.');}finally{setSavingOrder(false);}}

  const t=(en,arabic)=>ar?arabic:en;
  function switchLanguage(){const l=ar?'en':'ar';setLanguage(l);try{localStorage.setItem('mk_language',l);const u=new URL(location.href);u.searchParams.set('lang',l);history.replaceState(null,'',u);}catch{}}
  useEffect(()=>{document.documentElement.lang=lang;return()=>{document.documentElement.lang='en';};},[lang]);
  const selectors=[['perfume','Perfume','العطور'],['pharmacy','Pharmacy','الصيدليات'],['beauty','Beauty','التجميل'],['sports','Sports','الرياضة'],['electronics','Electronics','الإلكترونيات'],['food','Food & drinks','الأكل والمشروبات'],['ugc','UGC','UGC']];
  const [homeVids, setHomeVids] = useState([]);
  const [homeBase, setHomeBase] = useState([]);
  const [allRaw, setAllRaw] = useState([]);
  const ownerMode = useOwner();
  const [library, setLibrary] = useState([]);
  const sectorItems=draftOrder||filterSector(library,sector);
  const [logos, setLogos] = useState([]);
  const [brand, setBrand] = useState(null);
  const [playing, setPlaying] = useState(null);

  function loadHome() {
    return getDocs(collection(db, "videos")).then((s) => {
      const raw = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter(v => !v.id.startsWith("_")); setAllRaw(raw); const all = raw.filter(v => !v.deleted).map(v => v.id === "OHkdV3yEbsNBHUsfCDXW" ? {...v,url:"https://res.cloudinary.com/m6ukdjvl/video/upload/v1795649072/1-virone-ad23.mp4"} : v);
      setLibrary(all);
      const home = all.filter(v => v.category === "home").sort((a,b)=>(a.order??0)-(b.order??0)); const ad23=all.find(v=>v.id==="OHkdV3yEbsNBHUsfCDXW"); if(ad23) home.splice(4,0,{...ad23,id:"home-ad23-selfhost",category:"home"}); const pinned=home.filter(v=>ytId(v.url)==="po4fm-j5pt8").slice(0,1); const rest=home.filter(v=>!pinned.includes(v)); for(let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]];} setHomeBase(home); setHomeVids([...pinned,...rest]);
    }).catch(() => {});
  }
  useEffect(() => {
    trackVisit();
    loadHome();
    getDocs(collection(db, "Logos")).then((s) => {
      setLogos(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    }).catch(() => {});
  }, []);

  return (
    <>
      <style>{HOME_CSS}</style>
      <div className="home-general" dir={ar?'rtl':'ltr'}>
      <header className="home-top"><Link to="/" className="home-name">MOHAMED KBANY</Link><button className="lang-switch" onClick={switchLanguage}>{ar?'English':'العربية'}</button></header>
      <section className="home-intro">
        <div className="intro-copy"><h1>{t('Work that fits','شوف شغل')}<br/><span>{t('your industry.','يشبه مجالك.')}</span></h1><p>{t('Video ads, AI content and motion graphics.','إعلانات فيديو ومحتوى AI وموشن جرافيك.')}<br/>{t('Choose your industry. Find relevant work.','اختار مجال نشاطك، وبعدها طريقة التنفيذ.')}</p><div className="intro-actions"><a className="btn primary" href="#existing">{t('Explore work ↓','استكشف الأعمال ↓')}</a><a className="btn" href="/mohamed_kbany.pdf" onClick={downloadCv}>{t('Download CV','تحميل CV')}</a></div></div>
        <div className="industry-panel"><small>{t('BROWSE BY INDUSTRY','تصفح حسب مجال نشاطك')}</small><h2>{t('What do you sell?','عميلك بيبيع إيه؟')}</h2><div className="industry-grid">{selectors.map(([key,en,arabic])=><button key={key} onClick={()=>{setSector(key);setSectorVideo(null);setDraftOrder(null);setOrderMsg('');}}>{ar?arabic:en}</button>)}</div></div>
      </section><div className="home-divider" id="existing">{t('Explore my work','استكشف أعمالي')}</div>
      <section className="brands">
        <p className="hint">{t("Explore projects and creative work for each brand.","استكشف الأعمال حسب العلامة التجارية")}</p>
        <div className="logo-row">
          {logos.concat(logos).map((l, i) => (
            <button key={l.id + "-" + i} className="brand-card" aria-hidden={i >= logos.length} tabIndex={i >= logos.length ? -1 : 0} onClick={() => {setBrand(l); setPlaying(null); trackLogoOpen(l);}}><img src={l.logo} alt={l.name || "brand"} loading="lazy" /><span>▶</span></button>
          ))}
        </div>
      </section>
        <div className="stats">
          <div><strong>5+</strong><span>{t('Years of experience','سنوات خبرة')}</span></div>
          <div><strong>550+</strong><span>{t('Projects completed','مشروع مكتمل')}</span></div>
          <div><strong>95%</strong><span>{t('Performance Rate','معدل الأداء')}</span></div>
          <div><strong>250+</strong><span>{t('Happy Clients','عميل سعيد')}</span></div>
        </div>
      <section className="services">
        <p className="kicker">{t('WHAT I DO','خدماتي')}</p>
        <h3>{t('Services','أقسام الأعمال')}</h3>
        <p className="hint">{t('HOVER TO PREVIEW','اختار القسم')}</p>
        <div className="service-grid">
          {SERVICES.map((s) => (
            <Link key={s.cat} to={`/works/${s.cat}`} className="service-card">
              <img src={s.img} alt={s.title} loading="lazy" />
              <div className="service-body">
                <span className="num">{s.n}</span>
                <h4>{ar?SERVICE_AR[s.cat][0]:s.title}</h4>
                <p>{ar?SERVICE_AR[s.cat][1]:s.desc}</p>
                <span className="arrow">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="selection">
        <h3>{t('A Selection of My Work','مختارات من أعمالي')}</h3>
        <p className="hint">{t('A glimpse into my creative work. Explore the full portfolio for more projects and collaborations.','لمحة من شغلي. استكشف البورتفوليو الكامل للمزيد من الأعمال.')}</p>
        {ownerMode && <OwnerBar category="home" allVideos={allRaw} onChanged={loadHome} defaultType="short" />}
        <div className="vid-strip">
          {(ownerMode ? homeBase : homeVids).map((v, vi, ownerList) => { const linkEl = (
            <Link key={v.id} to={(() => { const target = library.find(x => x.category !== "home" && (x.url === v.url || (ytId(x.url) && ytId(x.url) === ytId(v.url)))); return target ? `/works/${target.category}?project=${encodeURIComponent(target.id)}` : "/works"; })()} className="vid-thumb" style={ytId(v.url) === "po4fm-j5pt8" ? {gridColumn:"span 2",aspectRatio:"16/9",alignSelf:"center"} : undefined}>
              {thumb(v.url) && <img src={thumb(v.url)} onError={thumbFallback} alt={v.title || "video"} loading="lazy" />}
            </Link>); return ownerMode ? <div key={v.id} style={{ position: "relative" }}>{linkEl}{v.id === "home-ad23-selfhost" ? null : <CardControls list={ownerList.filter(x => x.id !== "home-ad23-selfhost")} allVideos={allRaw} index={ownerList.filter(x => x.id !== "home-ad23-selfhost").findIndex(x => x.id === v.id)} onChanged={loadHome} overlay />}</div> : linkEl; })}
        </div>
        <Link className="btn primary" to="/works">{t('CLICK TO VIEW MY WORKS','اضغط لمشاهدة الأعمال')}</Link>
      </section>


      <footer className="home-footer"><div><h4>{t('Quick Links','روابط سريعة')}</h4><Link to="/">{t('Home','الرئيسية')}</Link><Link to="/works">{t('Works','الأعمال')}</Link>{SERVICES.map(s=><Link key={s.cat} to={'/works/'+s.cat}>{ar?SERVICE_AR[s.cat][0]:s.title}</Link>)}</div><div><h4>{t('Get in Touch','تواصل معي')}</h4><p>{t('Available for freelance & collaborations','متاح للعمل الحر والتعاون')}</p><a className="btn" href={WA} target="_blank" rel="noreferrer">{t('Contact Me','تواصل معي')}</a></div><p className="home-copy">{t('© 2026 Mohamed Kbany. All rights reserved.','© 2026 محمد قباني. جميع الحقوق محفوظة.')}</p></footer>
      </div>
      {sector && !sectorVideo && <div className="lightbox" onClick={()=>setSector(null)}><div className="lightbox-inner brand-dialog sector-dialog" dir={ar?'rtl':'ltr'} onClick={e=>e.stopPropagation()}><button className="close" aria-label={t('Close','إغلاق')} onClick={()=>setSector(null)}>✕</button><h3>{selectors.find(x=>x[0]===sector)?.[ar?2:1]}</h3><p className="hint">{t('Browse related work. Existing sections are unchanged.','أعمال مرتبطة بالمجال. الأقسام الأصلية زي ما هي.')}</p>{isOwner&&<div className="sector-owner"><p>{t('Owner only: use arrows to reorder this sector, then Save. Other sections keep their order.','لصاحب الموقع فقط: رتب بأسهم لفوق وتحت ثم احفظ. ترتيب الأقسام الأصلية لا يتغير.')}</p><button className="btn" disabled={savingOrder||!draftOrder} onClick={saveSectorOrder}>{savingOrder?t('Saving...','بيتحفظ...'):t('Save sector order','احفظ ترتيب المجال')}</button><p role="status">{orderMsg}</p></div>}<div className="brand-videos">{sectorItems.map((v,index)=><div key={v.id}><button onClick={()=>{setSectorVideo(v);trackVideoPlay(v);}}><img src={thumb(v.url)} onError={thumbFallback} alt={v.title}/><span>▶</span><p>{v.title}</p></button>{isOwner&&<div className="order-buttons"><span>{index+1}</span><button className="btn" disabled={index===0||savingOrder} onClick={()=>shiftSector(index,-1)} aria-label={t('Move up','حرك لفوق')}>↑</button><button className="btn" disabled={index===sectorItems.length-1||savingOrder} onClick={()=>shiftSector(index,1)} aria-label={t('Move down','حرك لتحت')}>↓</button></div>}</div>)}</div><Link className="btn" to="/works">{t('All works','كل الأعمال')}</Link></div></div>}
      {sectorVideo && <PlayerOverlay key={sectorVideo.id || sectorVideo.url} video={sectorVideo} suggestions={[]} onClose={()=>setSectorVideo(null)} onPick={v=>setSectorVideo(v)}/>}
      {brand && <div className="lightbox" onClick={()=>setBrand(null)}><div className="lightbox-inner brand-dialog" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setBrand(null)}>✕</button><h3>{brand.name}</h3>{playing ? <PlayerOverlay key={playing} video={{ url: playing, title: brand.name }} suggestions={(brand.videos || []).filter((u) => u !== playing).slice(0, 3).map((u) => ({ url: u, title: brand.name }))} onClose={() => setPlaying(null)} onPick={(v) => setPlaying(v.url)} /> : <div className="brand-videos">{(brand.videos || []).map((url,i)=><button key={i} onClick={()=>setPlaying(url)}><img src={thumb(url)} onError={thumbFallback} alt="Play project"/><span>▶</span></button>)}</div>}</div></div>}
    </>
  );
}
