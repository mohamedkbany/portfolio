import { useEffect, useRef, useState } from "react";
import { ytId, thumb, thumbFallback } from "./youtube";
import { WA } from "./App";

let apiPromise = null;
function loadYT() {
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      if (window.YT && window.YT.Player) return resolve(window.YT);
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    });
  }
  return apiPromise;
}

export default function PlayerOverlay({ video, suggestions = [], onClose, onPick }) {
  const mountRef = useRef(null);
  const wrapRef = useRef(null);
  const playerRef = useRef(null);
  const [ended, setEnded] = useState(false);

  // Create the player once.
  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: ytId(video.url),
        playerVars: { autoplay: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: (e) => {
            try { e.target.unMute(); e.target.setVolume(100); e.target.playVideo(); } catch (err) {}
          },
          onStateChange: (e) => {
            try {
              if (e.data === 1) { e.target.unMute(); }
              if (e.data === 0) setEnded(true);
            } catch (err) {}
          },
        },
      });
      window.__mkPlayer = playerRef.current;
    });
    const el = wrapRef.current;
    if (el && el.requestFullscreen) {
      try { el.requestFullscreen().catch(() => {}); } catch (e) {}
    }
    return () => {
      cancelled = true;
      try { playerRef.current && playerRef.current.destroy(); } catch (e) {}
      playerRef.current = null;
      if (document.fullscreenElement) {
        try { document.exitFullscreen().catch(() => {}); } catch (e) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap video when a suggestion is picked.
  useEffect(() => {
    if (playerRef.current && playerRef.current.loadVideoById) {
      setEnded(false);
      try {
        playerRef.current.loadVideoById(ytId(video.url));
        playerRef.current.unMute();
      } catch (e) {}
    }
  }, [video.url]);

  function close() {
    if (document.fullscreenElement) {
      try { document.exitFullscreen().catch(() => {}); } catch (e) {}
    }
    onClose();
  }

  return (
    <div className="lightbox" onClick={close}>
      <div className="lightbox-inner player-shell" ref={wrapRef} onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>✕</button>
        {video.title && <p className="lightbox-title">{video.title}</p>}
        <div className={video.type === "short" ? "player short" : "player"}>
          <div ref={mountRef} className="yt-mount" />
          {ended && (
            <div className="ended-overlay">
              {suggestions.length > 0 && (
                <>
                  <p className="ended-title">Watch next</p>
                  <div className="ended-grid">
                    {suggestions.slice(0, 3).map((s, i) => (
                      <button key={s.url + i} className="ended-card" onClick={() => onPick(s)}>
                        <img src={thumb(s.url)} onError={thumbFallback} alt={s.title || "video"} />
                        <span className="ended-play">▶</span>
                        {s.title && <span className="ended-card-title">{s.title}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="ended-cta-text">Like what you saw? Let's create yours.</p>
              <a className="cta ended-cta" href={WA} target="_blank" rel="noreferrer">Let's Talk</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
