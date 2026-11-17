// When each prayer's time runs out (حديث عبد الله بن عمرو في صحيح مسلم): Fajr at sunrise, Dhuhr when
// Asr comes, Asr's chosen time when the sun yellows (and its time of need at sunset), Maghrib when
// the twilight is gone, Isha at the middle of the night.

import { state } from './store.js';

// The five windows of a day.
export function windows(t) {
  const hanafi = state.settings.asr === 2; // Asr begins at twice the shadow: its chosen end is not that
  const yellow = !hanafi && t.yellow.at > t.asr.at && t.yellow.at < t.maghrib.at ? t.yellow : null;
  const shafaq = t.shafaq.at > t.maghrib.at ? t.shafaq : t.isha;
  return [
    { key: 'fajr', name: t.fajr.name, start: t.fajr, end: t.sunrise, endText: 'طلوع الشمس' },
    { key: 'dhuhr', name: t.dhuhr.name, start: t.dhuhr, end: t.asr, endText: 'دخول وقت العصر' },
    yellow
      ? { key: 'asr', name: t.asr.name, start: t.asr, end: yellow, endText: 'اصفرار الشمس', last: t.maghrib, lastText: 'غروب الشمس' }
      : { key: 'asr', name: t.asr.name, start: t.asr, end: t.maghrib, endText: 'غروب الشمس' },
    { key: 'maghrib', name: t.maghrib.name, start: t.maghrib, end: shafaq, endText: 'غياب الشفق الأحمر' },
    { key: 'isha', name: t.isha.name, start: t.isha, end: t.midnight, endText: 'منتصف الليل' },
  ];
}

// The prayer whose time it is now and when it runs out: { w, at, need } (need = the time of need).
export function endNow(info, now = Date.now()) {
  const all = [...windows(info.yesterday), ...windows(info.times)];
  const w = [...all].reverse().find((x) => x.start.at <= now);
  if (!w) return null;
  if (now < w.end.at) return { w, at: w.end.at, need: false };
  if (w.last && now < w.last.at) return { w, at: w.last.at, need: true };
  return null;
}
