// "Now" at the chosen location: today's date, the day's times and the next moment among the
// ones the app shows (the five prayers, sunrise, Duha, the middle of the night and its last third).

import { addDays, dateAt, dayKey, dayTimes, tzOffset } from './prayer.js';
import { hijri } from './dates.js';
import { state } from './store.js';

// The moments of a night and a morning that the app counts down to.
export const MOMENTS = ['sunrise', 'duha', 'midnight', 'lastThird'];
export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

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
    cache = { key, value: { day, key: dayKey(day), times: timesFor(day), tomorrow: timesFor(addDays(day, 1)), yesterday: timesFor(addDays(day, -1)) } };
  }
  const { times, tomorrow, yesterday } = cache.value;
  const t = now.getTime();
  const weekday = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();

  // Before Fajr the night still running is yesterday's: its middle and last third.
  const night = t < times.fajr.at ? yesterday : times;
  const timeline = [
    night.midnight,
    night.lastThird,
    ...PRAYERS.map((k) => times[k]),
    times.sunrise,
    times.duha,
    times.midnight,
    times.lastThird,
    tomorrow.fajr,
    tomorrow.sunrise,
    tomorrow.duha,
  ].sort((a, b) => a.at - b.at);
  const next = timeline.find((x) => x.at > t) || tomorrow.duha;
  const prev = [...timeline].reverse().find((x) => x.at <= t) || { ...yesterday.lastThird };

  // The prayer whose time it is now (Isha runs until Fajr), and the next one.
  const prayers = [yesterday.isha, ...PRAYERS.map((k) => times[k]), tomorrow.fajr];
  const nextPrayer = prayers.find((x) => x.at > t) || tomorrow.fajr;
  const lastPrayer = [...prayers].reverse().find((x) => x.at <= t) || yesterday.isha;

  return {
    ...cache.value,
    next,
    prev,
    nextPrayer,
    lastPrayer,
    adhan: adhanNow(lastPrayer, t),
    weekday,
    isFriday: weekday === 5,
    period: periodNow(times, night, t),
  };
}

// Around a prayer: the minutes since its adhan and until its iqama, for the first hour.
function adhanNow(prayer, t) {
  const since = Math.floor((t - prayer.at) / 60000);
  if (since < 0 || since >= 60) return null;
  const wait = state.settings.iqama?.[prayer.key] ?? 0;
  return { key: prayer.key, name: prayer.name, since, iqamaIn: wait ? wait - since : null };
}

// What kind of time it is: sunrise, Duha, the afternoon or a part of the night.
function periodNow(times, night, t) {
  const qiyam = { key: 'qiyam', title: 'الثلث الأخير من الليل', sub: 'وقت النزول والاستجابة — قيام ودعاء واستغفار' };
  const after = { key: 'midnight', title: 'بعد منتصف الليل', sub: 'وقت الوتر والقيام، فاجعل آخر صلاتك وتراً' };
  if (t < times.fajr.at) {
    if (t >= night.lastThird.at) return qiyam;
    if (t >= night.midnight.at) return after;
    return { key: 'night', title: 'أول الليل', sub: 'وقت مفتوح للنوافل والأذكار قبل النوم' };
  }
  if (t >= times.sunrise.at && t < times.duha.at) return { key: 'sunrise', title: 'وقت الشروق', sub: 'انتظر حتى ترتفع الشمس قيد رمح، ثم صلِّ الضحى' };
  if (t >= times.duha.at && t < times.duhaEnd.at) return { key: 'duha', title: 'وقت الضحى', sub: 'ركعتان فأكثر، تجزئان عن صدقة كل مفاصلك' };
  if (t >= times.duhaEnd.at && t < times.dhuhr.at) return { key: 'zawal', title: 'وقت النهي قبل الظهر', sub: 'قامت الشمس، فأمسك عن النافلة حتى يدخل الظهر' };
  if (t >= times.lastThird.at) return qiyam;
  if (t >= times.midnight.at) return after;
  if (t >= times.maghrib.at) return { key: 'night', title: 'أول الليل', sub: 'وقت مفتوح للنوافل والأذكار قبل النوم' };
  return { key: 'day', title: 'النهار', sub: 'وقت للعمل والذكر وما تيسّر من النوافل' };
}

// Current wall-clock time at the location as decimal hours (for the big clock).
export function hoursAt(now = new Date()) {
  const tz = tzOffset(state.settings.location.tz, now);
  const d = new Date(now.getTime() + tz * 3600000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() };
}
