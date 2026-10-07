// iPhone home-screen and lock-screen widget. Web apps cannot add widgets on iOS, so
// this writes a script for the free "Scriptable" app, which can. The script carries
// the user's location and settings and computes the times itself, offline.

import { APP_NAME } from './config.js';
import { DAILY } from './adhkar-data.js';
import { METHODS, solarTimes, tzOffset } from './prayer.js';

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

  return `// ${APP_NAME} — ويدجت مواقيت الصلاة والتاريخ الهجري لتطبيق Scriptable
// أُنشئ من التطبيق بإعداداتك. لتغيير المدينة أو طريقة الحساب انسخ الكود من جديد.
// يعمل دون إنترنت، ويناسب كل أحجام الويدجت وشاشة القفل.

const CFG = ${JSON.stringify(cfg, null, 2)};
const DHIKR = ${JSON.stringify(dhikr)};

const solarTimes = ${solarTimes.toString()};
const tzOffset = ${tzOffset.toString()};

const NAMES = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
const HIJRI_MONTHS = ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
const GREG_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const WEEKDAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

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
  return { y, m, d, h, times, weekday: WEEKDAYS[base.getUTCDay()] };
}

const today = day(0);
const now = new Date();
const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
let next = order.map((k) => today.times[k]).find((t) => t.at > now);
if (!next) next = day(1).times.fajr;
if (today.weekday === 'الجمعة' && next.key === 'dhuhr') next = { ...next, name: 'الجمعة' };

const hijriText = num(today.h.day) + ' ' + HIJRI_MONTHS[today.h.month - 1] + ' ' + num(today.h.year) + ' هـ';
const gregText = num(today.d) + ' ' + GREG_MONTHS[today.m - 1] + ' ' + num(today.y) + ' م';

const GOLD = new Color('#e3c27a');
const WHITE = new Color('#ffffff');
const SOFT = new Color('#ffffff', 0.72);
const family = config.widgetFamily || 'medium';

const w = new ListWidget();
w.url = CFG.url;
w.refreshAfterDate = new Date(Math.min(next.at.getTime() + 60000, now.getTime() + 30 * 60000));

function text(stack, s, font, color, align) {
  const t = stack.addText(s);
  t.font = font;
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.6;
  if (align === 'center') t.centerAlignText();
  else t.rightAlignText();
  return t;
}
function timer(stack, font, color) {
  const t = stack.addDate(next.at);
  t.applyTimerStyle();
  t.font = font;
  t.textColor = color;
  t.rightAlignText();
  return t;
}

if (family === 'accessoryInline') {
  w.addText(next.name + ' ' + clock(next.hours) + ' • ' + num(today.h.day) + ' ' + HIJRI_MONTHS[today.h.month - 1]);
} else if (family === 'accessoryCircular') {
  w.addAccessoryWidgetBackground = true;
  const s = w.addStack();
  s.layoutVertically();
  s.centerAlignContent();
  text(s, next.name, Font.boldSystemFont(12), WHITE, 'center');
  text(s, clock(next.hours).replace(/ [صم]$/, ''), Font.boldRoundedSystemFont(14), WHITE, 'center');
} else if (family === 'accessoryRectangular') {
  const top = w.addStack();
  top.addSpacer();
  text(top, next.name + '  ' + clock(next.hours), Font.boldSystemFont(15), WHITE);
  const mid = w.addStack();
  mid.addSpacer();
  timer(mid, Font.semiboldRoundedSystemFont(13), WHITE);
  const bot = w.addStack();
  bot.addSpacer();
  text(bot, hijriText, Font.systemFont(12), WHITE);
} else {
  const g = new LinearGradient();
  g.colors = [new Color('#0a2f2a'), new Color('#0f5c4d')];
  g.locations = [0, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
  w.setPadding(14, 14, 14, 14);

  const nextBlock = (stack) => {
    const a = stack.addStack();
    a.addSpacer();
    text(a, today.weekday + ' • ' + hijriText, Font.semiboldSystemFont(11), GOLD);
    if (family !== 'small') {
      const b = stack.addStack();
      b.addSpacer();
      text(b, gregText, Font.systemFont(10), SOFT);
    }
    stack.addSpacer();
    const c = stack.addStack();
    c.addSpacer();
    text(c, 'الصلاة القادمة', Font.systemFont(10), SOFT);
    const d = stack.addStack();
    d.addSpacer();
    text(d, next.name, Font.boldSystemFont(family === 'small' ? 20 : 22), WHITE);
    const e = stack.addStack();
    e.addSpacer();
    text(e, clock(next.hours), Font.boldRoundedSystemFont(family === 'small' ? 22 : 26), WHITE);
    const f = stack.addStack();
    f.addSpacer();
    timer(f, Font.mediumRoundedSystemFont(12), GOLD);
    stack.addSpacer(2);
    const p = stack.addStack();
    p.addSpacer();
    text(p, '⌖ ' + CFG.place, Font.systemFont(9), SOFT);
  };

  const listBlock = (stack) => {
    for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
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

  if (family === 'small') {
    nextBlock(w);
  } else {
    const main = w.addStack();
    const left = main.addStack();
    left.layoutVertically();
    left.size = new Size(family === 'large' ? 0 : 140, 0);
    listBlock(left);
    main.addSpacer(12);
    const right = main.addStack();
    right.layoutVertically();
    nextBlock(right);
    if (family === 'large') {
      w.addSpacer(10);
      const q = w.addStack();
      q.backgroundColor = new Color('#ffffff', 0.1);
      q.cornerRadius = 12;
      q.setPadding(10, 10, 10, 10);
      q.addSpacer();
      const t = text(q, DHIKR[(today.d + today.m) % DHIKR.length], Font.semiboldSystemFont(15), WHITE);
      t.lineLimit = 3;
    }
  }
}

Script.setWidget(w);
if (!config.runsInWidget) {
  if (family === 'small') await w.presentSmall();
  else if (family === 'large') await w.presentLarge();
  else await w.presentMedium();
}
Script.complete();
`;
}
