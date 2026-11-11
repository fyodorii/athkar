// Everything the user keeps (settings, progress, custom adhkar, notebook) lives on
// the device in localStorage, saved after every change.

import { MY_ADHKAR } from './adhkar-data.js';
import { CITIES } from './cities.js';

const KEY = 'adhkar-app:v1';
const MAKKAH = CITIES[0];

export const DEFAULTS = {
  settings: {
    location: { name: MAKKAH.name, lat: MAKKAH.lat, lng: MAKKAH.lng, tz: MAKKAH.tz, source: 'default' },
    method: 'umm_al_qura',
    asr: 1,
    offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
    hijriAdjust: 0,
    clock24: false,
    digits: 'arab',
    theme: 'auto',
    textScale: 1,
    fontText: 'tajawal', // adhkar text: a key of FONTS in js/ui.js
    fontUi: 'tajawal', // interface
    textWeight: 500, // 200…900
    uiWeight: 400,
    headScale: 1, // size of the headings, 0.8…1.3
    flat: false, // flat design instead of liquid glass
    haptics: true,
    quranGoal: 5,
    appIcon: 'sky', // icons/alt/<name>.png for the home screen
    // Minutes between the adhan and the iqama.
    iqama: { fajr: 25, dhuhr: 20, asr: 20, maghrib: 10, isha: 20 },
    notify: {
      on: false,
      prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
      before: 0, // also remind this many minutes before the adhan (0 = no)
      iqama: false,
      duha: true,
      duhaEnd: false,
      lastThird: false,
      morning: true, // morning adhkar, after Fajr
      evening: true, // evening adhkar, after Asr
      khatma: '', // "HH:MM" of the daily wird reminder, or '' for none
      debts: true,
      sound: true,
    },
  },
  progress: { day: '', counts: {} },
  custom: [],
  notebook: [],
  saved: [],
  tasbeeh: { phrase: 'سبحان الله وبحمده', target: 33, count: 0, total: 0, day: '', today: 0, list: null, fontSize: 40, counterSize: 1, bg: 'blue', ink: '', dim: 0, alerts: [33, 100, 150], alertSound: true, alertVibrate: true },
  radio: { station: 'saudi', custom: '' },
  seeded: 0,
  worship: {},
  worshipCustom: [],
  diary: {},
  migrated: {}, // one-time data changes done
  tools: { ahzab: { start: '', done: {} }, nap: 20, napEnd: 0, walk: null, focus: { minutes: 10, task: '', count: 0, total: 0, end: 0 } },
  // The khatma: `pos` is the page to read next (1…605), `read` the furthest page reached.
  khatma: { pos: 1, read: 0, startedAt: 0, history: [] },
  // { id, dir: 'owe' | 'lent', person, amount, date, due, remind, note, paid, paidAt }
  debts: [],
  // Groups of the tasbeeh: adhkar counted one after another, each to its number; `i` and
  // `count` are where the group has reached.
  groups: [{ id: 'daily', name: 'برنامج يومي', i: 0, count: 0, items: [0, 6, 3, 7].map((n) => ({ text: MY_ADHKAR[n].replace(/\.$/, ''), target: 1000 })) }],
  reminders: [], // «تذكيراتي»: { id, text, time: "HH:MM", on }, every day
  notifyLog: {}, // reminders already shown: { "<day>:<event>": time }
  sync: { hash: '', at: 0 },
};

// A copy of the defaults, so the state never shares objects with DEFAULTS.
const fresh = () => JSON.parse(JSON.stringify(DEFAULTS));

function merge(base, value) {
  if (Array.isArray(base)) return Array.isArray(value) ? value : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (value && typeof value === 'object') {
      for (const k of Object.keys(value)) out[k] = k in base ? merge(base[k], value[k]) : value[k];
    }
    return out;
  }
  return value === undefined || value === null ? base : value;
}

// Data of features the app no longer has (memorization, the qibla, al-Mulk) is dropped when
// loading, so old saves and backups stay light; a khatma kept by an old release is started afresh.
function prune(data) {
  for (const k of ['hifz', 'surahs']) delete data[k];
  const s = data.settings;
  if (s) for (const k of ['prayerLayout', 'mushafMode', 'mushafInk', 'quranScale', 'textBold', 'uiBold']) delete s[k];
  const k = data.khatma;
  if (!k || typeof k.pos !== 'number' || typeof k.read !== 'number' || !Array.isArray(k.history)) data.khatma = fresh().khatma;
  return data;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return prune(merge(fresh(), raw ? JSON.parse(raw) : {}));
  } catch (e) {
    return merge(fresh(), {});
  }
}

export const state = load();

// Adhkar every new user starts with in "my adhkar"; existing users get them once.
const SEED_VERSION = 1;
const SEED = MY_ADHKAR.map((text) => ({ text, target: 100 }));
// The tasbeeh shows them without the closing full stop.
const PHRASES = MY_ADHKAR.map((x) => x.replace(/\.$/, ''));
// Istighfar was a «مائة مرة» checkbox (1) and is now a count: a ticked past day counts as 100.
if (!state.migrated.istighfar) {
  for (const day of Object.values(state.worship)) if (day && day.istighfar === 1) day.istighfar = 100;
  state.migrated.istighfar = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    /* private mode: nothing kept */
  }
}

// Release 19: Tajawal is the font, the look is blue.
if (!state.migrated.blue) {
  const s = state.settings;
  s.fontUi = s.fontText = 'tajawal';
  if (s.appIcon === 'emerald') s.appIcon = 'sky';
  if (state.tasbeeh.bg === 'emerald') state.tasbeeh.bg = 'blue';
  state.migrated.blue = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    /* private mode: nothing kept */
  }
}

if (state.seeded < SEED_VERSION) {
  const have = new Set(state.custom.map((c) => c.text));
  const now = Date.now();
  SEED.forEach((x, i) => {
    if (!have.has(x.text)) state.custom.push({ id: `seed${i + 1}`, today: 0, total: 0, created: now, ...x });
  });
  state.seeded = SEED_VERSION;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // Storage blocked: the seed shows again next time, which is harmless.
  }
}
// Release 21: «أذكاري الخاصة» and the tasbeeh keep only the user's eight adhkar (counts of the
// ones already there stay).
if (!state.migrated.mine3) {
  const now = Date.now();
  state.custom = SEED.map((x, i) => state.custom.find((c) => c.text === x.text) || { id: `my${i + 1}`, today: 0, total: 0, created: now, ...x });
  const t = state.tasbeeh;
  t.list = [...PHRASES];
  if (!t.list.includes(t.phrase)) Object.assign(t, { phrase: t.list[0], count: 0 });
  state.migrated.mine3 = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    /* private mode: nothing kept */
  }
}

const listeners = new Set();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // Storage full or blocked (private mode): keep working in memory.
  }
  for (const fn of listeners) fn();
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Ask the browser not to clear the app's data under storage pressure.
export function persistStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

// ---- Daily counters ----

// Starts the daily counters afresh on a new day.
export function newDay(dayKey) {
  if (state.progress.day === dayKey) return;
  state.progress = { day: dayKey, counts: {} };
  for (const c of state.custom) c.today = 0;
}

// ---- Notebook bookmarks ----
// Each bookmark keeps its own text, so it survives changes to where it came from:
// { id, text, title, ref, quran (Uthmani script), at }.

export const isSaved = (id) => state.saved.some((s) => s.id === id);

export function toggleSaved(item) {
  const i = state.saved.findIndex((s) => s.id === item.id);
  if (i >= 0) state.saved.splice(i, 1);
  else state.saved.unshift({ id: item.id, text: item.text, title: item.title || '', ref: item.ref || '', quran: !!item.quran, at: Date.now() });
  save();
  return i < 0;
}

// ---- Backup ----

export function exportData() {
  const { sync, ...rest } = state;
  return JSON.stringify({ app: 'adhkar', version: 1, exportedAt: new Date().toISOString(), ...rest }, null, 2);
}

export function importData(text) {
  const data = JSON.parse(text);
  if (!data || data.app !== 'adhkar') throw new Error('ليس ملف نسخة احتياطية من التطبيق');
  const merged = prune(merge(fresh(), data));
  for (const k of Object.keys(DEFAULTS)) state[k] = merged[k];
  state.sync = { hash: '', at: 0 };
  save();
}
