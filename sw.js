// Offline support for The Kitchen Lab.
// Network first (so updates arrive right away), falling back to the cached copy offline.
// Requests always check with the server (cache: 'no-cache'), so the browser never mixes
// an old copy of one code file with a new copy of another after an update.
// Voice clips are the exception: their file names are a hash of the words, so a cached
// clip never goes stale and is played straight from the cache (no wait on a slow network).
const CACHE = 'kitchen-lab-v6';
// Every code, style and data file. tools/check-data.mjs tells you if one is missing.
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/game.css',
  './js/main.js',
  './js/kitchens.js',
  './js/recipes.js',
  './js/voice-lines.js',
  './js/util.js',
  './js/sound.js',
  './js/fx.js',
  './js/stir.js',
  './js/voice.js',
  './data/items.js',
  './data/customers.js',
  './data/phrases.js',
  './data/kitchens/index.js',
  './data/kitchens/kitchen.js',
  './data/kitchens/bakery.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    // Voice clips (if they have been made) so the natural voice also works offline.
    try {
      const res = await fetch('./voice/manifest.json', { cache: 'no-cache' });
      if (res.ok) {
        await cache.put('./voice/manifest.json', res.clone());
        const { clips = {} } = await res.json();
        await cache.addAll(Object.values(clips).map(f => './voice/' + f));
      }
    } catch (e) { /* no voice clips yet */ }
    // Sticker pictures (made by tools/make-images.mjs) so they also show offline.
    try {
      const res = await fetch('./img/manifest.json', { cache: 'no-cache' });
      if (res.ok) {
        await cache.put('./img/manifest.json', res.clone());
        const { images = [] } = await res.json();
        await cache.addAll(images.map(f => './img/' + f));
      }
    } catch (e) { /* no pictures yet */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// A slow network must not hold up the voice: after this long, use the cached copy.
const SLOW_MS = 1000;

function fromNetwork(req) {
  return fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy));
    }
    return res;
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const offline = () => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
  if (/\/voice\/.+\.mp3$/.test(url.pathname)) {
    event.respondWith(caches.match(req).then(hit => hit || fromNetwork(req)));
    return;
  }
  if (url.pathname.endsWith('/voice/manifest.json')) {
    event.respondWith((async () => {
      const net = fromNetwork(req);
      const cached = await caches.match(req);
      if (!cached) return net;
      net.catch(() => {});
      const slow = new Promise(r => setTimeout(() => r(cached), SLOW_MS));
      return Promise.race([net.catch(() => cached), slow]);
    })());
    return;
  }
  event.respondWith(fromNetwork(req).catch(offline));
});
