/* Sandhya Grand Admin — minimal PWA service worker.
 *
 * Goals: make the admin installable (desktop + mobile home screen) and ALWAYS
 * fresh. It deliberately does NOT do aggressive offline caching — this is a live
 * ops tool, so data must be current:
 *   • /api, /socket.io, /uploads  → never touched (straight to network).
 *   • navigations (the HTML shell) → network-first, cached copy only as an
 *     offline fallback, so new deploys are picked up the moment you're online.
 *   • /static/* (content-hashed JS/CSS) → cache-first; a new build ships new
 *     filenames, so this can never serve a stale bundle.
 * skipWaiting + clients.claim make a new worker take over immediately.
 */
const CACHE = 'sg-admin-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Same-origin only; never intercept the API, sockets or uploaded files.
  if (url.origin !== self.location.origin) return;
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/uploads')
  ) {
    return;
  }

  // App shell / deep links: network-first, fall back to the cached shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put('/index.html', fresh.clone());
          return fresh;
        } catch (err) {
          const cache = await caches.open(CACHE);
          const cached = await cache.match('/index.html');
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Fingerprinted build assets: cache-first (a new build = new URL, so no staleness).
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })(),
    );
  }
});
