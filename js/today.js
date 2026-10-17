// "Now" at the chosen location: today's date, the day's times and the next moment among the
// ones the app shows (sunrise, Duha, the middle of the night and its last third).

import { addDays, dateAt, dayKey, dayTimes, tzOffset } from './prayer.js';
import { hijri } from './dates.js';
import { state } from './store.js';

// The moments of a night and a morning that the app counts down to.
export const MOMENTS = ['sunrise', 'duha', 'midnight', 'lastThird'];

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
    times.sunrise,
    times.duha,
    times.midnight,
    times.lastThird,
    tomorrow.sunrise,
    tomorrow.duha,
  ].sort((a, b) => a.at - b.at);
  const next = timeline.find((x) => x.at > t) || tomorrow.duha;
  const prev = [...timeline].reverse().find((x) => x.at <= t) || { ...yesterday.lastThird };

  return { ...cache.value, next, prev, weekday, isFriday: weekday === 5, period: periodNow(times, night, t) };
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
  if (t >= times.duha.at && t < times.dhuhr.at) return { key: 'duha', title: 'وقت الضحى', sub: 'ركعتان فأكثر، تجزئان عن صدقة كل مفاصلك' };
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
