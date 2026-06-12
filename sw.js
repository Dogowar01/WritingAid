// Scriptorium service worker v2 — network-first for the app itself,
// so new deploys always show up; cache only as offline fallback.
const CACHE = 'scriptorium-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './favicon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Never touch API calls.
  if (url.hostname.endsWith('anthropic.com')) return;
  if (url.origin !== self.location.origin) return;

  const isAppShell =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('index.html');

  if (isAppShell) {
    // NETWORK-FIRST: always try to get the latest app, fall back to cache offline.
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
  } else {
    // Assets (icons etc.): cache-first, refresh in background.
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
