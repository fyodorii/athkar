// Everything the user keeps (settings, progress, custom adhkar, notebook) lives on
// the device in localStorage, saved after every change.

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
    haptics: true,
    quranGoal: 5,
    notify: {
      enabled: false,
      prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
      sunrise: false,
      before: 10,
      morning: true,
      morningDelay: 30,
      evening: true,
      eveningDelay: 30,
      sleep: false,
      sleepTime: '22:30',
      lastThird: false,
      friday: true,
      fasting: false,
      whiteDays: false,
      salawat: false,
      salawatHours: 3,
      worship: false,
      afterAdhan: 0,
      duha: false,
      duhaDelay: 30,
      midnight: false,
      prayerEnd: 0,
      nahy: false,
      kahf: true,
      kahfTime: '09:00',
      mulk: false,
      mulkTime: '21:45',
      baqarah: 0,
      baqarahTime: '17:00',
      khatma: false,
      khatmaTime: '05:30',
    },
  },
  progress: { day: '', counts: {} },
  custom: [],
  notebook: [],
  saved: [],
  tasbeeh: { phrase: 'سبحان الله', target: 33, count: 0, total: 0, day: '', today: 0, list: null, fontSize: 40 },
  khatma: { page: 0, days: 30, start: '', done: 0, log: {} },
  radio: { station: 'saudi', custom: '' },
  seeded: 0,
  worship: {},
  worshipCustom: [],
  diary: {},
  sync: { hash: '', at: 0 },
};

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

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return merge(DEFAULTS, raw ? JSON.parse(raw) : {});
  } catch (e) {
    return merge(DEFAULTS, {});
  }
}

export const state = load();

// Adhkar every new user starts with in "my adhkar"; existing users get them once.
const SEED_VERSION = 1;
const SEED = [
  { text: 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير.', target: 100, ref: 'رواه البخاري ومسلم' },
  { text: 'لا حول ولا قوة إلا بالله.', target: 100, ref: '«كنز من كنوز الجنة» — متفق عليه' },
  {
    text: 'اللهم صل على محمد وعلى آل محمد، كما صليت على إبراهيم وعلى آل إبراهيم، إنك حميد مجيد. اللهم بارك على محمد وعلى آل محمد، كما باركت على إبراهيم وعلى آل إبراهيم، إنك حميد مجيد.',
    target: 10,
    ref: 'رواه البخاري',
  },
];
if (state.seeded < SEED_VERSION) {
  const have = new Set(state.custom.map((c) => c.text));
  const now = Date.now();
  SEED.forEach((x, i) => {
    if (!have.has(x.text)) state.custom.push({ id: `seed${i + 1}`, reminder: '', today: 0, total: 0, created: now, ...x });
  });
  state.seeded = SEED_VERSION;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    // Storage blocked: the seed shows again next time, which is harmless.
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
  const merged = merge(DEFAULTS, data);
  for (const k of Object.keys(DEFAULTS)) state[k] = merged[k];
  state.sync = { hash: '', at: 0 };
  save();
}
