// Prayer times computed on the device from the sun's position (the method used by
// praytimes.org), so they work offline and need no server.

export const METHODS = {
  umm_al_qura: { name: 'أم القرى — مكة المكرمة', fajr: 18.5, ishaMinutes: 90, ramadanIshaMinutes: 120 },
  mwl: { name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
  egypt: { name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
  karachi: { name: 'جامعة العلوم الإسلامية بكراتشي', fajr: 18, isha: 18 },
  kuwait: { name: 'وزارة الأوقاف الكويتية', fajr: 18, isha: 17.5 },
  qatar: { name: 'قطر', fajr: 18, ishaMinutes: 90 },
  gulf: { name: 'الإمارات', fajr: 18.2, isha: 18.2 },
  jordan: { name: 'الأردن', fajr: 18, isha: 18 },
  algeria: { name: 'الجزائر', fajr: 18, isha: 17 },
  morocco: { name: 'المغرب', fajr: 19, isha: 17 },
  tunisia: { name: 'تونس', fajr: 18, isha: 18 },
  turkey: { name: 'تركيا', fajr: 18, isha: 17 },
  isna: { name: 'أمريكا الشمالية (ISNA)', fajr: 15, isha: 15 },
  france: { name: 'فرنسا (UOIF)', fajr: 12, isha: 12 },
  singapore: { name: 'سنغافورة وماليزيا وإندونيسيا', fajr: 20, isha: 18 },
};

export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const PRAYER_NAMES = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
  midnight: 'منتصف الليل',
  lastThird: 'الثلث الأخير',
};

// Times for one day as decimal hours in the location's time zone.
// opts: { fajr, isha | ishaMinutes, asr (1 = majority, 2 = Hanafi) }
// Self-contained (no outside references) so the widget script can embed it as text.
export function solarTimes(year, month, day, lat, lng, tz, opts) {
  const R = Math.PI / 180;
  const sin = (d) => Math.sin(d * R);
  const cos = (d) => Math.cos(d * R);
  const tan = (d) => Math.tan(d * R);
  const asin = (x) => Math.asin(x) / R;
  const acos = (x) => Math.acos(x) / R;
  const atan2 = (y, x) => Math.atan2(y, x) / R;
  const acot = (x) => Math.atan(1 / x) / R;
  const fixAngle = (a) => a - 360 * Math.floor(a / 360);
  const fixHour = (h) => h - 24 * Math.floor(h / 24);
  const diff = (a, b) => fixHour(b - a);

  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
  const jDate = jd - lng / (15 * 24);

  const sun = (t) => {
    const D = jDate + t - 2451545.0;
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const ra = atan2(cos(e) * sin(L), cos(L)) / 15;
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fixHour(ra) };
  };
  const midDay = (t) => fixHour(12 - sun(t).eqt);
  const angleTime = (angle, t, before) => {
    const decl = sun(t).decl;
    const T = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return midDay(t) + (before ? -T : T);
  };
  const asrTime = (factor, t) => {
    const decl = sun(t).decl;
    return angleTime(-acot(factor + tan(Math.abs(lat - decl))), t);
  };

  const t = {
    fajr: angleTime(opts.fajr, 5 / 24, true),
    sunrise: angleTime(0.833, 6 / 24, true),
    dhuhr: midDay(12 / 24),
    asr: asrTime(opts.asr || 1, 13 / 24),
    maghrib: angleTime(0.833, 18 / 24),
    isha: opts.ishaMinutes ? 0 : angleTime(opts.isha, 18 / 24),
  };
  for (const k in t) t[k] += tz - lng / 15;
  if (opts.ishaMinutes) t.isha = t.maghrib + opts.ishaMinutes / 60;

  // Far from the equator the sun may not sink to the Fajr/Isha angle; cap those
  // times at a share of the night proportional to the angle ("angle-based").
  const night = diff(t.maghrib, t.sunrise);
  const fajrPart = (opts.fajr / 60) * night;
  if (isNaN(t.fajr) || diff(t.fajr, t.sunrise) > fajrPart) t.fajr = t.sunrise - fajrPart;
  if (!opts.ishaMinutes) {
    const ishaPart = (opts.isha / 60) * night;
    if (isNaN(t.isha) || diff(t.maghrib, t.isha) > ishaPart) t.isha = t.maghrib + ishaPart;
  }

  // The night runs from Maghrib to the next Fajr.
  const nightLen = diff(t.maghrib, t.fajr);
  t.midnight = t.maghrib + nightLen / 2;
  t.lastThird = t.maghrib + (nightLen * 2) / 3;
  return t;
}

// Hours ahead of UTC for an IANA zone (e.g. "Asia/Riyadh") at a moment; null = this device.
export function tzOffset(tzName, date) {
  if (!tzName) return -date.getTimezoneOffset() / 60;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tzName,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(date);
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
    return Math.round((asUTC - Math.floor(date.getTime() / 60000) * 60000) / 900000) / 4;
  } catch (e) {
    return -date.getTimezoneOffset() / 60;
  }
}

// The calendar date at a location ({ y, m, d }), which may differ from the device's.
export function dateAt(tzName, date = new Date()) {
  const shifted = new Date(date.getTime() + tzOffset(tzName, date) * 3600000);
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
}

export function addDays({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export const dayKey = ({ y, m, d }) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Full day of times for the app: every entry has `hours` (for display in the
// location's time) and `at` (an exact moment, for countdowns and reminders).
export function dayTimes(day, settings, isRamadan = false) {
  const { location, method, asr, offsets = {} } = settings;
  const m = METHODS[method] || METHODS.umm_al_qura;
  const noonUTC = new Date(Date.UTC(day.y, day.m - 1, day.d, 12));
  const tz = tzOffset(location.tz, noonUTC);
  const opts = {
    fajr: m.fajr,
    isha: m.isha,
    ishaMinutes: isRamadan && m.ramadanIshaMinutes ? m.ramadanIshaMinutes : m.ishaMinutes,
    asr,
  };
  const raw = solarTimes(day.y, day.m, day.d, location.lat, location.lng, tz, opts);
  const base = Date.UTC(day.y, day.m - 1, day.d);
  const out = {};
  for (const k of Object.keys(raw)) {
    // Round to the nearest minute, after any manual correction.
    const minutes = Math.round(raw[k] * 60 + (offsets[k] || 0));
    out[k] = { key: k, name: PRAYER_NAMES[k], hours: minutes / 60, at: base + (minutes - tz * 60) * 60000 };
  }
  return out;
}

// Great-circle direction (degrees from true north) and distance (km) to the Kaaba.
const KAABA = { lat: 21.422487, lng: 39.826206 };
export function qibla(lat, lng) {
  const R = Math.PI / 180;
  const p1 = lat * R;
  const p2 = KAABA.lat * R;
  const dl = (KAABA.lng - lng) * R;
  const bearing = Math.atan2(Math.sin(dl), Math.cos(p1) * Math.tan(p2) - Math.sin(p1) * Math.cos(dl)) / R;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return { bearing: (bearing + 360) % 360, km: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
}
