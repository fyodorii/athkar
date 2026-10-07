// "Now" at the chosen location: today's date, prayer times and the next prayer.

import { addDays, dateAt, dayKey, dayTimes, tzOffset } from './prayer.js';
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
  return { ...cache.value, next, prev, weekday, isFriday };
}

// Current wall-clock time at the location as decimal hours (for the big clock).
export function hoursAt(now = new Date()) {
  const tz = tzOffset(state.settings.location.tz, now);
  const d = new Date(now.getTime() + tz * 3600000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() };
}

// Which adhkar suit this moment, for the home screen suggestion.
export function adhkarNow(info, now = Date.now()) {
  const { times } = info;
  if (now >= times.fajr.at && now < times.dhuhr.at) return 'morning';
  if (now >= times.asr.at && now < times.isha.at) return 'evening';
  if (now >= times.isha.at || now < times.fajr.at) return 'sleep';
  return 'prayer';
}
