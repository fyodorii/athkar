// Hijri (Umm al-Qura) and Gregorian dates, times and digits in Arabic.

export const HIJRI_MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];
export const GREG_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

let digitStyle = 'arab';
export function setDigits(style) {
  digitStyle = style;
}

// Shows numbers in Arabic-Indic digits (٠١٢…) unless Latin digits are chosen.
export function num(value) {
  const s = String(value);
  return digitStyle === 'arab' ? s.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]) : s;
}

let umalqura;
try {
  umalqura = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  if (umalqura.resolvedOptions().calendar !== 'islamic-umalqura') umalqura = null;
} catch (e) {
  umalqura = null;
}

// Tabular Islamic calendar, used only where the browser lacks Umm al-Qura.
function tabularHijri(y, m, d) {
  const jd =
    Math.floor((1461 * (y + 4800 + Math.floor((m - 14) / 12))) / 4) +
    Math.floor((367 * (m - 2 - 12 * Math.floor((m - 14) / 12))) / 12) -
    Math.floor((3 * Math.floor((y + 4900 + Math.floor((m - 14) / 12)) / 100)) / 4) +
    d - 32075;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  return { day: l - Math.floor((709 * month) / 24), month, year: 30 * n + j - 30 };
}

// Hijri date for a calendar day ({ y, m, d }), shifted by the user's correction in days.
export function hijri(day, adjust = 0) {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + adjust));
  if (umalqura) {
    const parts = umalqura.formatToParts(t);
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return { day: get('day'), month: get('month'), year: get('year') };
  }
  return tabularHijri(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function weekday(day) {
  return WEEKDAYS[new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()];
}

export function hijriText(day, adjust) {
  const h = hijri(day, adjust);
  return `${num(h.day)} ${HIJRI_MONTHS[h.month - 1]} ${num(h.year)} هـ`;
}

export function gregText(day) {
  return `${num(day.d)} ${GREG_MONTHS[day.m - 1]} ${num(day.y)} م`;
}

// "4:58" + "ص" from decimal hours.
export function clock(hours, h24 = false) {
  const total = Math.round((((hours % 24) + 24) % 24) * 60) % 1440;
  const h = Math.floor(total / 60);
  const m = String(total % 60).padStart(2, '0');
  if (h24) return { time: num(`${String(h).padStart(2, '0')}:${m}`), period: '' };
  return { time: num(`${h % 12 || 12}:${m}`), period: h < 12 ? 'ص' : 'م' };
}

export function clockText(hours, h24) {
  const c = clock(hours, h24);
  return c.period ? `${c.time} ${c.period}` : c.time;
}

// "01:23:45" until a moment.
export function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return num(`${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`);
}

// "بعد ساعتين و١٠ دقائق"-style phrase for notifications and labels.
export function minutesText(n) {
  if (n === 1) return 'دقيقة';
  if (n === 2) return 'دقيقتين';
  if (n >= 3 && n <= 10) return `${num(n)} دقائق`;
  return `${num(n)} دقيقة`;
}
