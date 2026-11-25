export const TRACKING_VERSION = 2;
export const VIEW_SECONDS = 5;
export function burstReason(times, now) {
  if (times.filter(t => now - t <= 10000).length >= 6) return "6 openings within 10 seconds";
  if (times.filter(t => now - t <= 60000).length >= 15) return "15 openings within 60 seconds";
  return "";
}
export function eventSession(e) { return e.sessionId || e.visitorId; }
export function quarantinedSessions(events) {
  return new Set(events.filter(e => e.type === "session_quarantine" || e.trafficStatus === "quarantined").map(eventSession));
}
export function acceptedEvents(events) {
  const blocked = quarantinedSessions(events);
  return events.filter(e => !blocked.has(eventSession(e)));
}
export function countedVideos(videos, events) {
  const counts = new Map();
  const seen = new Set();
  acceptedEvents(events).filter(e => e.type === "video_view" && e.trackingVersion === 2 && e.measuredSeconds >= VIEW_SECONDS).forEach(e => {
    const key = `${eventSession(e)}:${e.playbackId || e.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    counts.set(e.videoId, (counts.get(e.videoId) || 0) + 1);
  });
  return videos.map(v => ({ ...v, views: Number(v.views || 0) + (counts.get(v.id) || 0) }));
}
export function playbackStep(state, position, now, playing, visible) {
  let seconds = state.seconds || 0;
  const elapsed = (now - state.at) / 1000;
  const advanced = position - state.position;
  if (playing && visible && state.playing && elapsed > 0 && elapsed <= 3 && advanced > 0 && advanced <= elapsed * 1.5 + .5) seconds += Math.min(elapsed, advanced);
  return { seconds, position, at: now, playing: playing && visible };
}
