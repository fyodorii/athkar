// iPhone home-screen and lock-screen widgets. Web apps cannot add widgets on iOS, so
// this writes one script for the free "Scriptable" app, which can. The script carries
// the user's location and settings and computes everything itself, offline. Its style
// and colours are picked by words typed in the widget's Parameter field, such as
// «دائرة» or «مسار ملكي» (see WIDGET_STYLES and WIDGET_THEMES).

import { APP_NAME } from './config.js';
import { DAILY } from './adhkar-data.js';
import { AYAT } from './daily-data.js';
import { METHODS, solarTimes, tzOffset } from './prayer.js';
import { state } from './store.js';
import { sunnahNow } from './sunnah.js';

// `theme` is each style's own colours, used when no colour word is given.
export const WIDGET_STYLES = [
  { word: 'مواقيت', id: 'times', theme: 'زمردي', title: 'مواقيت الصلاة', desc: 'الصلاة القادمة وعدّها التنازلي ومواقيت اليوم (الافتراضي)' },
  { word: 'دائرة', id: 'circle', theme: 'زمردي', title: 'دائرة الصلاة', desc: 'الصلاة القادمة في دائرة تمتلئ حتى الأذان، مع وقت الأذان والإقامة' },
  { word: 'مسار', id: 'track', theme: 'زمردي', title: 'مسار الصلوات', desc: 'الصلوات الخمس بشريط تقدّم لكل صلاة، مع التاريخين' },
  { word: 'وقت', id: 'timeayah', theme: 'زمردي', title: 'آية ووقت الصلاة', desc: 'وقت الصلاة القادمة بخط كبير مع آية قصيرة واليوم' },
  { word: 'أسبوع', id: 'week', theme: 'وردي', title: 'الأسبوع والذكر', desc: 'أيام الأسبوع بالهجري وذكر، والصلاة القادمة' },
  { word: 'عداد', id: 'countdown', theme: 'سماوي', title: 'العد التنازلي', desc: 'الصلاة القادمة بخط كبير، ومتى يخرج وقت الصلاة الحالية' },
  { word: 'السنة', id: 'sunnah', theme: 'نعناع', title: 'سنة الآن', desc: 'السنة الراتبة أو الضحى أو الوتر بحسب الوقت، وكم مضى على الأذان' },
  { word: 'التاريخ', id: 'date', theme: 'فاتح', title: 'التاريخ الهجري', desc: 'اليوم الهجري بخط كبير مع الشهر واليوم والميلادي' },
  { word: 'الليل', id: 'night', theme: 'فاتح', title: 'اليوم والليل', desc: 'المدينة واليوم، والشروق ومنتصف الليل والثلث الأخير' },
  { word: 'الوضوء', id: 'wudu', theme: 'داكن', title: 'متابعة الوضوء', desc: 'اضغط على الويدجت لتسجيل وضوئك أو نقضه، ويظهر منذ متى' },
  { word: 'آية', id: 'ayah', theme: 'زمردي', title: 'آية اليوم', desc: 'آية تتجدد كل يوم' },
  { word: 'ذكر', id: 'dhikr', theme: 'بنفسجي', title: 'ذكر', desc: 'ذكر مأثور يتجدد كل ساعة' },
  { word: 'أذكاري', id: 'mine', theme: 'عنابي', title: 'أذكاري', desc: 'من أذكارك الخاصة، يتجدد كل ساعة' },
];

// bg: gradient from top-left to bottom-right; fg: text; acc: highlights; light: a pale background.
export const WIDGET_THEMES = [
  { word: 'زمردي', name: 'زمردي', bg: ['#123a31', '#0b2620'], fg: '#ffffff', acc: '#8fd6bd' },
  { word: 'ورق', name: 'ورق المصحف', bg: ['#f8f1dd', '#ede0bf'], fg: '#3a2e18', acc: '#a0742a', light: true },
  { word: 'داكن', name: 'الداكن', bg: ['#2b3445', '#1c2330'], fg: '#ffffff', acc: '#9db4d8' },
  { word: 'أذكار', name: 'أذكار', bg: ['#a2457a', '#3b2a7a'], fg: '#ffffff', acc: '#ffd38a' },
  { word: 'فاتح', name: 'الفاتح', bg: ['#f7f4ef', '#e7e9f0'], fg: '#1d1b18', acc: '#d0583c', light: true },
  { word: 'أسود', name: 'الأسود', bg: ['#0a0a0a', '#000000'], fg: '#ffffff', acc: '#e3c27a' },
  { word: 'أزرق', name: 'الأزرق', bg: ['#3567c4', '#1d3f86'], fg: '#ffffff', acc: '#cfe0ff' },
  { word: 'نعناع', name: 'نعناع', bg: ['#e2f3ea', '#cde8db'], fg: '#163d31', acc: '#11805f', light: true },
  { word: 'ملكي', name: 'ملكي', bg: ['#2d3f96', '#141d4f'], fg: '#ffffff', acc: '#e3c27a' },
  { word: 'بنفسجي', name: 'أزرق بنفسجي', bg: ['#5b7be0', '#8a4fd0'], fg: '#ffffff', acc: '#ffe6a8' },
  { word: 'ثلجي', name: 'ثلجي فاتح', bg: ['#eaf4fd', '#d3e6f8'], fg: '#17324d', acc: '#2e6fb7', light: true },
  { word: 'فجر', name: 'ألوان الفجر', bg: ['#ffd9b0', '#bcd9ff'], fg: '#2a2433', acc: '#c2410c', light: true },
  { word: 'خزامى', name: 'خزامى', bg: ['#efe7fc', '#dacff6'], fg: '#2e2350', acc: '#6d4bc2', light: true },
  { word: 'ليلي', name: 'منتصف الليل', bg: ['#1a2150', '#070a1f'], fg: '#ffffff', acc: '#a9b8ff' },
  { word: 'واحة', name: 'واحة', bg: ['#38877b', '#1f5a52'], fg: '#ffffff', acc: '#f3d58a' },
  { word: 'جمر', name: 'جمر', bg: ['#c0602f', '#6e2210'], fg: '#ffffff', acc: '#ffd29a' },
  { word: 'فقاعة', name: 'فقاعة', bg: ['#e4ecfb', '#f3e1f1'], fg: '#2b2440', acc: '#8a4fd0', light: true },
  { word: 'عنابي', name: 'عنابي', bg: ['#5e1527', '#2e0710'], fg: '#ffffff', acc: '#f2b8a0' },
  { word: 'وردي', name: 'وردي', bg: ['#f3aea8', '#eb9a94'], fg: '#2a1616', acc: '#7a1f1f', light: true },
  { word: 'سماوي', name: 'سماوي', bg: ['#b3cfee', '#9dbde3'], fg: '#1d2b40', acc: '#3d5f8f', light: true },
];

export const themeByWord = (word) => WIDGET_THEMES.find((t) => t.word === word) || WIDGET_THEMES[0];

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
    iqama: settings.iqama,
    hijriAdjust: settings.hijriAdjust,
    clock24: settings.clock24,
    arabicDigits: settings.digits === 'arab',
    url: location.href.split('#')[0],
  };
  const dhikr = DAILY.map((d) => d.text);
  const ayat = AYAT.map(([, plain, ref]) => [plain, ref]);
  const mine = state.custom.map((c) => (c.text.length > 160 ? c.text.slice(0, 157) + '…' : c.text)).slice(0, 30);
  const styles = Object.fromEntries(WIDGET_STYLES.map((w) => [w.word, w.id]));
  const defaults = Object.fromEntries(WIDGET_STYLES.map((w) => [w.id, w.theme]));
  const themes = Object.fromEntries(WIDGET_THEMES.map((t) => [t.word, { bg: t.bg, fg: t.fg, acc: t.acc, light: !!t.light }]));

  return `// ${APP_NAME} — ويدجت لتطبيق Scriptable (الشاشة الرئيسية وشاشة القفل)
// أُنشئ من التطبيق بإعداداتك، ويعمل دون إنترنت.
// اكتب في خانة Parameter كلمة الشكل، وإن شئت كلمة اللون بعدها (مثل: دائرة ملكي).
// الأشكال: ${WIDGET_STYLES.map((w) => w.word).join(' • ')}
// الألوان: ${WIDGET_THEMES.map((t) => t.word).join(' • ')}
// لتغيير المدينة أو طريقة الحساب انسخ الكود من التطبيق من جديد.

const CFG = ${JSON.stringify(cfg, null, 2)};
const DHIKR = ${JSON.stringify(dhikr)};
const AYAT = ${JSON.stringify(ayat)};
const MINE = ${JSON.stringify(mine)};
const THEMES = ${JSON.stringify(themes)};
const STYLES = ${JSON.stringify({ ...styles, تاريخ: 'date', اية: 'ayah', اذكاري: 'mine', ليل: 'night', الوضوء: 'wudu', وضوء: 'wudu', سنة: 'sunnah', دائره: 'circle' })};
const DEFAULT_THEME = ${JSON.stringify(defaults)};

const solarTimes = ${solarTimes.toString()};
const tzOffset = ${tzOffset.toString()};
const sunnahNow = ${sunnahNow.toString()};

const NAMES = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء', midnight: 'منتصف الليل', lastThird: 'الثلث الأخير' };
const END = { fajr: 'sunrise', dhuhr: 'asr', asr: 'maghrib', maghrib: 'isha', isha: 'midnight' };
const HIJRI_MONTHS = ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'];
const GREG_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const WEEKDAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const WD_SHORT = ['أح','إث','ثل','أر','خم','جم','سب'];

// The words in the Parameter field: a style and, if given, a colour.
const words = String(args.widgetParameter || '').trim().split(/[\\s,،\\-_|]+/).filter(Boolean);
let style = 'times';
let themeWord = '';
for (const x of words) {
  if (STYLES[x] && style === 'times') style = STYLES[x];
  else if (THEMES[x]) themeWord = x;
}

// Tapping the wudu widget runs the script again with ?wudu=1, which flips the state.
const WUDU_KEY = 'adhkar-app-wudu';
let wudu = { on: false, at: 0 };
try { if (Keychain.contains(WUDU_KEY)) wudu = JSON.parse(Keychain.get(WUDU_KEY)); } catch (e) {}
const query = args.queryParameters || {};
// The link that runs this script again with ?wudu=1 (whether or not the URL already has a query).
const wuduUrl = () => { const u = URLScheme.forRunningScript(); return u + (u.includes('?') ? '&' : '?') + 'wudu=1'; };
if (query.wudu) {
  wudu = { on: !wudu.on, at: Date.now() };
  Keychain.set(WUDU_KEY, JSON.stringify(wudu));
  style = 'wudu';
  if (query.theme && THEMES[query.theme]) themeWord = query.theme;
}

const num = (s) => CFG.arabicDigits ? String(s).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]) : String(s);
function parts(hours) {
  const t = Math.round((((hours % 24) + 24) % 24) * 60) % 1440;
  const h = Math.floor(t / 60), mm = String(t % 60).padStart(2, '0');
  if (CFG.clock24) return { hh: String(h).padStart(2, '0'), mm, p: '' };
  return { hh: String(h % 12 || 12).padStart(2, '0'), mm, p: h < 12 ? 'ص' : 'م' };
}
function clock(hours) {
  const c = parts(hours);
  return num((CFG.clock24 ? c.hh : String(Number(c.hh))) + ':' + c.mm) + (c.p ? ' ' + c.p : '');
}
function hijri(y, m, d) {
  const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const p = f.formatToParts(new Date(Date.UTC(y, m - 1, d + CFG.hijriAdjust)));
  const g = (t) => Number(p.find((x) => x.type === t).value);
  return { day: g('day'), month: g('month'), year: g('year') };
}
// The calendar day at the location, \`offset\` days from today.
function dateOnly(offset) {
  const now = new Date();
  const local = new Date(now.getTime() + tzOffset(CFG.tz, now) * 3600000);
  const base = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + offset));
  const y = base.getUTCFullYear(), m = base.getUTCMonth() + 1, d = base.getUTCDate();
  return { y, m, d, h: hijri(y, m, d), wd: base.getUTCDay(), weekday: WEEKDAYS[base.getUTCDay()], n: Math.floor(Date.UTC(y, m - 1, d) / 86400000) };
}
function day(offset) {
  const dd = dateOnly(offset);
  const { y, m, d, h } = dd;
  const tz = tzOffset(CFG.tz, new Date(Date.UTC(y, m - 1, d, 12)));
  const ishaMinutes = h.month === 9 && CFG.ramadanIshaMinutes ? CFG.ramadanIshaMinutes : CFG.ishaMinutes;
  const raw = solarTimes(y, m, d, CFG.lat, CFG.lng, tz, { fajr: CFG.fajr, isha: CFG.isha, ishaMinutes, asr: CFG.asr });
  const times = {};
  for (const k of Object.keys(NAMES)) {
    const min = Math.round(raw[k] * 60 + (CFG.offsets[k] || 0));
    times[k] = { key: k, name: NAMES[k], hours: min / 60, at: new Date(Date.UTC(y, m - 1, d) + (min - tz * 60) * 60000) };
  }
  times.duha = { key: 'duha', name: 'الضحى', hours: times.sunrise.hours + 0.25, at: new Date(times.sunrise.at.getTime() + 15 * 60000) };
  return { ...dd, times };
}

const today = day(0);
const tomorrow = day(1);
const now = new Date();
const friday = today.wd === 5;
const order = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
let next = order.map((k) => today.times[k]).find((t) => t.at > now);
if (!next) next = tomorrow.times.fajr;
if (friday && next.key === 'dhuhr') next = { ...next, name: 'الجمعة' };
const passed = order.map((k) => today.times[k]).filter((t) => t.at <= now).pop();
const prev = passed || day(-1).times.isha;
const current = passed && today.times[END[passed.key]].at > now ? { ...passed, end: today.times[END[passed.key]] } : null;
const iqamaMin = (CFG.iqama && CFG.iqama[next.key]) || 0;
const iqamaAt = new Date(next.at.getTime() + iqamaMin * 60000);

const hijriText = num(today.h.day) + ' ' + HIJRI_MONTHS[today.h.month - 1] + ' ' + num(today.h.year) + ' هـ';
const gregText = num(today.d) + ' ' + GREG_MONTHS[today.m - 1] + ' ' + num(today.y) + ' م';
const pad = (n) => String(n).padStart(2, '0');
const hijriNum = num(today.h.year + '-' + pad(today.h.month) + '-' + pad(today.h.day));
const gregNum = num(today.y + '-' + pad(today.m) + '-' + pad(today.d));

const TH = THEMES[themeWord] || THEMES[DEFAULT_THEME[style]] || THEMES['زمردي'];
const FG = new Color(TH.fg);
const SOFT = new Color(TH.fg, 0.66);
const ACC = new Color(TH.acc);
const CARD = new Color(TH.light ? '#000000' : '#ffffff', TH.light ? 0.06 : 0.12);
const TRACK = new Color(TH.fg, 0.18);
const family = config.widgetFamily || (style === 'sunnah' || style === 'wudu' ? 'small' : 'medium');
const big = family === 'large';
const small = family === 'small';

const w = new ListWidget();
w.url = CFG.url;
let refresh = Math.min(next.at.getTime() + 60000, now.getTime() + 30 * 60000);
if (style === 'dhikr' || style === 'mine') refresh = Math.min(refresh, now.getTime() + 60 * 60000);
if (style === 'sunnah' || style === 'circle' || style === 'track') refresh = Math.min(refresh, now.getTime() + 10 * 60000);
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
// A row with its content in the middle.
function middle(stack) {
  const r = stack.addStack();
  r.addSpacer();
  const inner = r.addStack();
  r.addSpacer();
  return inner;
}
function timer(stack, date, font, color, align) {
  const r = align === 'center' ? middle(stack) : right(stack);
  const t = r.addDate(date);
  t.applyTimerStyle();
  t.font = font;
  t.textColor = color;
  if (align === 'center') t.centerAlignText();
  else t.rightAlignText();
  return t;
}
function symbol(stack, name, size, color) {
  const s = SFSymbol.named(name);
  if (!s) return null;
  const img = stack.addImage(s.image);
  img.imageSize = new Size(size, size);
  img.tintColor = color;
  return img;
}
function background() {
  const g = new LinearGradient();
  g.colors = TH.bg.map((c) => new Color(c));
  g.locations = [0, 1];
  g.startPoint = new Point(0, 0);
  g.endPoint = new Point(1, 1);
  w.backgroundGradient = g;
  w.setPadding(14, 14, 14, 14);
}
const hourIndex = (list) => list.length ? list[(today.n * 24 + now.getHours()) % list.length] : '';
const clamp = (x) => Math.max(0, Math.min(1, x));

// A rounded progress bar, filled from the right.
function bar(width, frac, height) {
  const c = new DrawContext();
  c.size = new Size(width, height);
  c.opaque = false;
  c.respectScreenScale = true;
  const p = new Path();
  p.addRoundedRect(new Rect(0, 0, width, height), height / 2, height / 2);
  c.addPath(p);
  c.setFillColor(TRACK);
  c.fillPath();
  if (frac > 0) {
    const f = Math.max(height, width * frac);
    const q = new Path();
    q.addRoundedRect(new Rect(width - f, 0, f, height), height / 2, height / 2);
    c.addPath(q);
    c.setFillColor(frac >= 1 ? FG : ACC);
    c.fillPath();
  }
  return c.getImage();
}
// A ring filled clockwise from the top.
function ring(size, frac, lw) {
  const c = new DrawContext();
  c.size = new Size(size, size);
  c.opaque = false;
  c.respectScreenScale = true;
  c.setStrokeColor(TRACK);
  c.setLineWidth(lw);
  c.strokeEllipse(new Rect(lw / 2, lw / 2, size - lw, size - lw));
  if (frac > 0) {
    const r = (size - lw) / 2, cx = size / 2;
    const n = Math.max(2, Math.round(160 * frac));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = -Math.PI / 2 + 2 * Math.PI * frac * (i / n);
      pts.push(new Point(cx + r * Math.cos(a), cx + r * Math.sin(a)));
    }
    const p = new Path();
    p.addLines(pts);
    c.addPath(p);
    c.setStrokeColor(ACC);
    c.setLineWidth(lw);
    c.strokePath();
  }
  return c.getImage();
}
// How far each prayer's time has run: full once the next prayer has come.
function progressOf(k) {
  const i = order.indexOf(k);
  const start = today.times[k].at.getTime();
  const end = (i < 4 ? today.times[order[i + 1]] : tomorrow.times.fajr).at.getTime();
  return clamp((now.getTime() - start) / (end - start));
}
const LOCAL = (ms) => {
  const d = new Date(ms + tzOffset(CFG.tz, new Date(ms)) * 3600000);
  return { hours: d.getUTCHours() + d.getUTCMinutes() / 60, wd: d.getUTCDay() };
};

// ---- Lock screen ----
const WHITE = Color.white();
if (family === 'accessoryInline') {
  if (style === 'date') w.addText(today.weekday + ' ' + num(today.h.day) + ' ' + HIJRI_MONTHS[today.h.month - 1]);
  else if (style === 'sunnah') w.addText('الآن: ' + sunnahNow(today.times, now.getTime(), CFG.iqama, friday).title);
  else if (style === 'wudu') w.addText(wudu.on ? 'على وضوء منذ ' + clock(LOCAL(wudu.at).hours) : 'لست على وضوء');
  else w.addText(next.name + ' ' + clock(next.hours) + ' • ' + num(today.h.day) + ' ' + HIJRI_MONTHS[today.h.month - 1]);
} else if (family === 'accessoryCircular') {
  w.addAccessoryWidgetBackground = true;
  const s = w.addStack();
  s.layoutVertically();
  if (style === 'date') {
    text(s, num(today.h.day), Font.boldRoundedSystemFont(22), WHITE, 'center');
    text(s, HIJRI_MONTHS[today.h.month - 1], Font.systemFont(9), WHITE, 'center');
  } else if (style === 'wudu') {
    const r = middle(s);
    symbol(r, wudu.on ? 'drop.fill' : 'drop', 22, WHITE);
    w.url = wuduUrl();
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
  } else if (style === 'sunnah') {
    const sn = sunnahNow(today.times, now.getTime(), CFG.iqama, friday);
    line(w, 'الآن', Font.systemFont(11), WHITE);
    line(w, sn.title, Font.boldSystemFont(15), WHITE);
    line(w, sn.sub, Font.systemFont(11), WHITE, 2);
  } else if (style === 'wudu') {
    w.url = wuduUrl();
    line(w, wudu.on ? 'على وضوء' : 'لست على وضوء', Font.boldSystemFont(15), WHITE);
    line(w, wudu.at ? 'منذ ' + clock(LOCAL(wudu.at).hours) : 'اضغط للتسجيل', Font.systemFont(12), WHITE);
  } else {
    line(w, next.name + '  ' + clock(next.hours), Font.boldSystemFont(15), WHITE);
    timer(w, next.at, Font.semiboldRoundedSystemFont(13), WHITE);
    line(w, current ? 'يخرج وقت ' + current.name + ' ' + clock(current.end.hours) : hijriText, Font.systemFont(12), WHITE);
  }

// ---- Home screen ----
} else if (style === 'track') {
  // «مسار الصلوات»: the five prayers, each with how far its time has run.
  background();
  const head = w.addStack();
  head.centerAlignContent();
  text(head, CFG.place, Font.mediumSystemFont(12), SOFT);
  head.addSpacer();
  text(head, today.weekday, Font.boldSystemFont(13), FG);
  w.addSpacer();
  if (small) {
    for (const k of order) {
      const t = today.times[k];
      const on = t.key === next.key && t.at.getTime() === next.at.getTime();
      const r = w.addStack();
      r.centerAlignContent();
      text(r, clock(t.hours).replace(/ [صم]$/, ''), Font.semiboldRoundedSystemFont(12), on ? ACC : FG);
      r.addSpacer(6);
      r.addImage(bar(34, progressOf(k), 4)).imageSize = new Size(34, 4);
      r.addSpacer();
      text(r, t.name, Font.mediumSystemFont(12), on ? ACC : SOFT);
      w.addSpacer(3);
    }
  } else {
    const row = w.addStack();
    for (const k of [...order].reverse()) {
      const t = today.times[k];
      const on = t.key === next.key && t.at.getTime() === next.at.getTime();
      const col = row.addStack();
      col.layoutVertically();
      col.size = new Size(58, 0);
      text(middle(col), k === 'dhuhr' && friday ? 'الجمعة' : t.name, Font.semiboldSystemFont(13), on ? ACC : FG, 'center');
      col.addSpacer(5);
      const b = middle(col).addImage(bar(46, progressOf(k), 6));
      b.imageSize = new Size(46, 6);
      col.addSpacer(5);
      text(middle(col), clock(t.hours).replace(/ [صم]$/, ''), Font.semiboldRoundedSystemFont(14), on ? ACC : FG, 'center');
      if (k !== 'fajr') row.addSpacer();
    }
    w.addSpacer();
    const foot = w.addStack();
    text(foot, hijriNum, Font.mediumSystemFont(11), SOFT);
    foot.addSpacer();
    text(foot, gregNum, Font.mediumSystemFont(11), SOFT);
  }
} else if (style === 'circle') {
  // «دائرة الصلاة»: the next prayer in a ring that fills up to its adhan.
  background();
  const frac = clamp((now.getTime() - prev.at.getTime()) / (next.at.getTime() - prev.at.getTime()));
  const ringBlock = (stack, size) => {
    const r = stack.addStack();
    r.size = new Size(size, size);
    r.backgroundImage = ring(size, frac, small ? 7 : 8);
    r.layoutVertically();
    r.centerAlignContent();
    r.addSpacer();
    text(middle(r), next.name, Font.boldSystemFont(size > 120 ? 22 : 18), FG, 'center');
    timer(r, next.at, Font.semiboldRoundedSystemFont(size > 120 ? 17 : 14), ACC, 'center');
    if (small) text(middle(r), clock(next.hours), Font.mediumSystemFont(11), SOFT, 'center');
    r.addSpacer();
  };
  const box = (stack, sym, label, value) => {
    const b = stack.addStack();
    b.backgroundColor = CARD;
    b.cornerRadius = 14;
    b.setPadding(8, 10, 8, 10);
    b.size = new Size(150, 54);
    b.centerAlignContent();
    const tx = b.addStack();
    tx.layoutVertically();
    line(tx, label, Font.mediumSystemFont(11), SOFT);
    line(tx, value, Font.boldRoundedSystemFont(17), FG);
    b.addSpacer(8);
    const ic = b.addStack();
    ic.backgroundColor = CARD;
    ic.cornerRadius = 9;
    ic.setPadding(6, 6, 6, 6);
    symbol(ic, sym, 18, FG);
  };
  if (small) {
    const r = middle(w);
    ringBlock(r, 124);
  } else {
    const main = w.addStack();
    main.centerAlignContent();
    const boxes = main.addStack();
    boxes.layoutVertically();
    box(boxes, 'sun.max.fill', 'الأذان', clock(next.hours));
    boxes.addSpacer(10);
    box(boxes, 'person.2.fill', 'الإقامة', iqamaMin ? clock(next.hours + iqamaMin / 60) : '—');
    main.addSpacer();
    ringBlock(main, 128);
  }
} else if (style === 'timeayah') {
  // «آية ووقت الصلاة»: the next prayer's time in big digits, with a short ayah.
  background();
  const short = AYAT.filter((a) => a[0].length <= 50);
  const ayah = short[today.n % short.length] || AYAT[0];
  const c = parts(next.hours);
  const digits = (stack, size) => {
    const r = stack.addStack();
    r.bottomAlignContent();
    text(r, num(c.hh), Font.heavyRoundedSystemFont(size), FG);
    text(r, num(c.mm), Font.heavyRoundedSystemFont(size), SOFT);
  };
  if (small) {
    line(w, ayah[0], Font.semiboldSystemFont(13), ACC, 2);
    w.addSpacer();
    const r = right(w);
    digits(r, 40);
    line(w, next.name + (c.p ? ' • ' + c.p : ''), Font.boldSystemFont(14), FG);
    line(w, today.weekday + ' ' + num(today.d), Font.systemFont(11), SOFT);
  } else {
    const main = w.addStack();
    main.centerAlignContent();
    const left = main.addStack();
    left.layoutVertically();
    digits(left, 52);
    const nm = left.addStack();
    nm.addSpacer();
    text(nm, next.name + (c.p ? ' (' + c.p + ')' : ''), Font.boldSystemFont(16), SOFT);
    nm.addSpacer();
    main.addSpacer(14);
    const rightCol = main.addStack();
    rightCol.layoutVertically();
    line(rightCol, ayah[0], Font.boldSystemFont(15), FG, 2).minimumScaleFactor = 0.6;
    rightCol.addSpacer(8);
    const pill = right(rightCol);
    const pp = pill.addStack();
    pp.backgroundColor = CARD;
    pp.cornerRadius = 14;
    pp.setPadding(4, 10, 4, 4);
    pp.centerAlignContent();
    text(pp, num(today.d), Font.boldRoundedSystemFont(16), FG);
    pp.addSpacer(8);
    const wdp = pp.addStack();
    wdp.backgroundColor = ACC;
    wdp.cornerRadius = 11;
    wdp.setPadding(3, 10, 3, 10);
    text(wdp, today.weekday, Font.boldSystemFont(13), new Color(TH.bg[1]));
    rightCol.addSpacer(6);
    line(rightCol, hijriNum, Font.mediumSystemFont(11), SOFT);
  }
} else if (style === 'week') {
  // «الأسبوع والذكر»: this week's Hijri days and a dhikr, with the next prayer.
  background();
  const nextCard = (stack, wide) => {
    const c = stack.addStack();
    c.layoutVertically();
    c.backgroundColor = CARD;
    c.cornerRadius = 16;
    c.setPadding(10, 10, 10, 10);
    if (wide) c.size = new Size(116, 0);
    const top = right(c);
    symbol(top, 'sun.max.fill', 16, FG);
    line(c, next.name, Font.boldSystemFont(wide ? 22 : 26), FG);
    c.addSpacer();
    timer(c, next.at, Font.semiboldRoundedSystemFont(wide ? 17 : 22), SOFT);
    line(c, clock(next.hours), Font.boldRoundedSystemFont(wide ? 16 : 20), FG);
    line(c, CFG.place, Font.systemFont(10), SOFT);
  };
  if (small) {
    nextCard(w, false);
    w.addSpacer(6);
    line(w, today.weekday + '، ' + num(today.h.day) + ' ' + HIJRI_MONTHS[today.h.month - 1], Font.semiboldSystemFont(12), FG);
  } else {
    const main = w.addStack();
    const left = main.addStack();
    left.layoutVertically();
    const head = left.addStack();
    text(head, num(today.h.year), Font.semiboldRoundedSystemFont(13), SOFT);
    head.addSpacer();
    text(head, HIJRI_MONTHS[today.h.month - 1], Font.boldSystemFont(14), FG);
    left.addSpacer(6);
    const card = left.addStack();
    card.layoutVertically();
    card.backgroundColor = CARD;
    card.cornerRadius = 14;
    card.setPadding(8, 6, 8, 6);
    const days = card.addStack();
    for (let i = 6; i >= 0; i--) {
      const dd = dateOnly(i - today.wd);
      const col = days.addStack();
      col.layoutVertically();
      col.size = new Size(26, 0);
      text(middle(col), WD_SHORT[i], Font.mediumSystemFont(10), SOFT, 'center');
      col.addSpacer(3);
      const cell = middle(col).addStack();
      cell.size = new Size(24, 24);
      cell.cornerRadius = 12;
      cell.centerAlignContent();
      if (i === today.wd) cell.backgroundColor = FG;
      const t = cell.addText(num(dd.h.day));
      t.font = Font.boldRoundedSystemFont(13);
      t.textColor = i === today.wd ? new Color(TH.bg[0]) : FG;
      t.centerAlignText();
      if (i) days.addSpacer();
    }
    card.addSpacer(6);
    const q = middle(card);
    const dt = q.addText(hourIndex(MINE.length ? MINE : DHIKR) || DHIKR[0]);
    dt.font = Font.semiboldSystemFont(13);
    dt.textColor = FG;
    dt.lineLimit = 2;
    dt.minimumScaleFactor = 0.6;
    dt.centerAlignText();
    main.addSpacer(8);
    nextCard(main, true);
  }
} else if (style === 'sunnah') {
  // «سنة الآن»: what to pray (or read) now, and how long since the adhan.
  background();
  const sn = sunnahNow(today.times, now.getTime(), CFG.iqama, friday);
  const head = w.addStack();
  head.centerAlignContent();
  text(head, 'الآن', Font.semiboldSystemFont(12), SOFT);
  head.addSpacer();
  const ic = head.addStack();
  ic.backgroundColor = CARD;
  ic.cornerRadius = 12;
  ic.setPadding(8, 8, 8, 8);
  symbol(ic, 'sparkles', small ? 20 : 22, ACC);
  w.addSpacer();
  line(w, sn.title, Font.boldSystemFont(small ? 20 : 22), FG, 2);
  line(w, sn.sub, Font.systemFont(small ? 11 : 12), SOFT, 2);
  if (!small && sn.since && sn.since.minutes < 240) {
    w.addSpacer(4);
    const m = sn.since.minutes;
    line(w, 'مضى على أذان ' + sn.since.name + ' ' + (m >= 60 ? num(Math.floor(m / 60)) + ' س ' : '') + num(m % 60) + ' د', Font.mediumSystemFont(11), ACC);
  }
} else if (style === 'wudu') {
  // «متابعة الوضوء»: tap to record wudu (or that it is broken).
  background();
  w.url = wuduUrl() + (themeWord ? '&theme=' + encodeURIComponent(themeWord) : '');
  const since = wudu.at ? LOCAL(wudu.at) : null;
  const sinceText = since ? WEEKDAYS[since.wd] + ' ' + clock(since.hours) : 'اضغط لتسجيل وضوئك';
  const body = (stack) => {
    const ic = middle(stack);
    symbol(ic, wudu.on ? 'hands.and.sparkles.fill' : 'hand.raised', 34, wudu.on ? ACC : SOFT);
    stack.addSpacer(6);
    text(middle(stack), wudu.on ? 'على وضوء' : 'لست على وضوء', Font.boldSystemFont(19), FG, 'center');
    text(middle(stack), sinceText, Font.mediumSystemFont(12), SOFT, 'center');
    stack.addSpacer(8);
    const b = middle(stack).addStack();
    b.backgroundColor = CARD;
    b.cornerRadius = 15;
    b.setPadding(6, 14, 6, 14);
    symbol(b, 'arrow.triangle.2.circlepath', 16, FG);
  };
  if (small) {
    w.addSpacer();
    body(w);
    w.addSpacer();
  } else {
    const main = w.addStack();
    main.centerAlignContent();
    const tips = main.addStack();
    tips.layoutVertically();
    line(tips, 'متابعة الوضوء', Font.boldSystemFont(15), FG);
    line(tips, 'اضغط على الويدجت عند الوضوء، ومرة أخرى إذا انتقض', Font.systemFont(11), SOFT, 3);
    main.addSpacer(12);
    const col = main.addStack();
    col.layoutVertically();
    body(col);
  }
} else if (style === 'date') {
  background();
  if (small) {
    const top = middle(w);
    text(top, HIJRI_MONTHS[today.h.month - 1] + ' ', Font.boldSystemFont(14), FG);
    text(top, today.weekday, Font.boldSystemFont(14), ACC);
    w.addSpacer();
    text(middle(w), num(today.h.day), Font.heavyRoundedSystemFont(64), FG, 'center');
    w.addSpacer();
    text(middle(w), num(today.d) + ' ' + GREG_MONTHS[today.m - 1], Font.mediumSystemFont(14), SOFT, 'center');
  } else {
    const main = w.addStack();
    main.centerAlignContent();
    main.addSpacer();
    const tx = main.addStack();
    tx.layoutVertically();
    line(tx, HIJRI_MONTHS[today.h.month - 1] + ' ' + num(today.h.year), Font.boldSystemFont(20), FG);
    line(tx, today.weekday, Font.boldSystemFont(20), ACC);
    line(tx, num(today.d) + ' ' + GREG_MONTHS[today.m - 1] + ' ' + num(today.y), Font.mediumSystemFont(17), SOFT);
    main.addSpacer(20);
    text(main, num(today.h.day), Font.heavyRoundedSystemFont(84), FG);
    main.addSpacer();
    if (big) {
      w.addSpacer(16);
      for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        const t = today.times[k];
        const r = w.addStack();
        text(r, clock(t.hours), Font.semiboldRoundedSystemFont(15), FG);
        r.addSpacer();
        text(r, t.name, Font.mediumSystemFont(15), SOFT);
        w.addSpacer(6);
      }
    }
  }
} else if (style === 'night') {
  background();
  const keys = ['sunrise', 'midnight', 'lastThird'];
  if (small) {
    text(middle(w), CFG.place, Font.semiboldSystemFont(12), ACC, 'center');
    text(middle(w), today.weekday, Font.boldSystemFont(24), FG, 'center');
    w.addSpacer();
    for (const k of keys) {
      const r = w.addStack();
      text(r, clock(today.times[k].hours).replace(/ [صم]$/, ''), Font.semiboldRoundedSystemFont(13), FG);
      r.addSpacer();
      text(r, today.times[k].name, Font.mediumSystemFont(13), FG);
      w.addSpacer(3);
    }
  } else {
    const head = right(w);
    text(head, num(today.d) + ' ' + GREG_MONTHS[today.m - 1] + ' ', Font.boldSystemFont(24), SOFT);
    text(head, today.weekday + ' ', Font.heavySystemFont(24), FG);
    text(head, CFG.place, Font.boldSystemFont(24), SOFT);
    w.addSpacer();
    const row = w.addStack();
    for (const k of [...keys].reverse()) {
      const col = row.addStack();
      col.layoutVertically();
      text(middle(col), today.times[k].name, Font.semiboldSystemFont(14), FG, 'center');
      text(middle(col), clock(today.times[k].hours).replace(/ [صم]$/, ''), Font.boldRoundedSystemFont(17), FG, 'center');
      if (k !== 'sunrise') row.addSpacer();
    }
  }
} else if (style === 'countdown') {
  background();
  line(w, 'الصلاة القادمة', Font.systemFont(12), SOFT);
  line(w, next.name, Font.boldSystemFont(small ? 26 : 32), FG);
  timer(w, next.at, Font.boldRoundedSystemFont(small ? 26 : 34), ACC);
  line(w, 'الساعة ' + clock(next.hours), Font.mediumSystemFont(12), SOFT);
  w.addSpacer();
  if (current) {
    line(w, 'يخرج وقت ' + current.name, Font.semiboldSystemFont(12), FG);
    timer(w, current.end.at, Font.mediumRoundedSystemFont(12), SOFT);
  } else line(w, today.weekday + '، ' + hijriText, Font.systemFont(11), SOFT);
} else if (style === 'ayah' || style === 'dhikr' || style === 'mine') {
  const ayah = style === 'ayah' ? AYAT[today.n % AYAT.length] : null;
  const body = ayah ? '﴿' + ayah[0] + '﴾' : hourIndex(style === 'mine' ? MINE : DHIKR) || 'أضف أذكارك في التطبيق ثم انسخ الكود من جديد';
  background();
  line(w, style === 'ayah' ? 'آية اليوم' : style === 'mine' ? 'من أذكاري' : 'ذكر', Font.semiboldSystemFont(12), ACC);
  w.addSpacer();
  const t = line(w, body, Font.boldSystemFont(small ? 15 : big ? 22 : 18), FG, small ? 5 : big ? 10 : 4);
  t.minimumScaleFactor = 0.4;
  w.addSpacer();
  line(w, ayah ? ayah[1] : today.weekday + ' • ' + hijriText, Font.systemFont(10), SOFT);
} else {
  background();
  const nextBlock = (stack) => {
    line(stack, today.weekday + ' • ' + hijriText, Font.semiboldSystemFont(11), ACC);
    if (!small) line(stack, gregText, Font.systemFont(10), SOFT);
    stack.addSpacer();
    line(stack, 'الصلاة القادمة', Font.systemFont(10), SOFT);
    line(stack, next.name, Font.boldSystemFont(small ? 20 : 22), FG);
    line(stack, clock(next.hours), Font.boldRoundedSystemFont(small ? 22 : 26), FG);
    timer(stack, next.at, Font.mediumRoundedSystemFont(12), ACC);
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
        row.backgroundColor = CARD;
        row.cornerRadius = 6;
      }
      row.setPadding(2, 6, 2, 6);
      text(row, clock(t.hours), Font.semiboldRoundedSystemFont(12), on ? ACC : FG);
      row.addSpacer();
      text(row, t.name, Font.mediumSystemFont(12), on ? ACC : SOFT);
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
      q.backgroundColor = CARD;
      q.cornerRadius = 12;
      q.setPadding(10, 10, 10, 10);
      q.addSpacer();
      const t = text(q, DHIKR[today.n % DHIKR.length], Font.semiboldSystemFont(15), FG);
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
