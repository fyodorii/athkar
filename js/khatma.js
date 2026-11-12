// A khatma: a range of the mushaf read over a number of days, with a daily wird.
// { id, name, color, from, to, pos, read, span, week, remind, startedAt, createdAt }: `from`…`to` are its
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
  // The current wird: its number (from 1) and its pages, fixed by the plan so that a place
  // marked inside it shows as progress through it.
  const no = done ? Math.ceil(juzPer ? (jb - ja + 1) / juzPer : total / per) : juzPer ? Math.floor((juzOf(pos) - ja) / juzPer) + 1 : Math.floor((pos - from) / per) + 1;
  const wirdFrom = juzPer ? JUZ[ja + (no - 1) * juzPer - 1] : from + (no - 1) * per;
  const wirdTo = juzPer ? juzEnd(Math.min(jb, ja + no * juzPer - 1)) : Math.min(to, wirdFrom + per - 1);
  const wirds = Math.ceil(juzPer ? (jb - ja + 1) / juzPer : total / per);
  return { from, to, total, read, done, pos, span, per, juzPer, week, no, wirds, wirdFrom, wirdTo, color: KHATMA_COLORS[k.color] || KHATMA_COLORS.blue };
}

// How the reading stands against the plan: wirds done beyond (+) or short of (−) the reading
// days that have passed since the khatma was made (today's is not yet owed).
export function commitment(k, dayNow = Date.now()) {
  const i = khatmaInfo(k);
  const doneWirds = i.done ? i.wirds : i.no - 1;
  let due = 0;
  const start = new Date(k.createdAt || dayNow);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dayNow);
  end.setHours(0, 0, 0, 0);
  for (const d = new Date(start); d < end && due < i.wirds; d.setDate(d.getDate() + 1)) if (i.week.includes(d.getDay())) due++;
  return doneWirds - due;
}
