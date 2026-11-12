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
import * as settings from './views/settings.js';
import * as worship from './views/worship.js';
import * as radioView from './views/radio.js';
import * as occasions from './views/occasions.js';
import * as tools from './views/tools.js';
import * as khatma from './views/khatma.js';
import * as debts from './views/debts.js';
import * as datecalc from './views/datecalc.js';
import * as rawatib from './views/rawatib.js';
import * as reminders from './views/reminders.js';
import { CATEGORY_BY_ID } from './adhkar-data.js';
import { APP_NAME, DESIGNER } from './config.js';
import { checkReminders } from './notify.js';
import { anyTimerRunning, checkTimers, keepAwake } from './timers.js';
import { onRadio, radioStatus, stop as stopRadio, toggle as toggleRadio } from './radio.js';

// The side menu: the sections, then the tools, then the settings ('' is a divider).
const TABS = [
  ['home', 'الرئيسية', 'home', '#/home'],
  ['mine', 'أذكاري', 'heart', '#/mine'],
  ['tasbeeh', 'السبحة', 'beads', '#/tasbeeh'],
  ['worship', 'متابعة العبادات', 'check', '#/worship'],
  ['radio', 'الإذاعة', 'radio', '#/radio'],
  ['occasions', 'المناسبات', 'calendar', '#/occasions'],
  '',
  ['khatma', 'الختمات', 'quran', '#/khatma'],
  ['rawatib', 'السنن الرواتب', 'mosque', '#/rawatib'],
  ['reminders', 'تذكيراتي', 'bell', '#/reminders'],
  ['debts', 'الديون', 'wallet', '#/debts'],
  ['datecalc', 'حاسبة التاريخ', 'grid', '#/datecalc'],
  ['tools', 'الأدوات', 'widget', '#/tools'],
  '',
  ['settings', 'الإعدادات', 'gear', '#/settings'],
];

// [pattern, tab, view(viewEl, ...params)]
const ROUTES = [
  [/^#\/home$/, 'home', (v) => home.render(v)],
  [/^#\/mine(?:\/([\w-]+))?$/, 'mine', (v, id) => adhkar.renderMine(v, id)],
  // A set of adhkar (morning, evening, sleep, or one of the day's occasions); an unknown one opens «أذكاري».
  [/^#\/adhkar(?:\/([\w-]+))?$/, 'mine', (v, id) => (CATEGORY_BY_ID[id] ? adhkar.renderWird(v, id) : adhkar.renderMine(v))],
  [/^#\/occasions$/, 'occasions', (v) => occasions.renderOccasions(v)],
  [/^#\/radio$/, 'radio', (v) => radioView.renderRadio(v)],
  [/^#\/tasbeeh(?:\/([\w-]+))?$/, 'tasbeeh', (v, id) => adhkar.renderTasbeeh(v, id)],
  [/^#\/worship$/, 'worship', (v) => worship.render(v)],
  [/^#\/tools$/, 'tools', (v) => tools.renderTools(v)],
  [/^#\/ahzab$/, 'tools', (v) => tools.renderAhzab(v)],
  [/^#\/qailulah$/, 'tools', (v) => tools.renderQailulah(v)],
  [/^#\/walk$/, 'tools', (v) => tools.renderWalk(v)],
  [/^#\/focus$/, 'tools', (v) => tools.renderFocus(v)],
  [/^#\/khatma$/, 'khatma', (v) => khatma.render(v)],
  [/^#\/debts$/, 'debts', (v) => debts.render(v)],
  [/^#\/datecalc$/, 'datecalc', (v) => datecalc.render(v)],
  [/^#\/rawatib$/, 'rawatib', (v) => rawatib.render(v)],
  [/^#\/reminders$/, 'reminders', (v) => reminders.render(v)],
  [/^#\/notebook(?:\/(notes|saved))?$/, 'mine', (v, tab) => notebook.render(v, tab)], // «saved» is an old link
  [/^#\/settings$/, 'settings', (v) => settings.render(v)],
  [/^#\/settings\/location$/, 'settings', (v) => settings.renderLocation(v)],
  [/^#\/settings\/method$/, 'settings', (v) => settings.renderMethod(v)],
  [/^#\/settings\/icon$/, 'settings', (v) => settings.renderIcon(v)],
  [/^#\/settings\/fonts$/, 'settings', (v) => settings.renderFonts(v)],
  [/^#\/settings\/notify$/, 'settings', (v) => settings.renderNotify(v)],
];

const view = $('#view');
let current = null;
let currentHash = '';

function route() {
  const hash = location.hash || '#/home';
  // Links to what the app no longer has (memorization, ruqyah, widget) open the home screen.
  if (/^#\/(quran|hifz|ruqyah|calendar(\/[\d-]+)?|surah\/\w+|qibla|settings\/widget)$/.test(hash)) {
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
  current = fn(view, ...m.slice(1)) || null;
  for (const a of document.querySelectorAll('#tabs a')) a.classList.toggle('on', a.dataset.tab === tab);
  document.body.dataset.tab = tab;
  renderMini();
  view.classList.remove('enter');
  void view.offsetWidth;
  view.classList.add('enter');
}

function renderTabs() {
  $('#tabs').innerHTML =
    `<div class="nav-head"><b>${APP_NAME}</b><button class="icon-btn ghost" data-nav aria-label="إغلاق القائمة">${icon('close', 22)}</button></div>` +
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

const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = state.settings.theme === 'dark' || (state.settings.theme === 'auto' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#070d1a' : '#0f2350');
  setDigits(state.settings.digits);
  const s = state.settings;
  document.documentElement.toggleAttribute('data-flat', !!s.flat);
  const root = document.documentElement.style;
  root.setProperty('--font-text', FONTS[s.fontText] || FONTS.tajawal);
  root.setProperty('--font-ui', FONTS[s.fontUi] || FONTS.tajawal);
  root.setProperty('--text-weight', s.textWeight || 500);
  root.setProperty('--ui-weight', s.uiWeight || 400);
  root.setProperty('--head-scale', s.headScale || 1);
}
media.addEventListener?.('change', applyTheme);

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
    <a href="#/radio" class="mini-info">${icon('radio', 20)}<span><b>${esc(station.name)}</b><small>${radioView.statusText(status)}</small></span></a>
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
});

setInterval(() => {
  checkReminders(); // also while hidden, for as long as the system keeps the app alive
  if (document.visibilityState !== 'visible') return;
  checkTimers();
  if (current?.tick?.() === 'rerender') route();
}, 1000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (current?.tick) route();
  checkForUpdate();
  checkTimers();
  checkReminders();
  // The screen lock is dropped when the app is hidden; take it again for a running timer.
  if (anyTimerRunning()) keepAwake(true);
});

registerServiceWorker();
persistStorage();
installHint();
document.documentElement.classList.add('ready');
