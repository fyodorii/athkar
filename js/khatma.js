// Khatma plan: where the reader is in the mushaf, how many days they want the
// khatma to take, and so how many pages today's portion (wird) is.
// state.khatma = { page: last page read (0 = not started), days, start: 'YYYY-MM-DD',
//                  done: khatmas completed, log: { 'YYYY-MM-DD': pages read },
//                  mode: 'pages' (equal pages a day) | 'sahaba' (the Companions' seven ahzab) }

import { addDays, dayKey } from './prayer.js';
import { PAGES, pageInfo, SURAHS } from './quran-data.js';
import { state } from './store.js';

export const PLANS = [
  [3, 'ثلاثة أيام'],
  [7, 'أسبوع'],
  [10, 'عشرة أيام'],
  [15, 'نصف شهر'],
  [20, 'عشرون يوماً'],
  [30, 'شهر (جزء يومياً)'],
  [40, 'أربعون يوماً'],
  [60, 'شهران'],
  [90, 'ثلاثة أشهر'],
  [180, 'ستة أشهر'],
  [365, 'سنة'],
];

// The Companions' division of the Quran into seven ahzab, one a day for a weekly
// khatma (Aws ibn Hudhayfa, in Abu Dawud and Ibn Majah): 3, 5, 7, 9, 11 and 13 surahs
// after al-Fatiha, then al-Mufassal — remembered as «فمي بشوق».
const AHZAB_FIRST = [1, 5, 10, 17, 26, 37, 50];
export const AHZAB = AHZAB_FIRST.map((first, i) => {
  const next = AHZAB_FIRST[i + 1];
  const last = next ? next - 1 : 114;
  return {
    n: i + 1,
    first,
    last,
    from: SURAHS[first - 1][1],
    // A surah boundary falls mid-page, so the page a hizb ends on is also where the next begins.
    to: next ? SURAHS[next - 1][1] : PAGES,
    name: `من ${SURAHS[first - 1][0]} إلى ${SURAHS[last - 1][0]}`,
  };
});

const isSahaba = (k) => k.mode === 'sahaba';

// The hizb scheduled for `day` (by days since the start), 0–6.
export function hizbIndex(k, day) {
  if (!k.start) return 0;
  return Math.max(0, Math.min(6, dayNum(day) - dayNum(toDay(k.start))));
}

const toDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
};
const dayNum = ({ y, m, d }) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);

export function endDay(k) {
  return addDays(toDay(k.start), k.days - 1);
}

// Days left including today (at least 1, even past the planned end).
export function daysLeft(k, day) {
  if (!k.start) return k.days;
  return Math.max(1, dayNum(endDay(k)) - dayNum(day) + 1);
}

// Pages to read on `day` to finish on time, counting what was already read that day.
export function dailyPages(k, day) {
  if (isSahaba(k)) {
    const h = AHZAB[hizbIndex(k, day)];
    return h.to - h.from + 1;
  }
  const readToday = k.log?.[dayKey(day)] || 0;
  const remaining = PAGES - k.page + readToday;
  return Math.max(1, Math.ceil(remaining / daysLeft(k, day)));
}

// Today's portion as a page range, and how much of it is read.
export function todayPortion(k, day) {
  const readToday = k.log?.[dayKey(day)] || 0;
  if (isSahaba(k)) {
    const h = AHZAB[hizbIndex(k, day)];
    const done = k.page >= h.to;
    return { from: h.from, to: h.to, size: h.to - h.from + 1, read: readToday, done, hizb: h, fromInfo: pageInfo(h.from), toInfo: pageInfo(h.to) };
  }
  const size = dailyPages(k, day);
  const from = k.page - readToday + 1;
  const to = Math.min(PAGES, from + size - 1);
  return { from, to, size, read: readToday, done: readToday >= size || k.page >= PAGES, fromInfo: pageInfo(from), toInfo: pageInfo(to) };
}

// Pages ahead (+) or behind (−) the plan as of the end of `day`.
export function paceDiff(k, day) {
  if (!k.start) return 0;
  if (isSahaba(k)) return k.page - AHZAB[hizbIndex(k, day)].to;
  const elapsed = Math.min(k.days, dayNum(day) - dayNum(toDay(k.start)) + 1);
  return k.page - Math.round((PAGES * elapsed) / k.days);
}

export function startPlan(days, page = 0, day, mode = 'pages') {
  const k = state.khatma;
  k.mode = mode;
  k.days = mode === 'sahaba' ? 7 : days;
  k.page = Math.max(0, Math.min(PAGES, page));
  k.start = dayKey(day);
  k.log = {};
}

// Records reading up to `page` (also counted in the worship tracker's Quran pages).
// Returns true when this completes the khatma.
export function readTo(page, day) {
  const k = state.khatma;
  const key = dayKey(day);
  const to = Math.max(0, Math.min(PAGES, page));
  const n = to - k.page;
  if (!k.start) k.start = key;
  k.page = to;
  k.log[key] = Math.max(0, (k.log[key] || 0) + n);
  const w = (state.worship[key] ??= {});
  w.quran = Math.max(0, (w.quran || 0) + n);
  if (n > 0 && to >= PAGES) {
    k.done = (k.done || 0) + 1;
    return true;
  }
  return false;
}
