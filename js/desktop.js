// Inside the Windows app (desktop/, Tauri): reminders become Windows notifications shown
// by the app itself, since there is no web push there. The app keeps running by the clock
// when its window is closed, so they come on time as long as the computer is on.

import { buildSchedule } from './schedule.js';
import { state } from './store.js';

const T = window.__TAURI__ || null;
export const isDesktop = !!T;

export async function notifyAllowed() {
  if (!T) return false;
  return T.notification.isPermissionGranted();
}

export async function askNotify() {
  if (!T) return false;
  if (await T.notification.isPermissionGranted()) return true;
  return (await T.notification.requestPermission()) === 'granted';
}

export function notify(title, body) {
  T?.notification.sendNotification({ title, body });
}

// Every reminder whose time has come since the last check, shown once. After a long sleep
// only the recent ones (the last 10 minutes) are shown, not a flood of old reminders.
const SEEN = 'adhkar-app:desktop-seen';
function checkReminders() {
  if (!state.settings.notify.enabled) return;
  const now = Date.now();
  let last = Number(localStorage.getItem(SEEN)) || now - 60000;
  last = Math.max(last, now - 10 * 60000);
  const due = buildSchedule(state, { days: 2, from: last }).filter((x) => x.at <= now);
  for (const x of due.slice(-3)) notify(x.title, x.body);
  localStorage.setItem(SEEN, String(now));
}

// Start with Windows (hidden by the clock until opened).
export async function autostartEnabled() {
  return T ? T.autostart.isEnabled() : false;
}
export async function setAutostart(on) {
  if (!T) return;
  if (on) await T.autostart.enable();
  else await T.autostart.disable();
}

export function startDesktop() {
  if (!T) return;
  document.documentElement.classList.add('desktop');
  // Links to other sites open in the browser, not inside the app's window.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin === location.origin || !/^https?:$/.test(url.protocol)) return;
    e.preventDefault();
    T.opener.openUrl(url.href);
  });
  checkReminders();
  setInterval(checkReminders, 20000);
}
