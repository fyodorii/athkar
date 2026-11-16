// App shell: hash routes, the side menu, theme and the one-second tick (countdowns, timers, reminders).

import { setDigits } from './dates.js';
import { FONTS } from './ui.js';
import { icon } from './icons.js';
import { checkForUpdate, isIOS, isStandalone, registerServiceWorker } from './push.js';
import { onChange, persistStorage, state } from './store.js';
import { $, esc, toast } from './ui.js';
import * as home from './views/home.js';
import * as adhkar from './views/adhkar.js';
import * as notebook from './views/notebook.js';
import * as calendar from './views/calendar.js';
import * as counter from './views/counter.js';
import * as settings from './views/settings.js';
import * as worship from './views/worship.js';
import * as radioView from './views/radio.js';
import * as audioView from './views/audio.js';
import * as tools from './views/tools.js';
import * as khatma from './views/khatma.js';
import * as debts from './views/debts.js';
import * as datecalc from './views/datecalc.js';
import * as rawatib from './views/rawatib.js';
import * as reminders from './views/reminders.js';
import * as account from './views/account.js';
import { takeRedirect } from './google.js';
import { CATEGORY_BY_ID } from './adhkar-data.js';
import { APP_NAME, APP_VERSION, DESIGNER } from './config.js';
import { checkReminders } from './notify.js';
import { anyTimerRunning, checkTimers, keepAwake } from './timers.js';
import { onRadio, radioStatus, stop as stopRadio, toggle as toggleRadio } from './radio.js';

// The side menu: the sections, then the tools, then the settings ('' is a divider).
const TABS = [
  ['home', 'الرئيسية', 'home', '#/home'],
  ['mine', 'أذكاري', 'heart', '#/mine'],
  ['duas', 'أدعيتي', 'hand', '#/notebook'],
  ['tasbeeh', 'السبحة', 'beads', '#/tasbeeh'],
  ['counter', 'العداد', 'hash', '#/counter'],
  ['worship', 'متابعة', 'check', '#/worship'],
  ['radio', 'الإذاعة', 'radio', '#/radio'],
  ['audio', 'الصوتيات', 'play', '#/audio'],
  ['calendar', 'التقويم', 'calendar', '#/calendar'],
  '',
  ['tools', 'الأدوات', 'widget', '#/tools'], // also the khatmas, nawafil, reminders, debts and the date calculator
  '',
  ['settings', 'الإعدادات', 'gear', '#/settings'],
];

// [pattern, tab, view(viewEl, ...params)]
const ROUTES = [
  [/^#\/home$/, 'home', (v) => home.render(v)],
  [/^#\/mine(?:\/([\w-]+))?$/, 'mine', (v, id) => adhkar.renderMine(v, id)],
  // A set of adhkar (morning, evening, sleep, or one of the day's occasions); an unknown one opens «أذكاري».
  [/^#\/adhkar(?:\/([\w-]+))?$/, 'mine', (v, id) => (CATEGORY_BY_ID[id] ? adhkar.renderWird(v, id) : adhkar.renderMine(v))],
  [/^#\/radio$/, 'radio', (v) => radioView.renderRadio(v)],
  [/^#\/audio$/, 'audio', (v) => audioView.render(v)],
  [/^#\/calendar$/, 'calendar', (v) => calendar.render(v)],
  [/^#\/counter$/, 'counter', (v) => counter.render(v)],
  [/^#\/tasbeeh(?:\/([\w-]+))?$/, 'tasbeeh', (v, id) => adhkar.renderTasbeeh(v, id)],
  [/^#\/worship$/, 'worship', (v) => worship.render(v)],
  [/^#\/tools$/, 'tools', (v) => tools.renderTools(v)],
  [/^#\/ahzab$/, 'tools', (v) => tools.renderAhzab(v)],
  [/^#\/qailulah$/, 'tools', (v) => tools.renderQailulah(v)],
  [/^#\/walk$/, 'tools', (v) => tools.renderWalk(v)],
  [/^#\/focus$/, 'tools', (v) => tools.renderFocus(v)],
  [/^#\/nahy$/, 'tools', (v) => tools.renderNahy(v)],
  [/^#\/sahw$/, 'tools', (v) => tools.renderSahw(v)],
  [/^#\/khatma$/, 'khatma', (v) => khatma.render(v)],
  [/^#\/debts$/, 'debts', (v) => debts.render(v)],
  [/^#\/datecalc$/, 'datecalc', (v) => datecalc.render(v)],
  [/^#\/rawatib$/, 'rawatib', (v) => rawatib.render(v)],
  [/^#\/reminders$/, 'reminders', (v) => reminders.render(v)],
  [/^#\/notebook(?:\/\w+)?$/, 'duas', (v) => notebook.render(v)], // «saved» and «notes» are old links
  [/^#\/settings$/, 'settings', (v) => settings.render(v)],
  [/^#\/settings\/location$/, 'settings', (v) => settings.renderLocation(v)],
  [/^#\/settings\/method$/, 'settings', (v) => settings.renderMethod(v)],
  [/^#\/settings\/icon$/, 'settings', (v) => settings.renderIcon(v)],
  [/^#\/settings\/fonts$/, 'settings', (v) => settings.renderFonts(v)],
  [/^#\/settings\/notify$/, 'settings', (v) => settings.renderNotify(v)],
  [/^#\/settings\/account$/, 'settings', (v) => account.render(v)],
];

const view = $('#view');
let current = null;
let currentHash = '';

function route() {
  const hash = location.hash || '#/home';
  // Links to what the app no longer has (memorization, ruqyah, widget) open the home screen.
  if (/^#\/(quran|hifz|ruqyah|calendar\/[\d-]+|surah\/\w+|qibla|settings\/widget)$/.test(hash)) {
    location.replace('#/home');
    return;
  }
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
  closeNav();
  try {
    current = fn(view, ...m.slice(1)) || null;
  } catch (err) {
    // A screen that cannot be drawn shows why, instead of a blank page.
    current = null;
    showError(err);
  }
  // What sticks under the header (the adhkar progress line) needs its height.
  view.style.setProperty('--head-h', `${view.querySelector('.page-head')?.offsetHeight || 0}px`);
  for (const a of document.querySelectorAll('#tabs a')) a.classList.toggle('on', a.dataset.tab === tab);
  document.body.dataset.tab = tab;
  paintStatusBar();
  renderMini();
  view.classList.remove('enter');
  void view.offsetWidth;
  view.classList.add('enter');
}

// ---- When something fails: the error on the screen, with ways out ----

function showError(err) {
  console.error(err);
  const text = `${err?.name || 'Error'}: ${err?.message || err}\n${String(err?.stack || '').split('\n').slice(0, 4).join('\n')}\n${location.hash} · v${APP_VERSION}`;
  view.className = 'view';
  view.innerHTML = `
    <section class="app-error">
      <b>حدث خطأ في هذه الصفحة</b>
      <p>أرسل صورة هذه الشاشة لمصمم التطبيق ليصلحه.</p>
      <pre dir="ltr">${esc(text)}</pre>
      <div>
        <a class="btn primary" href="#/home">الرئيسية</a>
        <button class="btn ghost" data-err-copy>نسخ الخطأ</button>
        <button class="btn ghost" data-err-repair>إعادة تحميل التطبيق</button>
      </div>
    </section>`;
  view.querySelector('[data-err-copy]').onclick = () => navigator.clipboard?.writeText(text).then(() => toast('نُسخ الخطأ'), () => {});
  view.querySelector('[data-err-repair]').onclick = async () => {
    try {
      for (const k of await caches.keys()) await caches.delete(k);
      for (const r of (await navigator.serviceWorker?.getRegistrations()) || []) await r.unregister();
    } catch (e) {}
    location.reload();
  };
}
// An error after the page was drawn (a tap, a timer) that left the screen empty is shown too.
window.addEventListener('error', (e) => {
  if (!view.children.length) showError(e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  if (!view.children.length) showError(e.reason);
});

function renderTabs() {
  $('#tabs').innerHTML =
    `<div class="nav-head"><b>${APP_NAME}</b></div>` +
    TABS.map((t) => (t ? `<a href="${t[3]}" data-tab="${t[0]}">${icon(t[2], 22)}<span>${t[1]}</span></a>` : '<hr>')).join('') +
    `<p class="nav-foot">تصميم ${DESIGNER}</p>`;
}

// ---- Side menu (phones): opened by the menu button of each screen ----

const closeNav = () => document.body.classList.remove('nav-open');
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-nav]')) return document.body.classList.toggle('nav-open');
  // A tap on the dimmed page, or on a section (also the one already open), closes the menu.
  if (e.target.closest('#nav-backdrop, #tabs a')) closeNav();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeNav());

// ---- No zooming: the app is laid out for the screen, like a native one. The viewport and
// `touch-action` in the CSS stop the double tap; these stop the pinch where Safari ignores them. ----

for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false });

// ---- Theme ----

// The phone's status bar (the clock and battery) takes the colour of the top of the page under
// it, so it reads as part of the page: the light header on the home screen, the page's own
// background elsewhere, the tasbeeh's colour on the tasbeeh.
const STATUS = { dark: { home: '#101b30', tasbeeh: '#070f2c', other: '#0a1220' } };
function paintStatusBar() {
  // In the light theme the top of every screen is the app colour.
  const main = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#2c6fcc';
  const shade = document.documentElement.dataset.theme === 'dark' ? { ...STATUS.dark, home: '#232a4a' } : { home: '#9ea6cc', other: main };
  const tab = document.body.dataset.tab;
  const own = tab === 'tasbeeh' && document.querySelector('.tsb')?.dataset.top;
  document.querySelector('meta[name="theme-color"]').setAttribute('content', own || shade[tab] || shade.other);
}

const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'auto' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.accent = state.settings.accent || 'blue';
  paintStatusBar();
  setDigits(state.settings.digits);
  const s = state.settings;
  document.documentElement.toggleAttribute('data-flat', !!s.flat);
  const root = document.documentElement.style;
  root.setProperty('--font-text', FONTS[s.fontText] || FONTS.tajawal);
  root.setProperty('--font-ui', FONTS[s.fontUi] || FONTS.tajawal);
  root.setProperty('--text-weight', s.textWeight || 500);
  root.setProperty('--font-tsb', FONTS[s.fontTsb] || FONTS.tajawal);
  root.setProperty('--tsb-weight', s.tsbWeight || 700);
  root.setProperty('--ui-weight', s.uiWeight || 400);
  root.setProperty('--head-scale', s.headScale || 1);
}
media.addEventListener?.('change', applyTheme);

// ---- Radio mini player (above the tabs while a station is on) ----

function renderMini() {
  const el = $('#mini');
  const { status, station } = radioStatus();
  const onRadioPage = location.hash === '#/radio' || location.hash === '#/audio';
  if (!station || onRadioPage || document.body.dataset.tab === 'tasbeeh') {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const live = status === 'playing' || status === 'loading';
  el.innerHTML = `
    <a href="#/radio" class="mini-info">${icon('radio', 20)}<span><b>${esc(station.name)}</b><small>${station.clip ? `${esc(station.sub || '')} • ${radioView.statusText(status, true)}` : radioView.statusText(status)}</small></span></a>
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
// Back from Google's sign-in: the token in the address is taken, and the app opens where it was.
const signedIn = takeRedirect();
if (signedIn) history.replaceState(null, '', location.pathname + signedIn.back); // without Google's ?code=… or #access_token=…
route();
if (signedIn?.error) toast(signedIn.error);
window.addEventListener('hashchange', route);
// Reminders while the app is closed (away.js) are loaded on their own: if a content blocker or a
// failed download keeps that file away, the rest of the app still opens.
const syncPush = () => import('./away.js').then((m) => m.syncPush()).catch(() => {});
let pushPending = false;

let pushTimer;
onChange(() => {
  applyTheme();
  // The reminders may have changed (times, switches, a khatma): send them again, a moment later.
  clearTimeout(pushTimer);
  pushPending = true;
  pushTimer = setTimeout(() => {
    pushPending = false;
    syncPush();
  }, 1500);
});

setInterval(() => {
  try {
    checkReminders(); // also while hidden, for as long as the system keeps the app alive
  } catch (e) {
    console.warn(e); // a reminder that cannot be read must not stop the countdowns below
  }
  if (document.visibilityState !== 'visible') return;
  checkTimers();
  if (current?.tick?.() === 'rerender') route();
}, 1000);

// Leaving the app: send a change not yet sent now, before the system stops the app.
const flushPush = () => {
  if (!pushPending) return;
  clearTimeout(pushTimer);
  pushPending = false;
  syncPush();
};
window.addEventListener('pagehide', flushPush);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return flushPush();
  if (current?.tick) route();
  checkForUpdate();
  checkTimers();
  checkReminders();
  syncPush();
  // The screen lock is dropped when the app is hidden; take it again for a running timer.
  if (anyTimerRunning()) keepAwake(true);
});

registerServiceWorker();
syncPush();
persistStorage();
installHint();
document.documentElement.classList.add('ready');
