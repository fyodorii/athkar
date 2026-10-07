// App shell: hash routes, bottom tabs, theme, the one-second clock, and reminders
// shown inside the app while it is open.

import { setDigits } from './dates.js';
import { FONTS } from './ui.js';
import { icon } from './icons.js';
import { checkForUpdate, isIOS, isStandalone, onNotificationOpen, registerServiceWorker, syncSchedule } from './push.js';
import { buildSchedule } from './schedule.js';
import { onChange, persistStorage, state } from './store.js';
import { $, esc, toast } from './ui.js';
import * as home from './views/home.js';
import * as adhkar from './views/adhkar.js';
import * as qibla from './views/qibla.js';
import * as notebook from './views/notebook.js';
import * as settings from './views/settings.js';
import * as worship from './views/worship.js';
import * as quran from './views/quran.js';
import { onRadio, radioStatus, stop as stopRadio, toggle as toggleRadio } from './radio.js';

const TABS = [
  ['home', 'الرئيسية', 'home', '#/home'],
  ['mine', 'أذكاري', 'heart', '#/mine'],
  ['quran', 'القرآن', 'quran', '#/quran'],
  ['tasbeeh', 'السبحة', 'beads', '#/tasbeeh'],
  ['worship', 'عباداتي', 'check', '#/worship'],
];

// [pattern, tab, view(viewEl, ...params)]
const ROUTES = [
  [/^#\/home$/, 'home', (v) => home.render(v)],
  [/^#\/mine(?:\/([\w-]+))?$/, 'mine', (v, id) => adhkar.renderMine(v, id)],
  [/^#\/adhkar\/(morning|evening|sleep)$/, 'mine', (v, id) => adhkar.renderWird(v, id)],
  [/^#\/adhkar(?:\/[\w-]+)?$/, 'mine', (v) => adhkar.renderMine(v)], // old links
  [/^#\/quran$/, 'quran', (v) => quran.renderKhatma(v)],
  [/^#\/ruqyah$/, 'quran', (v) => quran.renderRuqyah(v)],
  [/^#\/radio$/, 'quran', (v) => quran.renderRadio(v)],
  [/^#\/tasbeeh$/, 'tasbeeh', (v) => adhkar.renderTasbeeh(v)],
  [/^#\/worship$/, 'worship', (v) => worship.render(v)],
  [/^#\/qibla$/, 'qibla', (v) => qibla.render(v)],
  [/^#\/notebook(?:\/(saved))?$/, 'mine', (v, tab) => notebook.render(v, tab)],
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
  renderMini();
  view.classList.remove('enter');
  void view.offsetWidth;
  view.classList.add('enter');
}

function renderTabs() {
  $('#tabs').innerHTML = TABS.map(
    ([id, label, ic, href]) => `<a href="${href}" data-tab="${id}">${icon(ic, 24)}<span>${label}</span></a>`
  ).join('');
}

// ---- Theme ----

const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'auto' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#08201d' : '#0b3b34');
  setDigits(state.settings.digits);
  const s = state.settings;
  const root = document.documentElement.style;
  root.setProperty('--font-text', FONTS[s.fontText] || FONTS.amiri);
  root.setProperty('--font-ui', FONTS[s.fontUi] || FONTS.plex);
  root.setProperty('--text-weight', s.textBold ? '700' : '400');
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

// ---- Radio mini player (above the tabs while a station is on) ----

function renderMini() {
  const el = $('#mini');
  const { status, station } = radioStatus();
  const onRadioPage = location.hash === '#/radio';
  if (!station || onRadioPage || document.body.dataset.tab === 'tasbeeh') {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const live = status === 'playing' || status === 'loading';
  el.innerHTML = `
    <a href="#/radio" class="mini-info">${icon('radio', 20)}<span><b>${esc(station.name)}</b><small>${quran.statusText(status)}</small></span></a>
    <button class="icon-btn ghost sm" data-mini="toggle" aria-label="${live ? 'إيقاف مؤقت' : 'تشغيل'}">${icon(live ? 'pause' : 'play', 20)}</button>
    <button class="icon-btn ghost sm" data-mini="stop" aria-label="إيقاف">${icon('close', 20)}</button>`;
}
$('#mini').addEventListener('click', (e) => {
  const a = e.target.closest('[data-mini]')?.dataset.mini;
  if (a === 'toggle') toggleRadio();
  if (a === 'stop') stopRadio();
});
onRadio(renderMini);

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
  checkForUpdate();
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
