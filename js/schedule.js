// The list of reminders for the coming days, worked out on the device. The server
// (push/cron.php) only sends each one at its time. The app has two reminders: istighfar and
// the salawat on the Prophet ﷺ, each repeated every few minutes between two hours of the day.

import { addDays, dateAt, dayTimes } from './prayer.js';

export const SCHEDULE_DAYS = 30;
// The server keeps at most this many reminders per device (push/subscribe.php).
const MAX_ITEMS = 1400;

const ISTIGHFAR = [
  'أستغفر الله العظيم الذي لا إله إلا هو الحي القيوم وأتوب إليه',
  'أستغفر الله وأتوب إليه',
  '«والله إني لأستغفر الله وأتوب إليه في اليوم أكثر من سبعين مرة»',
  'رب اغفر لي وتب عليّ إنك أنت التواب الرحيم',
];

const SALAWAT = [
  'اللهم صلِّ وسلم وبارك على نبينا محمد ﷺ',
  '«من صلى علي صلاة صلى الله عليه بها عشراً»',
  'اللهم صل على محمد وعلى آل محمد، كما صليت على إبراهيم وعلى آل إبراهيم، إنك حميد مجيد',
];

export const EVERY_OPTIONS = [3, 5, 10];

const minutesOf = (hhmm) => {
  const [h, m] = (hhmm || '0:0').split(':').map(Number);
  return h * 60 + m;
};

export function buildSchedule(state, { days = SCHEDULE_DAYS, from = Date.now() } = {}) {
  const s = state.settings;
  const n = s.notify;
  const items = [];
  const today = dateAt(s.location.tz, new Date(from));
  const from0 = minutesOf(n.from);
  const to0 = Math.max(from0, minutesOf(n.to));
  const kinds = [
    n.istighfar && { every: n.istighfarEvery, title: 'الاستغفار', texts: ISTIGHFAR, tag: 'istighfar' },
    n.salawat && { every: n.salawatEvery, title: 'الصلاة على النبي ﷺ', texts: SALAWAT, tag: 'salawat' },
  ].filter(Boolean);

  for (let i = 0; i < days && kinds.length; i++) {
    const day = addDays(today, i);
    // Midnight of the day at the location, from the Dhuhr time of that day.
    const ref = dayTimes(day, s).dhuhr;
    const midnight = ref.at - ref.hours * 3600000;
    for (const k of kinds) {
      for (let m = from0, j = 0; m <= to0; m += k.every, j++) {
        const at = midnight + m * 60000;
        if (at > from) items.push({ at: Math.round(at), title: k.title, body: k.texts[(i + j) % k.texts.length], url: '#/mine', tag: k.tag });
      }
    }
  }
  return items.sort((a, b) => a.at - b.at).slice(0, MAX_ITEMS);
}

// Changes when anything that affects the schedule changes, so the app re-sends it then.
export function scheduleHash(state) {
  const s = state.settings;
  const text = JSON.stringify([s.location, s.method, s.asr, s.offsets, s.notify]);
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return String(h);
}
