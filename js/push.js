// Web Push for the home-screen app: push/cron.php on the server sends each reminder
// at its time, and sw.js shows it, even when the app is closed.

import { PUSH_URL } from './config.js';
import { buildSchedule, scheduleHash } from './schedule.js';
import { save, state } from './store.js';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.navigator.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;

let registration;
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  registration ??= navigator.serviceWorker.register('sw.js').catch(() => null);
  return registration;
}

async function api(path, body) {
  const res = await fetch(new URL(path, new URL(PUSH_URL, location.href)), {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function base64UrlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await registerServiceWorker();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function pushActive() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  return !!(await currentSubscription());
}

async function upload(sub) {
  const schedule = buildSchedule(state);
  await api('subscribe.php', { subscription: sub.toJSON(), schedule, place: state.settings.location.name });
  state.sync = { hash: scheduleHash(state), at: Date.now() };
  save();
}

// Must run straight from a tap: iOS only shows the permission prompt for a user gesture.
export async function enablePush() {
  if (!pushSupported()) throw new Error(isIOS() && !isStandalone() ? 'ADD_TO_HOME' : 'UNSUPPORTED');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('DENIED');
  const reg = await registerServiceWorker();
  if (!reg) throw new Error('UNSUPPORTED');
  let publicKey;
  try {
    ({ publicKey } = await api('key.php'));
  } catch (e) {
    throw new Error('SERVER');
  }
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
  try {
    await upload(sub);
  } catch (e) {
    throw new Error('SERVER');
  }
  return true;
}

// Re-sends the reminders when settings changed, or every half day so the server
// always holds the coming weeks. Quiet on failure; the next open tries again.
export async function syncSchedule(force = false) {
  if (!state.settings.notify.enabled) return;
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    const stale = Date.now() - state.sync.at > 12 * 3600000;
    if (force || stale || state.sync.hash !== scheduleHash(state)) await upload(sub);
  } catch (e) {
    // Offline or server down.
  }
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await api('subscribe.php', { endpoint: sub.endpoint, remove: true }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

export async function sendTest() {
  const sub = await currentSubscription();
  if (!sub) throw new Error('NOT_SUBSCRIBED');
  await api('subscribe.php', { endpoint: sub.endpoint, test: true });
}

// Taps on a notification while the app is open arrive as a message from the service worker.
export function onNotificationOpen(handler) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'open') handler(e.data.url);
  });
}
