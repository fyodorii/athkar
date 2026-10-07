// "Now" at the chosen location: today's date, prayer times and the next prayer.

import { addDays, dateAt, dayKey, dayTimes, forbiddenTimes, prayerEnd, tzOffset } from './prayer.js';
import { hijri } from './dates.js';
import { state } from './store.js';

const FARD = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

let cache = { key: '', value: null };

function timesFor(day) {
  const s = state.settings;
  return dayTimes(day, s, hijri(day, s.hijriAdjust).month === 9);
}

export function today(now = new Date()) {
  const s = state.settings;
  const day = dateAt(s.location.tz, now);
  const key = dayKey(day) + JSON.stringify([s.location, s.method, s.asr, s.offsets, s.hijriAdjust]);
  if (cache.key !== key) {
    cache = { key, value: { day, key: dayKey(day), times: timesFor(day), tomorrow: timesFor(addDays(day, 1)) } };
  }
  const { times, tomorrow } = cache.value;
  const t = now.getTime();

  // Next and current fard prayer (with tomorrow's Fajr after Isha).
  const list = FARD.map((k) => times[k]);
  let next = list.find((p) => p.at > t) || tomorrow.fajr;
  let prev = [...list].reverse().find((p) => p.at <= t);
  if (!prev) prev = { ...times.isha, at: times.isha.at - 86400000 };
  const weekday = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
  const isFriday = weekday === 5;
  if (isFriday && next.key === 'dhuhr') next = { ...next, name: 'الجمعة' };

  // The prayer whose time is running now, and when it runs out (none between sunrise
  // and Dhuhr, or between the middle of the night and Fajr).
  let current = null;
  const yIsha = { ...times.isha, at: times.isha.at - 86400000 };
  const yMid = { ...times.midnight, at: times.midnight.at - 86400000 };
  if (t < times.fajr.at && t < yMid.at) current = { ...yIsha, end: yMid };
  else {
    const p = list.filter((x) => x.at <= t).pop();
    if (p) {
      const end = prayerEnd(times, p.key);
      if (t < end.at) current = { ...p, name: isFriday && p.key === 'dhuhr' ? 'الجمعة' : p.name, end };
    }
  }
  const forbidden = forbiddenTimes(times).find((f) => t >= f.from.at && t < f.to.at) || null;
  return { ...cache.value, next, prev, current, forbidden, weekday, isFriday };
}

// Current wall-clock time at the location as decimal hours (for the big clock).
export function hoursAt(now = new Date()) {
  const tz = tzOffset(state.settings.location.tz, now);
  const d = new Date(now.getTime() + tz * 3600000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() };
}
