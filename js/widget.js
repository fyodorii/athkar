// iPhone home-screen and lock-screen widgets. Web apps cannot add widgets on iOS, so
// this writes one script for the free "Scriptable" app, which can. The script carries
// the user's location and settings and computes everything itself, offline. Its style
// is picked by the word typed in the widget's Parameter field (see WIDGET_STYLES).

import { APP_NAME } from './config.js';
import { DAILY } from './adhkar-data.js';
import { AYAT } from './daily-data.js';
import { METHODS, solarTimes, tzOffset } from './prayer.js';
import { state } from './store.js';

export const WIDGET_STYLES = [
  { word: 'مواقيت', title: 'مواقيت الصلاة', desc: 'الصلاة القادمة وعدّها التنازلي ومواقيت اليوم (الافتراضي)' },
  { word: 'عداد', title: 'العد التنازلي', desc: 'الصلاة القادمة بخط كبير، ومتى يخرج وقت الصلاة الحالية' },
  { word: 'التاريخ', title: 'التاريخ الهجري', desc: 'اليوم الهجري بخط كبير مع الميلادي واليوم' },
  { word: 'آية', title: 'آية اليوم', desc: 'آية تتجدد كل يوم' },
  { word: 'ذكر', title: 'ذكر اليوم', desc: 'ذكر مأثور يتجدد كل ساعة' },
  { word: 'أذكاري', title: 'أذكاري', desc: 'من أذكارك الخاصة، يتجدد كل ساعة' },
  { word: 'الليل', title: 'الضحى والليل', desc: 'الشروق والضحى ومنتصف الليل والثلث الأخير' },
];

export function widgetScript(settings) {
  const m = METHODS[settings.method] || METHODS.umm_al_qura;
  const cfg = {
    place: settings.location.name,
    lat: settings.location.lat,
    lng: settings.location.lng,
    tz: settings.location.tz || null,
    fajr: m.fajr,
    isha: m.isha || null,
    ishaMinutes: m.ishaMinutes || null,
    ramadanIshaMinutes: m.ramadanIshaMinutes || null,
    asr: settings.asr,
    offsets: settings.offsets,
    hijriAdjust: settings.hijriAdjust,
    clock24: settings.clock24,
    arabicDigits: settings.digits === 'arab',
    url: location.href.split('#')[0],
  };
  const dhikr = DAILY.map((d) => d.text);
  const ayat = AYAT.map(([, plain, ref]) => [plain, ref]);
  const mine = state.custom.map((c) => (c.text.length > 160 ? c.text.slice(0, 157) + '…' : c.text)).slice(0, 30);

  return `// ${APP_NAME} — ويدجت لتطبيق Scriptable (الشاشة الرئيسية وشاشة القفل)
// أُنشئ من التطبيق بإعداداتك، ويعمل دون إنترنت.
// اختر شكل الويدجت بكتابة كلمة في خانة Parameter عند تعديل الويدجت:
// ${WIDGET_STYLES.map((w) => w.word).join(' • ')}
// لتغيير المدينة أو طريقة الحساب انسخ الكود من التطبيق من جديد.

const CFG = ${JSON.stringify(cfg, null, 2)};
const DHIKR = ${JSON.stringify(dhikr)};
const AYAT = ${JSON.stringify(ayat)};
const MINE = ${JSON.stringify(mine)};

const solarTimes = ${solarTimes.toString()};
const tzOffset = ${tzOffset.toString()};

const NAMES = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء', midnight: 'منتصف الليل', lastThird: 'الثلث الأخير' };
const END = { fajr: 'sunrise', dhuhr: 'asr', asr: 'maghrib', maghrib: 'isha', isha: 'midnight' };
const HIJRI_MONTHS = ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
const GREG_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const WEEKDAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const STYLES = { 'مواقيت': 'times', 'عداد': 'countdown', 'التاريخ': 'date', 'تاريخ': 'date', 'آية': 'ayah', 'اية': 'ayah', 'ذكر': 'dhikr', 'أذكاري': 'mine', 'اذكاري': 'mine', 'الليل': 'night', 'ليل': 'night' };
const style = STYLES[String(args.widgetParameter || '').trim()] || 'times';

const num = (s) => CFG.arabicDigits ? String(s).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]) : String(s);
function clock(hours) {
  const t = Math.round((((hours % 24) + 24) % 24) * 60) % 1440;
  const h = Math.floor(t / 60), mm = String(t % 60).padStart(2, '0');
  if (CFG.clock24) return num(String(h).padStart(2, '0') + ':' + mm);
  return num((h % 12 || 12) + ':' + mm) + (h < 12 ? ' ص' : ' م');
}
function hijri(y, m, d) {
  const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const p = f.formatToParts(new Date(Date.UTC(y, m - 1, d + CFG.hijriAdjust)));
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return { day: g('day'), month: g('month'), year: g('year') };
}
function day(offset) {
  const now = new Date();
  const local = new Date(now.getTime() + tzOffset(CFG.tz, now) * 3600000);
  const base = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + offset));
  const y = base.getUTCFullYear(), m = base.getUTCMonth() + 1, d = base.getUTCDate();
  const tz = tzOffset(CFG.tz, new Date(Date.UTC(y, m - 1, d, 12)));
  const h = hijri(y, m, d);
  const ishaMinutes = h.month === 9 && CFG.ramadanIshaMinutes ? CFG.ramadanIshaMinutes : CFG.ishaMinutes;
  const raw = solarTimes(y, m, d, CFG.lat, CFG.lng, tz, { fajr: CFG.fajr, isha: CFG.isha, ishaMinutes, asr: CFG.asr });
  const times = {};
  for (const k of Object.keys(NAMES)) {
    const min = Math.round(raw[k] * 60 + (CFG.offsets[k] || 0));
    times[k] = { key: k, name: NAMES[k], hours: min / 60, at: new Date(Date.UTC(y, m - 1, d) + (min - tz * 60) * 60000) };
  }
  times.duha = { key: 'duha', name: 'الضحى', hours: times.sunrise.hours + 0.25, at: new Date(times.sunrise.at.getTime() + 15 * 60000) };
  return { y, m, d, h, times, weekday: WEEKDAYS[base.getUTCDay()], n: Math.floor(Date.UTC(y, m - 1, d) / 86400000) };
}

const today = day(0);
const now = new Date();
const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
let next = order.map((k) => today.times[k]).find((t) => t.at > now);
if (!next) next = day(1).times.fajr;
if (today.weekday === 'الجمعة' && next.key === 'dhuhr') next = { ...next, name: 'الجمعة' };
const passed = order.map((k) => today.times[k]).filter((t) => t.at <= now).pop();
const current = passed && today.times[END[passed.key]].at > now ? { ...passed, end: today.times[END[passed.key]] } : null;

const hijriText = num(today.h.day) + ' ' + HIJRI_MONTHS[today.h.month - 1] + ' ' + num(today.h.year) + ' هـ';
const gregText = num(today.d) + ' ' + GREG_MONTHS[today.m - 1] + ' ' + num(today.y) + ' م';

const GOLD = new Color('#e3c27a');
const WHITE = new Color('#ffffff');
const SOFT = new Color('#ffffff', 0.72);
const family = config.widgetFamily || 'medium';
const big = family === 'large';
const small = family === 'small';

const w = new ListWidget();
w.url = CFG.url;
let refresh = Math.min(next.at.getTime() + 60000, now.getTime() + 30 * 60000);
if (style === 'dhikr' || style === 'mine') refresh = Math.min(refresh, now.getTime() + 60 * 60000);
w.refreshAfterDate = new Date(refresh);

function text(stack, s, font, color, align) {
  const t = stack.addText(s);
  t.font = font;
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.5;
  if (align === 'center') t.centerAlignText();
  else t.rightAlignText();
  return t;
}
function right(stack) {
  const r = stack.addStack();
  r.addSpacer();
  return r;
}
function line(stack, s, font, color, lines) {
  const t = text(right(stack), s, font, color);
  if (lines) t.lineLimit = lines;
  return t;
}
function timer(stack, date, font, color) {
  const r = right(stack);
  const t = r.addDate(date);
  t.applyTimerStyle();
  t.font = font;
  t.textColor = color;
  t.rightAlignText();
  return t;
}
function background(colors) {
  const g = new LinearGradient();
  g.colors = colors.map((c) => new Color(c));
  g.locations = [0, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
  w.setPadding(14, 14, 14, 14);
}
const hourIndex = (list) => list.length ? list[(today.n * 24 + now.getHours()) % list.length] : '';

// ---- Lock screen ----
if (family === 'accessoryInline') {
  if (style === 'date') w.addText(today.weekday + ' ' + num(today.h.day) + ' ' + HIJRI_MONTHS[today.h.month - 1]);
  else w.addText(next.name + ' ' + clock(next.hours) + ' • ' + num(today.h.day) + ' ' + HIJRI_MONTHS[today.h.month - 1]);
} else if (family === 'accessoryCircular') {
  w.addAccessoryWidgetBackground = true;
  const s = w.addStack();
  s.layoutVertically();
  if (style === 'date') {
    text(s, num(today.h.day), Font.boldRoundedSystemFont(22), WHITE, 'center');
    text(s, HIJRI_MONTHS[today.h.month - 1], Font.systemFont(9), WHITE, 'center');
  } else {
    text(s, next.name, Font.boldSystemFont(12), WHITE, 'center');
    text(s, clock(next.hours).replace(/ [صم]$/, ''), Font.boldRoundedSystemFont(14), WHITE, 'center');
  }
} else if (family === 'accessoryRectangular') {
  if (style === 'ayah' || style === 'dhikr' || style === 'mine') {
    const s = style === 'ayah' ? AYAT[today.n % AYAT.length][0] : hourIndex(style === 'mine' ? MINE : DHIKR);
    line(w, s, Font.semiboldSystemFont(13), WHITE, 3);
  } else if (style === 'date') {
    line(w, today.weekday, Font.boldSystemFont(14), WHITE);
    line(w, hijriText, Font.semiboldSystemFont(13), WHITE);
    line(w, gregText, Font.systemFont(12), WHITE);
  } else {
    line(w, next.name + '  ' + clock(next.hours), Font.boldSystemFont(15), WHITE);
    timer(w, next.at, Font.semiboldRoundedSystemFont(13), WHITE);
    line(w, current ? 'يخرج وقت ' + current.name + ' ' + clock(current.end.hours) : hijriText, Font.systemFont(12), WHITE);
  }

// ---- Home screen ----
} else if (style === 'date') {
  background(['#3a2a0c', '#8a6420']);
  line(w, today.weekday, Font.boldSystemFont(small ? 16 : 20), WHITE);
  w.addSpacer();
  line(w, num(today.h.day), Font.boldRoundedSystemFont(small ? 54 : 64), WHITE);
  line(w, HIJRI_MONTHS[today.h.month - 1] + ' ' + num(today.h.year) + ' هـ', Font.semiboldSystemFont(small ? 15 : 18), GOLD);
  w.addSpacer();
  line(w, gregText, Font.mediumSystemFont(small ? 12 : 14), SOFT);
  if (!small) line(w, '⌖ ' + CFG.place + ' • ' + next.name + ' ' + clock(next.hours), Font.systemFont(11), SOFT);
} else if (style === 'countdown') {
  background(['#071f3a', '#1b4f8a']);
  line(w, 'الصلاة القادمة', Font.systemFont(12), SOFT);
  line(w, next.name, Font.boldSystemFont(small ? 26 : 32), WHITE);
  timer(w, next.at, Font.boldRoundedSystemFont(small ? 26 : 34), GOLD);
  line(w, 'الساعة ' + clock(next.hours), Font.mediumSystemFont(12), SOFT);
  w.addSpacer();
  if (current) {
    line(w, 'يخرج وقت ' + current.name, Font.semiboldSystemFont(12), WHITE);
    timer(w, current.end.at, Font.mediumRoundedSystemFont(12), SOFT);
  } else line(w, hijriText, Font.systemFont(11), SOFT);
} else if (style === 'ayah' || style === 'dhikr' || style === 'mine') {
  const ayah = style === 'ayah' ? AYAT[today.n % AYAT.length] : null;
  const body = ayah ? '﴿' + ayah[0] + '﴾' : hourIndex(style === 'mine' ? MINE : DHIKR) || 'أضف أذكارك في التطبيق ثم انسخ الكود من جديد';
  background(style === 'ayah' ? ['#0a2f2a', '#14806a'] : style === 'mine' ? ['#3b0f2a', '#8a2a5a'] : ['#1f1640', '#4b3a9a']);
  line(w, style === 'ayah' ? 'آية اليوم' : style === 'mine' ? 'من أذكاري' : 'ذكر', Font.semiboldSystemFont(12), GOLD);
  w.addSpacer();
  const t = line(w, body, Font.boldSystemFont(small ? 15 : big ? 22 : 18), WHITE, small ? 5 : big ? 10 : 4);
  t.minimumScaleFactor = 0.4;
  w.addSpacer();
  line(w, ayah ? ayah[1] : today.weekday + ' • ' + hijriText, Font.systemFont(10), SOFT);
} else if (style === 'night') {
  background(['#0b0f2a', '#2a2f6a']);
  line(w, today.weekday + ' • ' + hijriText, Font.semiboldSystemFont(11), GOLD);
  w.addSpacer(6);
  for (const k of ['sunrise', 'duha', 'midnight', 'lastThird']) {
    const t = today.times[k];
    const r = w.addStack();
    text(r, clock(t.hours), Font.semiboldRoundedSystemFont(small ? 12 : 14), WHITE);
    r.addSpacer();
    text(r, t.name, Font.mediumSystemFont(small ? 12 : 14), SOFT);
    w.addSpacer(4);
  }
} else {
  background(['#0a2f2a', '#0f5c4d']);
  const nextBlock = (stack) => {
    line(stack, today.weekday + ' • ' + hijriText, Font.semiboldSystemFont(11), GOLD);
    if (!small) line(stack, gregText, Font.systemFont(10), SOFT);
    stack.addSpacer();
    line(stack, 'الصلاة القادمة', Font.systemFont(10), SOFT);
    line(stack, next.name, Font.boldSystemFont(small ? 20 : 22), WHITE);
    line(stack, clock(next.hours), Font.boldRoundedSystemFont(small ? 22 : 26), WHITE);
    timer(stack, next.at, Font.mediumRoundedSystemFont(12), GOLD);
    stack.addSpacer(2);
    line(stack, current ? 'يخرج وقت ' + current.name + ' ' + clock(current.end.hours) : '⌖ ' + CFG.place, Font.systemFont(9), SOFT);
  };
  const listBlock = (stack) => {
    const keys = big ? ['fajr', 'sunrise', 'duha', 'dhuhr', 'asr', 'maghrib', 'isha', 'midnight', 'lastThird'] : ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    for (const k of keys) {
      const t = today.times[k];
      const row = stack.addStack();
      row.centerAlignContent();
      const on = t.key === next.key && next.at.getTime() === t.at.getTime();
      if (on) {
        row.backgroundColor = new Color('#ffffff', 0.14);
        row.cornerRadius = 6;
      }
      row.setPadding(2, 6, 2, 6);
      text(row, clock(t.hours), Font.semiboldRoundedSystemFont(12), on ? GOLD : WHITE);
      row.addSpacer();
      text(row, t.name, Font.mediumSystemFont(12), on ? GOLD : SOFT);
      stack.addSpacer(2);
    }
  };
  if (small) nextBlock(w);
  else {
    const main = w.addStack();
    const left = main.addStack();
    left.layoutVertically();
    if (!big) left.size = new Size(140, 0);
    listBlock(left);
    main.addSpacer(12);
    const rightCol = main.addStack();
    rightCol.layoutVertically();
    nextBlock(rightCol);
    if (big) {
      w.addSpacer(10);
      const q = w.addStack();
      q.backgroundColor = new Color('#ffffff', 0.1);
      q.cornerRadius = 12;
      q.setPadding(10, 10, 10, 10);
      q.addSpacer();
      const t = text(q, DHIKR[today.n % DHIKR.length], Font.semiboldSystemFont(15), WHITE);
      t.lineLimit = 3;
    }
  }
}

Script.setWidget(w);
if (!config.runsInWidget) {
  if (small) await w.presentSmall();
  else if (big) await w.presentLarge();
  else await w.presentMedium();
}
Script.complete();
`;
}
