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

const isMp4Url = (u) => /\.mp4(\?|$)/i.test(u || "");

export default function PlayerOverlay({ video, suggestions = [], onClose, onPick }) {
  const isMp4 = isMp4Url(video.url);
  const mountRef = useRef(null);
  const wrapRef = useRef(null);
  const playerRef = useRef(null);
  const [ended, setEnded] = useState(false);

  // Create the player once.
  useEffect(() => {
    if (isMp4) {
      const el0 = wrapRef.current;
      if (el0 && el0.requestFullscreen) { try { el0.requestFullscreen().catch(() => {}); } catch (e) {} }
      return () => {
        if (document.fullscreenElement) { try { document.exitFullscreen().catch(() => {}); } catch (e) {} }
      };
    }
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
    if (!isMp4 && playerRef.current && playerRef.current.loadVideoById) {
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
          {isMp4 ? (
            <video
              className="mp4-mount"
              src={video.url}
              autoPlay
              controls
              playsInline
              onEnded={() => setEnded(true)}
              onPlay={() => setEnded(false)}
            />
          ) : (
            <div ref={mountRef} className="yt-mount" />
          )}
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
              <a className="ended-wa" href={WA} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.2 14.2c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.5-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9 1-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.4-.1.7.2.3.8 1.4 1.8 2.2 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.4.1.1.1.7-.1 1.3z"/></svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
