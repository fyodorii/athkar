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
  tasbeeh: { phrase: 'سبحان الله وبحمده', target: 33, count: 0, total: 0, day: '', today: 0, list: null, fontSize: 40, counterSize: 1, bg: 'blue', ink: '', dim: 0, alerts: [33, 100, 150], alertSound: true, alertVibrate: true },
  radio: { station: 'saudi', custom: '' },
  seeded: 0,
  worship: {},
  worshipCustom: [],
  diary: {},
  migrated: {}, // one-time data changes done
  tools: { ahzab: { start: '', done: {} }, nap: 20, napEnd: 0, walk: null, focus: { minutes: 10, task: '', count: 0, total: 0, end: 0 } },
  // Khatmas, each { id, name, pos, read, startedAt }: `pos` is the page to read next (1…605),
  // `read` the furthest page reached. `khatmaLog` keeps the finished and restarted ones.
  khatmas: [],
  khatmaLog: [],
  notes: [], // «ملاحظاتي»: { id, title, text, pinned, created, updated }
  // { id, dir: 'owe' | 'lent', person, amount, date, due, remind, note, paid, paidAt }
  debts: [],
  // Groups of the tasbeeh: adhkar counted one after another, each to its number; `i` and
  // `count` are where the group has reached.
  groups: [{ id: 'daily', name: 'برنامج يومي', i: 0, count: 0, items: [0, 6, 3, 7].map((n) => ({ text: MY_ADHKAR[n], target: 1000 })) }],
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
// loading, so old saves and backups stay light.
function prune(data) {
  for (const k of ['hifz', 'surahs', 'saved']) delete data[k];
  const s = data.settings;
  if (s) for (const k of ['prayerLayout', 'mushafMode', 'mushafInk', 'quranScale', 'textBold', 'uiBold']) delete s[k];
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
  state.custom = SEED.map((x, i) => state.custom.find((c) => c.text.replace(/\s*\.$/, '') === x.text) || { id: `my${i + 1}`, today: 0, total: 0, created: now, ...x });
  const t = state.tasbeeh;
  t.list = [...MY_ADHKAR];
  if (!t.list.includes(t.phrase)) Object.assign(t, { phrase: t.list[0], count: 0 });
  state.migrated.mine3 = true;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    /* private mode: nothing kept */
  }
}

// Release 22: the adhkar of «أذكاري» and the tasbeeh lose their closing full stop; the one
// khatma becomes the first of a list.
if (!state.migrated.r22) {
  const strip = (x) => (typeof x === 'string' ? x.replace(/\s*\.$/, '') : x);
  for (const c of state.custom) c.text = strip(c.text);
  const t = state.tasbeeh;
  t.phrase = strip(t.phrase);
  if (Array.isArray(t.list)) t.list = [...new Set(t.list.map(strip))];
  for (const g of state.groups) for (const x of g.items) x.text = strip(x.text);
  const k = state.khatma;
  const ok = k && typeof k.pos === 'number' && typeof k.read === 'number';
  if (!state.khatmas.length) state.khatmas.push({ id: 'k1', name: 'ختمتي', pos: ok ? k.pos : 1, read: ok ? k.read : 0, startedAt: (ok && k.startedAt) || 0 });
  if (ok && Array.isArray(k.history)) state.khatmaLog.push(...k.history.map((h) => ({ name: 'ختمتي', ...h })));
  delete state.khatma;
  state.migrated.r22 = true;
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

// The khatma shown on the home screen and named in the daily reminder: the first one.
export const firstKhatma = () => state.khatmas[0] || { name: 'ختمتي', pos: 1, read: 0 };

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
  // A backup from before release 22 carries one khatma.
  const old = merged.khatma;
  if (!state.khatmas.length) state.khatmas.push({ id: 'k1', name: 'ختمتي', pos: old?.pos > 0 ? old.pos : 1, read: old?.read > 0 ? old.read : 0, startedAt: old?.startedAt || 0 });
  state.sync = { hash: '', at: 0 };
  save();
}
