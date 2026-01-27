// Simple cache-first service worker for offline PWA
const CACHE = "rb-checklist-pwa-v23_2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=23.2",
  "./app.js?v=23.2",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
  "./icon-192.png",
  "./icon-512.png",
  "./icon-192-maskable.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "./apple-touch-icon-152.png",
  "./apple-touch-icon-167.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Network for POST (endpoint)
  if (req.method === "POST") return;
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
