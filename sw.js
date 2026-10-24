// Service worker: keeps the app on the device so it opens instantly and offline.

const VERSION = 'v18'; // raise on every release (with APP_VERSION in js/config.js) so phones fetch the new files
const CACHE = `adhkar-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/adhkar-data.js',
  'js/cities.js',
  'js/config.js',
  'js/daily-data.js',
  'js/occasions.js',
  'js/qailulah-data.js',
  'js/quran-data.js',
  'js/radio.js',
  'js/dates.js',
  'js/icons.js',
  'js/prayer.js',
  'js/push.js',
  'js/store.js',
  'js/timers.js',
  'js/today.js',
  'js/ui.js',
  'js/wird-data.js',
  'js/views/adhkar.js',
  'js/views/home.js',
  'js/views/notebook.js',
  'js/views/radio.js',
  'js/views/settings.js',
  'js/views/tools.js',
  'js/views/occasions.js',
  'js/views/worship.js',
  'fonts/plex-arabic-400.woff2',
  'fonts/plex-arabic-600.woff2',
  'fonts/plex-arabic-700.woff2',
  'fonts/plex-latin-400.woff2',
  'fonts/plex-latin-600.woff2',
  'fonts/plex-latin-700.woff2',
  'fonts/amiri-regular.woff2',
  'fonts/amiri-bold.woff2',
  'fonts/kfgqpc-hafs.woff2',
  'fonts/tajawal-arabic-400.woff2',
  'fonts/tajawal-arabic-700.woff2',
  'fonts/tajawal-latin-400.woff2',
  'fonts/tajawal-latin-700.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/alt/emerald.png',
  'icons/alt/night.png',
  'icons/alt/violet.png',
  'icons/alt/sky.png',
  'icons/alt/parchment.png',
  'icons/alt/black.png',
  'icons/alt/burgundy.png',
  'icons/alt/gold.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('adhkar-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

// Answer from the device at once, and refresh the saved copy in the background.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const key = request.mode === 'navigate' ? 'index.html' : request;
      const saved = await cache.match(key, { ignoreSearch: request.mode === 'navigate' });
      const fresh = fetch(request)
        .then((res) => {
          if (res.ok && !res.redirected) cache.put(key, res.clone());
          return res;
        })
        .catch(() => saved);
      if (saved) {
        event.waitUntil(fresh);
        return saved;
      }
      return fresh;
    })()
  );
});
