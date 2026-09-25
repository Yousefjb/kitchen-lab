// Offline support for The Kitchen Lab.
// Network first (so updates arrive right away), falling back to the cached copy offline.
// Requests always check with the server (cache: 'no-cache'), so the browser never mixes
// an old copy of one code file with a new copy of another after an update.
const CACHE = 'kitchen-lab-v5';
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

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
