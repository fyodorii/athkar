// App shell: hash routes, bottom tabs, theme, the one-second clock, and reminders
// shown inside the app while it is open.

import { setDigits } from './dates.js';
import { icon } from './icons.js';
import { isIOS, isStandalone, onNotificationOpen, registerServiceWorker, syncSchedule } from './push.js';
import { buildSchedule } from './schedule.js';
import { onChange, persistStorage, state } from './store.js';
import { $, esc, toast } from './ui.js';
import * as home from './views/home.js';
import * as adhkar from './views/adhkar.js';
import * as qibla from './views/qibla.js';
import * as notebook from './views/notebook.js';
import * as settings from './views/settings.js';
import * as worship from './views/worship.js';

const TABS = [
  ['home', 'الرئيسية', 'home'],
  ['adhkar', 'الأذكار', 'sun'],
  ['tasbeeh', 'السبحة', 'beads'],
  ['worship', 'عباداتي', 'check'],
  ['notebook', 'دفتري', 'book'],
];

// [pattern, tab, view(viewEl, ...params)]
const ROUTES = [
  [/^#\/home$/, 'home', (v) => home.render(v)],
  [/^#\/adhkar$/, 'adhkar', (v) => adhkar.renderList(v)],
  [/^#\/adhkar\/([\w-]+)$/, 'adhkar', (v, id) => adhkar.renderCategory(v, id)],
  [/^#\/mine(?:\/([\w-]+))?$/, 'adhkar', (v, id) => adhkar.renderMine(v, id)],
  [/^#\/tasbeeh$/, 'tasbeeh', (v) => adhkar.renderTasbeeh(v)],
  [/^#\/worship$/, 'worship', (v) => worship.render(v)],
  [/^#\/qibla$/, 'qibla', (v) => qibla.render(v)],
  [/^#\/notebook(?:\/(saved))?$/, 'notebook', (v, tab) => notebook.render(v, tab)],
  [/^#\/settings$/, 'settings', (v) => settings.render(v)],
  [/^#\/settings\/location$/, 'settings', (v) => settings.renderLocation(v)],
  [/^#\/settings\/method$/, 'settings', (v) => settings.renderMethod(v)],
  [/^#\/settings\/notify$/, 'settings', (v) => settings.renderNotify(v)],
  [/^#\/settings\/widget$/, 'settings', (v) => settings.renderWidget(v)],
];

const view = $('#view');
let current = null;
let currentHash = '';

function route() {
  const hash = location.hash || '#/home';
  const match = ROUTES.map(([re, tab, fn]) => [hash.match(re), tab, fn]).find(([m]) => m);
  if (!match) {
    location.replace('#/home');
    return;
  }
  const [m, tab, fn] = match;
  current?.destroy?.();
  view.innerHTML = '';
  view.className = `view view-${tab}`;
  if (hash !== currentHash) window.scrollTo(0, 0);
  currentHash = hash;
  current = fn(view, ...m.slice(1)) || null;
  for (const a of document.querySelectorAll('#tabs a')) a.classList.toggle('on', a.dataset.tab === tab);
  document.body.dataset.tab = tab;
  view.classList.remove('enter');
  void view.offsetWidth;
  view.classList.add('enter');
}

function renderTabs() {
  $('#tabs').innerHTML = TABS.map(
    ([id, label, ic]) => `<a href="#/${id}" data-tab="${id}">${icon(ic, 24)}<span>${label}</span></a>`
  ).join('');
}

// ---- Theme ----

const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'auto' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#08201d' : '#0b3b34');
  setDigits(state.settings.digits);
}
media.addEventListener?.('change', applyTheme);

// ---- Reminders while the app is open ----
// The server's push covers the closed app; this shows the same reminders in-app.

let reminderTimer;
function scheduleInApp() {
  clearTimeout(reminderTimer);
  if (!state.settings.notify.enabled) return;
  const next = buildSchedule(state, { days: 2 })[0];
  if (!next) return;
  const wait = next.at - Date.now();
  if (wait > 2 ** 31 - 1) return;
  reminderTimer = setTimeout(() => {
    if (document.visibilityState === 'visible') {
      chime();
      toast(`${icon('bell', 18)} <b>${esc(next.title)}</b><br>${esc(next.body)}`, 'reminder');
    }
    scheduleInApp();
  }, Math.max(0, wait) + 500);
}

// A soft two-note chime made in the browser, so no sound file is needed.
let audio;
function chime() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    for (const [f, d] of [
      [660, 0],
      [880, 0.18],
    ]) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.9);
      o.connect(g).connect(audio.destination);
      o.start(t + d);
      o.stop(t + d + 1);
    }
  } catch (e) {
    // No audio: the toast is enough.
  }
}

// ---- Install hint (iPhone Safari, not yet on the home screen) ----

function installHint() {
  if (!isIOS() || isStandalone()) return;
  try {
    if (localStorage.getItem('adhkar-app:install-hint')) return;
    localStorage.setItem('adhkar-app:install-hint', '1');
  } catch (e) {
    return;
  }
  setTimeout(
    () =>
      toast(
        `${icon('share', 18)} لتثبيت التطبيق: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»`,
        'reminder long'
      ),
    1500
  );
}

// ---- Start ----

applyTheme();
renderTabs();
route();
window.addEventListener('hashchange', route);
onChange(() => {
  applyTheme();
  scheduleInApp();
});

setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  if (current?.tick?.() === 'rerender') route();
}, 1000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (current?.tick) route();
  syncSchedule();
  scheduleInApp();
});

registerServiceWorker();
onNotificationOpen((url) => {
  const hash = new URL(url, location.href).hash;
  if (hash) location.hash = hash;
});
persistStorage();
syncSchedule();
scheduleInApp();
installHint();
document.documentElement.classList.add('ready');
