// Service worker: keeps the app on the device so it opens instantly and offline,
// and shows the reminders that push/cron.php sends.

const VERSION = 'v11'; // raise on every release (with APP_VERSION in js/config.js) so phones fetch the new files
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
  'js/khatma.js',
  'js/hifz.js',
  'js/occasions.js',
  'js/sunnah.js',
  'js/surahs/kahf.js',
  'js/surahs/mulk.js',
  'js/surahs/baqarah.js',
  'js/qailulah-data.js',
  'js/quran-data.js',
  'js/radio.js',
  'js/ruqyah-data.js',
  'js/dates.js',
  'js/icons.js',
  'js/prayer.js',
  'js/push.js',
  'js/schedule.js',
  'js/store.js',
  'js/timers.js',
  'js/today.js',
  'js/ui.js',
  'js/widget.js',
  'js/wird-data.js',
  'js/views/adhkar.js',
  'js/views/home.js',
  'js/views/notebook.js',
  'js/views/quran.js',
  'js/views/qibla.js',
  'js/views/settings.js',
  'js/views/tools.js',
  'js/views/hifz.js',
  'js/views/calendar.js',
  'js/views/surah.js',
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
  if (url.origin !== location.origin || url.pathname.includes('/push/')) return;
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

// ---- Push notifications ----

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let msg = {};
      try {
        msg = event.data ? event.data.json() : {};
      } catch (e) {
        msg = { body: event.data ? event.data.text() : '' };
      }
      // Servers whose PHP cannot encrypt payloads send an empty push; fetch the text instead.
      if (!event.data) {
        try {
          const sub = await self.registration.pushManager.getSubscription();
          const res = await fetch(new URL('push/pending.php', self.registration.scope), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub && sub.endpoint }),
          });
          msg = await res.json();
        } catch (e) {
          // Show the generic notification below.
        }
      }
      // iOS requires every push to show a notification, so always show one.
      await self.registration.showNotification(msg.title || 'أذكار ومواقيت', {
        body: msg.body || '',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: msg.tag || undefined,
        lang: 'ar',
        dir: 'rtl',
        data: { url: msg.url || '#/home' },
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '#/home', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope)) {
          await client.focus();
          client.postMessage({ type: 'open', url });
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
