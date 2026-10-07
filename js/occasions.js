// Islamic occasions through the year, placed on the Gregorian calendar by the Umm al-Qura
// Hijri dates (with the user's correction), and the Hijri months for the calendar.

import { hijri } from './dates.js';
import { addDays, dayKey } from './prayer.js';

// month and days are Hijri; `to` ends a range (clipped to the month's last day).
export const OCCASIONS = [
  {
    id: 'ramadan', name: 'شهر رمضان', icon: 'moon', month: 9, from: 1, to: 30,
    text: '«من صام رمضان إيماناً واحتساباً غُفر له ما تقدم من ذنبه»', ref: 'متفق عليه',
  },
  {
    id: 'lastTen', name: 'العشر الأواخر من رمضان', icon: 'stars', month: 9, from: 21, to: 30,
    text: '«كان رسول الله ﷺ إذا دخل العشر شدّ مئزره، وأحيا ليله، وأيقظ أهله» — وفيها ليلة القدر: «تحرّوا ليلة القدر في الوتر من العشر الأواخر من رمضان»', ref: 'متفق عليه، والثاني رواه البخاري',
  },
  {
    id: 'fitr', name: 'عيد الفطر', icon: 'gift', month: 10, from: 1, to: 1,
    text: 'أخرج زكاة الفطر قبل صلاة العيد، وكبّر من غروب شمس ليلة العيد إلى الصلاة. ولا يُصام يوم العيد.', ref: '',
  },
  {
    id: 'shawwal', name: 'صيام الست من شوال', icon: 'leaf', month: 10, from: 2, to: 30,
    text: '«من صام رمضان ثم أتبعه ستاً من شوال كان كصيام الدهر»', ref: 'رواه مسلم',
  },
  {
    id: 'dhulHijjah', name: 'العشر الأوائل من ذي الحجة', icon: 'sun', month: 12, from: 1, to: 10,
    text: '«ما من أيام العمل الصالح فيهن أحب إلى الله من هذه الأيام العشر» — فأكثر فيها من التكبير والتهليل والتحميد والصيام والصدقة.', ref: 'رواه الترمذي وأبو داود، وأصله في البخاري',
  },
  {
    id: 'tarwiyah', name: 'يوم التروية', icon: 'drop', month: 12, from: 8, to: 8,
    text: 'الثامن من ذي الحجة: يُحرم فيه الحاج بالحج ويتوجه إلى منى، ولغير الحاج الصيام والذكر والعمل الصالح في العشر.', ref: '',
  },
  {
    id: 'arafah', name: 'يوم عرفة', icon: 'mountain', month: 12, from: 9, to: 9,
    text: '«صيام يوم عرفة أحتسب على الله أن يكفّر السنة التي قبله والسنة التي بعده»، و«خير الدعاء دعاء يوم عرفة»', ref: 'رواه مسلم، والثاني رواه الترمذي',
  },
  {
    id: 'adha', name: 'عيد الأضحى (يوم النحر)', icon: 'sunrise', month: 12, from: 10, to: 10,
    text: '«إن أول ما نبدأ به في يومنا هذا أن نصلي، ثم نرجع فننحر» — صلاة العيد ثم الأضحية، ولا يُصام يوم العيد.', ref: 'رواه البخاري',
  },
  {
    id: 'tashreeq', name: 'أيام التشريق', icon: 'stars', month: 12, from: 11, to: 13,
    text: '«أيام التشريق أيام أكل وشرب وذكر لله» — يُكبَّر فيها أدبار الصلوات، ولا تُصام.', ref: 'رواه مسلم',
  },
  {
    id: 'newYear', name: 'رأس السنة الهجرية', icon: 'calendar', month: 1, from: 1, to: 1,
    text: 'بداية شهر الله المحرم: «أفضل الصيام بعد رمضان شهر الله المحرم»', ref: 'رواه مسلم',
  },
  {
    id: 'tasua', name: 'تاسوعاء', icon: 'moon', month: 1, from: 9, to: 9,
    text: '«لئن بقيت إلى قابل لأصومن التاسع» — يُصام مع عاشوراء.', ref: 'رواه مسلم',
  },
  {
    id: 'ashura', name: 'عاشوراء', icon: 'moonStar', month: 1, from: 10, to: 10,
    text: '«صيام يوم عاشوراء أحتسب على الله أن يكفّر السنة التي قبله»', ref: 'رواه مسلم',
  },
];

export const daysBetween = (a, b) => Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);

// Every occasion that has not ended by `start`, for about a year ahead, in date order:
// { ...occasion, start: day, end: day, hijri: { day, month, year } of the start }.
export function occasionsFrom(start, adjust = 0, days = 400) {
  const found = [];
  const open = new Map(); // id → entry still running
  for (let i = -45; i <= days; i++) {
    const day = addDays(start, i);
    const h = hijri(day, adjust);
    for (const o of OCCASIONS) {
      const inside = h.month === o.month && h.day >= o.from && h.day <= o.to;
      const key = `${o.id}-${h.year}`;
      if (inside) {
        if (!open.has(key)) {
          const e = { ...o, key, start: day, end: day, hijri: h };
          open.set(key, e);
          found.push(e);
        } else open.get(key).end = day;
      }
    }
  }
  return found.filter((e) => daysBetween(start, e.end) >= 0 && daysBetween(start, e.start) <= days).sort((a, b) => daysBetween(b.start, a.start));
}

// The occasions falling on one day (for the calendar's dots and the day's details).
export function occasionsOn(day, adjust = 0) {
  const h = hijri(day, adjust);
  return OCCASIONS.filter((o) => h.month === o.month && h.day >= o.from && h.day <= o.to);
}

// The Gregorian days of a Hijri month: found from a day near it (today, or the month shown).
export function hijriMonthDays(year, month, near, adjust = 0) {
  const h0 = hijri(near, adjust);
  const diff = (year - h0.year) * 12 + (month - h0.month);
  let day = addDays(near, Math.round(diff * 29.5306) - h0.day + 1);
  // Walk to the first day of that month (the estimate is off by a day or two at most).
  for (let i = 0; i < 40; i++) {
    const h = hijri(day, adjust);
    const before = h.year < year || (h.year === year && h.month < month);
    if (before) day = addDays(day, 1);
    else if (h.year === year && h.month === month && h.day > 1) day = addDays(day, -(h.day - 1));
    else if (h.year === year && h.month === month) break;
    else day = addDays(day, -1);
  }
  const out = [];
  for (let d = day; ; d = addDays(d, 1)) {
    const h = hijri(d, adjust);
    if (h.month !== month || h.year !== year) break;
    out.push({ day: d, hijri: h, key: dayKey(d) });
  }
  return out;
}
