// Reminders while the app is closed: the phone subscribes to Web Push, and the app sends the next
// week's reminders to the push server (push/worker.js), which sends each one at its time.
// On the iPhone this works for the app added to the home screen (iOS 16.4 and later).

import { PUSH_URL, VAPID_PUBLIC } from './config.js';
import { askPermission, primeReminders, reminders } from './notify.js';
import { isIOS, isStandalone, registerServiceWorker } from './push.js';
import { save, state } from './store.js';

const DAYS = 7;
const key = () => Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (VAPID_PUBLIC.length % 4)) % 4)), (c) => c.charCodeAt(0));

export const pushConfigured = () => !!PUSH_URL;
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
// Why it cannot be turned on here, or '' when it can.
export function pushBlocker() {
  if (!pushConfigured()) return 'setup';
  if (isIOS() && !isStandalone()) return 'install';
  if (!pushSupported()) return 'unsupported';
  return '';
}

async function subscription(create) {
  const reg = await registerServiceWorker();
  if (!reg?.pushManager) return null;
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another server key cannot receive from this server: renew it.
  const same = sub && sub.options?.applicationServerKey && btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') === VAPID_PUBLIC;
  if (sub && sub.options?.applicationServerKey && !same) {
    await sub.unsubscribe().catch(() => {});
    sub = null;
  }
  if (!sub && create) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key() });
  return sub;
}

// The reminders of the next days, as the app would show them.
function upcoming() {
  const now = Date.now();
  const seen = new Set();
  const out = [];
  for (let d = 0; d < DAYS; d++) {
    for (const r of reminders(new Date(now + d * 86400000))) {
      if (r.at <= now || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push({ id: r.id, at: r.at, title: r.title, body: r.body, url: r.url });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

let last = '';
let lastAt = 0;
// Sends the coming reminders to the server; again only when they changed or every few hours.
export async function syncPush(force = false) {
  if (!state.settings.notify.push || !pushConfigured()) return;
  try {
    const sub = await subscription(false);
    if (!sub) return;
    const events = upcoming();
    const sig = JSON.stringify([sub.endpoint, events.map((e) => [e.id, e.at, e.title, e.body])]);
    if (!force && sig === last && Date.now() - lastAt < 6 * 3600000) return;
    // keepalive: the request still goes out when the app is being closed.
    const res = await fetch(`${PUSH_URL}/sync`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), events }) });
    if (res.ok) {
      last = sig;
      lastAt = Date.now();
    }
  } catch (e) {
    // Offline: the next sync sends them.
  }
}

// Turned on from the settings (a tap: the permission must follow a user gesture).
export async function enablePush() {
  const p = await askPermission();
  if (p !== 'granted') throw new Error('permission');
  const sub = await subscription(true);
  if (!sub) throw new Error('unsupported');
  state.settings.notify.push = true;
  if (!state.settings.notify.on) {
    state.settings.notify.on = true; // the reminders it sends are the ones switched on here
    primeReminders(); // without replaying the ones already past today
  }
  save();
  await syncPush(true);
}

// A test reminder from the server about a minute from now: close the app and it should arrive.
export async function testPush() {
  const sub = await subscription(false);
  if (!sub) throw new Error('unsupported');
  await syncPush(true);
  const res = await fetch(`${PUSH_URL}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
  if (!res.ok) throw new Error('server');
}

export async function disablePush() {
  state.settings.notify.push = false;
  save();
  try {
    const sub = await subscription(false);
    if (sub) {
      await fetch(`${PUSH_URL}/unsubscribe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch (e) {
    // Nothing more to undo.
  }
}
