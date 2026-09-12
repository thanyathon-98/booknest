/*
  BookNest service worker
  - Caches the static app shell (booknest.html, manifest.json, icons) so the
    app can still open when the device is briefly offline.
  - Does NOT cache or intercept cross-origin requests (Google Fonts, the XLSX
    CDN script) — those are left to the network/browser as normal, so nothing
    here can serve a stale copy of a third-party resource.
  - BookNest has no live Google Sheets fetch in the browser: the book data is
    baked into booknest.html itself when the file is generated, so there is
    no "dynamic data" for this service worker to accidentally cache or go
    stale — reloading booknest.html (from cache or network) always shows
    whatever data is currently inside that file.
*/

const CACHE_NAME = 'booknest-shell-v2';
const APP_SHELL = [
  './booknest.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('BookNest SW: precache failed', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests for the app shell.
  // Everything else (cross-origin CDN calls, POST, etc.) passes straight
  // through untouched — this SW never intercepts those.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Opportunistically cache newly-seen same-origin shell files.
          if (res && res.ok) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => caches.match('./booknest.html'));
    })
  );
});
