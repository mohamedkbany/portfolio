const CACHE = "kbany-pwa-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Never cache analytics/auth/API traffic
  if (url.hostname.includes("googleapis.com") || url.hostname.includes("firebase") || url.hostname.includes("cloudinary") || url.hostname.includes("youtube")) return;

  if (e.request.mode === "navigate") {
    // Network-first for pages so updates show immediately
    e.respondWith(
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put("/", copy));
        return res;
      }).catch(() => caches.match("/").then((r) => r || caches.match(e.request)))
    );
    return;
  }

  if (url.origin === location.origin) {
    // Cache-first for static assets (JS/CSS/images)
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        if (res.ok && (url.pathname.startsWith("/assets/") || /\.(png|webp|svg|woff2?|pdf)$/.test(url.pathname))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }))
    );
  }
});
