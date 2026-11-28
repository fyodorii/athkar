// When each prayer's time runs out (حديث عبد الله بن عمرو في صحيح مسلم), split as the scholars split
// it (فتاوى اللجنة الدائمة ٦/ ١١٥): a chosen time (وقت الاختيار), and for Asr and Isha a time of need
// after it (وقت الضرورة), still in time but not to be delayed to without an excuse. Fajr runs to
// sunrise, Dhuhr to Asr and Maghrib to the twilight's end, with no time of need; Asr's chosen time to
// the shadow twice the thing's length (زاد المستقنع؛ and in another narration the yellowing of the sun,
// which mostly comes later and is not computed), then need to sunset; Isha's to the middle of the
// night, then need to Fajr.

import { state } from './store.js';

// The five windows of a day; `next` is the next day's times (Isha's time of need runs to its Fajr).
// Each has start and end (the end of its chosen time), and either `one` (a single time, no time of
// need) or `last` (the end of its time of need). Isha also has `third`, the end of its chosen time in
// the Hanbali school.
export function windows(t, next) {
  const hanafi = state.settings.asr === 2; // Asr begins at twice the shadow: its chosen end is not that
  const yellow = !hanafi && t.yellow.at > t.asr.at && t.yellow.at < t.maghrib.at ? t.yellow : null;
  const shafaq = t.shafaq.at > t.maghrib.at ? t.shafaq : t.isha;
  const dawn = next && next.fajr.at > t.midnight.at ? next.fajr : null;
  const third = t.firstThird && t.firstThird.at > t.isha.at && t.firstThird.at < t.midnight.at ? t.firstThird : null;
  return [
    { key: 'fajr', name: t.fajr.name, start: t.fajr, end: t.sunrise, endText: 'طلوع الشمس', one: true },
    { key: 'dhuhr', name: t.dhuhr.name, start: t.dhuhr, end: t.asr, endText: 'دخول وقت العصر', one: true },
    yellow
      ? { key: 'asr', name: t.asr.name, start: t.asr, end: yellow, endText: 'مصير ظل الشيء مثليه', last: t.maghrib, lastText: 'غروب الشمس' }
      : { key: 'asr', name: t.asr.name, start: t.asr, end: t.maghrib, endText: 'غروب الشمس' },
    { key: 'maghrib', name: t.maghrib.name, start: t.maghrib, end: shafaq, endText: 'غياب الشفق الأحمر', one: true },
    { key: 'isha', name: t.isha.name, start: t.isha, end: t.midnight, endText: 'منتصف الليل', third, ...(dawn ? { last: dawn, lastText: 'طلوع الفجر' } : {}) },
  ];
}

// The prayer whose time it is now and when that part of it runs out: { w, at, need } (need = the
// time of need).
export function endNow(info, now = Date.now()) {
  const all = [...windows(info.yesterday, info.times), ...windows(info.times, info.tomorrow)];
  const w = [...all].reverse().find((x) => x.start.at <= now);
  if (!w) return null;
  if (now < w.end.at) return { w, at: w.end.at, need: false };
  if (w.last && now < w.last.at) return { w, at: w.last.at, need: true };
  return null;
}

// "العصر" → "للعصر".
const li = (name) => (name.startsWith('ال') ? `ل${name.slice(1)}` : `ل${name}`);

// What runs out next, in a line: «باقي على خروج وقت الظهر», «باقي على خروج وقت الاختيار للعصر»,
// «وقت الضرورة للعصر، باقي على غروب الشمس».
export function endLabel(e) {
  if (e.need) return `وقت الضرورة ${li(e.w.name)}، باقي على ${e.w.lastText}`;
  return e.w.last ? `باقي على خروج وقت الاختيار ${li(e.w.name)}` : `باقي على خروج وقت ${e.w.name}`;
}

// How far through its whole time (chosen and of need) a window is, in percent.
export function progress(w, now = Date.now()) {
  const end = (w.last || w.end).at;
  return Math.min(100, Math.max(0, ((now - w.start.at) / (end - w.start.at)) * 100));
}
