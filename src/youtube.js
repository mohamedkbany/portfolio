export function ytId(url) {
  if (!url) return null;
  const m = url.match(/(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
export function thumb(url) {
  const id = ytId(url);
  if (id) return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
  if (/\.mp4(\?|$)/i.test(url || "") && url.includes("res.cloudinary.com")) {
    return url.replace("/video/upload/", "/video/upload/so_0,w_400,h_711,c_fill/").replace(/\.mp4(\?.*)?$/i, ".jpg");
  }
  return null;
}
export function thumbFallback(e) {
  const img = e.target;
  if (img.dataset.fb) return;
  img.dataset.fb = "1";
  img.src = img.src.replace("maxresdefault.jpg", "hqdefault.jpg");
}
export function embedUrl(url) {
  const id = ytId(url);
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0` : null;
}
