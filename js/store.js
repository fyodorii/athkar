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
    },
  },
  progress: { day: '', counts: {} },
  custom: [],
  notebook: [],
  saved: [],
  tasbeeh: { phrase: 'سبحان الله', target: 33, count: 0, total: 0, day: '', today: 0, phrases: [] },
  worship: {},
  worshipCustom: [],
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

// ---- Daily progress through the adhkar ----

export function todayCounts(dayKey) {
  if (state.progress.day !== dayKey) {
    state.progress = { day: dayKey, counts: {} };
    for (const c of state.custom) c.today = 0;
  }
  return state.progress.counts;
}

// ---- Notebook bookmarks of library adhkar ----

export const isSaved = (id) => state.saved.some((s) => s.id === id);

export function toggleSaved(id) {
  const i = state.saved.findIndex((s) => s.id === id);
  if (i >= 0) state.saved.splice(i, 1);
  else state.saved.unshift({ id, at: Date.now() });
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
