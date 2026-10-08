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
    // Minutes from the adhan to the iqama.
    iqama: { fajr: 25, dhuhr: 20, asr: 20, maghrib: 10, isha: 20 },
    hijriAdjust: 0,
    clock24: false,
    digits: 'arab',
    theme: 'auto',
    textScale: 1,
    fontText: 'amiri', // adhkar text: amiri | plex | tajawal
    fontUi: 'plex', // interface: plex | tajawal | amiri
    textBold: true,
    uiBold: false,
    haptics: true,
    quranGoal: 5,
    prayerLayout: 'list', // list | grid (the prayer times on the home screen)
    appIcon: 'emerald', // icons/alt/<name>.png for the home screen
    mushafMode: 'pages', // al-Kahf, al-Mulk, al-Baqarah: the mushaf's pages | continuous text
    mushafInk: 'blue', // blue | black
    notify: {
      enabled: false,
      prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
      // Minutes before each adhan for a heads-up (0 = only at the adhan); unset → `before`.
      beforeBy: {},
      iqama: true,
      sunrise: false,
      sunriseBefore: 0, // minutes before sunrise (0 = at sunrise), to catch Fajr in time
      fajrInfo: false, // at a set hour (say 11 pm): when the coming Fajr and sunrise are
      fajrInfoTime: '23:00',
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
      fastingTime: '21:00',
      whiteDays: false,
      whiteDaysTime: '21:00',
      occasions: false, // the evening before Ramadan, Arafah, Ashura and the other occasions
      occasionsTime: '21:00',
      salawat: false,
      salawatHours: 3,
      worship: false,
      afterAdhan: 0,
      duha: false,
      duhaDelay: 30,
      midnight: false,
      prayerEnd: 0,
      nahy: false,
      qailulah: false,
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
  tasbeeh: { phrase: 'سبحان الله', target: 33, count: 0, total: 0, day: '', today: 0, list: null, fontSize: 40, counterSize: 1, bg: 'emerald', ink: '', dim: 0 },
  khatma: { page: 0, days: 30, start: '', done: 0, log: {} },
  radio: { station: 'saudi', custom: '' },
  seeded: 0,
  worship: {},
  worshipCustom: [],
  diary: {},
  hifz: { on: false, day: 1, checks: {} },
  migrated: {}, // one-time data changes done
  surahs: {}, // kahf | mulk | baqarah → { ayah: where reading stopped, done: day finished }
  tools: { nap: 20, napEnd: 0, walk: null, focus: { minutes: 10, task: '', count: 0, total: 0, end: 0 } },
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

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return merge(fresh(), raw ? JSON.parse(raw) : {});
  } catch (e) {
    return merge(fresh(), {});
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
  const merged = merge(fresh(), data);
  for (const k of Object.keys(DEFAULTS)) state[k] = merged[k];
  state.sync = { hash: '', at: 0 };
  save();
}
