// Service worker: keeps the app on the device so it opens instantly and offline, and opens
// the app at the right screen when a reminder is tapped.

const VERSION = 'v59'; // raise on every release (with APP_VERSION in js/config.js) so phones fetch the new files
const CACHE = `adhkar-${VERSION}`;
// Files the app opens without (it loads them on their own and copes when they are missing).
const OPTIONAL = ['js/away.js'];
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
  'js/nahy-data.js',
  'js/sahw-data.js',
  'js/away.js',
  'js/audio-data.js',
  'js/views/audio.js',
  'js/quran-data.js',
  'js/radio.js',
  'js/dates.js',
  'js/icons.js',
  'js/google.js',
  'js/khatma.js',
  'js/notify.js',
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
  'js/views/khatma.js',
  'js/views/debts.js',
  'js/views/datecalc.js',
  'js/views/rawatib.js',
  'js/views/reminders.js',
  'js/views/account.js',
  'fonts/plex-arabic-400.woff2',
  'fonts/plex-arabic-600.woff2',
  'fonts/plex-arabic-700.woff2',
  'fonts/plex-latin-400.woff2',
  'fonts/plex-latin-600.woff2',
  'fonts/plex-latin-700.woff2',
  'fonts/amiri-regular.woff2',
  'fonts/amiri-bold.woff2',
  'fonts/uthmanic-hafs-v2.ttf',
  'fonts/tajawal-arabic-200.woff2',
  'fonts/tajawal-latin-200.woff2',
  'fonts/tajawal-arabic-300.woff2',
  'fonts/tajawal-latin-300.woff2',
  'fonts/tajawal-arabic-400.woff2',
  'fonts/tajawal-latin-400.woff2',
  'fonts/tajawal-arabic-500.woff2',
  'fonts/tajawal-latin-500.woff2',
  'fonts/tajawal-arabic-700.woff2',
  'fonts/tajawal-latin-700.woff2',
  'fonts/tajawal-arabic-800.woff2',
  'fonts/tajawal-latin-800.woff2',
  'fonts/tajawal-arabic-900.woff2',
  'fonts/tajawal-latin-900.woff2',
  'fonts/cairo-arabic.woff2',
  'fonts/cairo-latin.woff2',
  'fonts/vazirmatn-arabic.woff2',
  'fonts/vazirmatn-latin.woff2',
  'fonts/lateef-arabic-400.woff2',
  'fonts/lateef-latin-400.woff2',
  'fonts/lateef-arabic-700.woff2',
  'fonts/lateef-latin-700.woff2',
  'fonts/ruqaa-arabic-400.woff2',
  'fonts/ruqaa-latin-400.woff2',
  'fonts/ruqaa-arabic-700.woff2',
  'fonts/ruqaa-latin-700.woff2',
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

// A release is saved whole or not at all: each file is asked for with the release in its address,
// so no cache on the way (the browser's, GitHub's) can hand back an older copy, and if one file
// fails the new release is not installed and the one on the device stays.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        FILES.map(async (f) => {
          try {
            const res = await fetch(new Request(`${f}${f.includes('?') ? '&' : '?'}v=${VERSION}`, { cache: 'reload' }));
            if (!res.ok) throw new Error(`${f}: ${res.status}`);
            await cache.put(f, res);
          } catch (e) {
            // A file the app can live without (a content blocker may keep it away) does not stop the release.
            if (!OPTIONAL.includes(f)) throw e;
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('adhkar-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

// The release's own files come from the device: all of them from the same release, so the app
// never runs half old and half new (a new release arrives whole, as a new service worker). Other
// files of the site come from the internet, with the saved copy when offline.
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
      if (saved) return saved;
      try {
        const res = await fetch(request);
        if (res.ok && !res.redirected && request.mode !== 'navigate') cache.put(request, res.clone());
        return res;
      } catch (e) {
        return (await caches.match(key, { ignoreSearch: true })) || Response.error();
      }
    })()
  );
});

// A reminder sent by the push server while the app is closed (js/away.js, push/worker.js).
self.addEventListener('push', (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch (e) {
    d = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || 'مواقيت', {
      body: d.body || '',
      tag: d.tag || undefined,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      lang: 'ar',
      dir: 'rtl',
      data: { url: d.url || '#/home' },
    })
  );
});

// A tapped reminder brings the app forward at its screen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '#/home';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = all[0];
      if (open) {
        await open.focus();
        return open.navigate ? open.navigate(new URL('./' + url, self.registration.scope).href).catch(() => {}) : null;
      }
      return self.clients.openWindow('./' + url);
    })()
  );
});
