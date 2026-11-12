// A khatma: a range of the mushaf read over a number of days, with a daily wird.
// { id, name, color, from, to, pos, read, span, week, remind, startedAt }: `from`…`to` are its
// pages, `pos` the page to read next, `read` the furthest page reached, `span` the days it is
// planned over, `week` the weekdays of reading (0 = Sunday), `remind` "HH:MM" or ''.

import { JUZ, PAGES } from './quran-data.js';

export const KHATMA_COLORS = { teal: '#2f9e8f', red: '#e0483c', brown: '#7a6652', orange: '#f0a23b', blue: '#3f8ef0' };
export const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

// The juz (1…30) a page is in.
export const juzOf = (page) => {
  let j = 0;
  while (j < 29 && JUZ[j + 1] <= page) j++;
  return j + 1;
};

// Where a khatma stands, with defaults for one made before ranges and plans.
export function khatmaInfo(k) {
  const from = Math.max(1, Math.min(PAGES, k.from || 1));
  const to = Math.max(from, Math.min(PAGES, k.to || PAGES));
  const total = to - from + 1;
  const read = Math.max(0, Math.min(total, (k.read || 0) - from + 1)); // pages of the range read
  const done = read >= total;
  const pos = Math.max(from, Math.min(to, k.pos || from));
  const span = Math.max(1, k.span || 30);
  const per = Math.max(1, Math.ceil(total / span)); // pages of a day's wird
  const week = Array.isArray(k.week) && k.week.length ? k.week : ALL_WEEK;
  // A range of whole juz read over days that divide them is read by the juz (their pages
  // differ a little), as in the mushaf: `juzPer` juz a day, each wird ending with a juz.
  const juzEnd = (j) => (JUZ[j] || PAGES + 1) - 1;
  const [ja, jb] = [juzOf(from), juzOf(to)];
  const whole = JUZ[ja - 1] === from && juzEnd(jb) === to && (jb - ja + 1) % span === 0;
  const juzPer = whole ? (jb - ja + 1) / span : 0;
  const wirdTo = juzPer ? juzEnd(Math.min(jb, juzOf(pos) + juzPer - 1)) : Math.min(to, pos + per - 1);
  const left = juzPer ? Math.ceil((jb - juzOf(pos) + 1) / juzPer) : Math.ceil((total - read) / per);
  return { from, to, total, read, done, pos, span, per, juzPer, week, wirdTo, left: done ? 0 : left, color: KHATMA_COLORS[k.color] || KHATMA_COLORS.blue };
}
