// Home: Hijri and Gregorian dates, the next moment (a prayer, sunrise, Duha, midnight, the
// last third) with a countdown, the adhan and iqama line, and the day's times.

import { CATEGORY_BY_ID, DAILY } from '../adhkar-data.js';
import { wirdDone } from './adhkar.js';
import { dailyFor } from '../daily-data.js';
import { clock, clockText, countdown, GREG_MONTHS, HIJRI_MONTHS, gregText, hijri, hijriText, minutesText, num, weekday } from '../dates.js';
import { icon, PRAYER_ICONS } from '../icons.js';
import { addDays, dayKey, dayTimes, DUHA_END, DUHA_START, METHODS } from '../prayer.js';
import { weekStrip } from './calendar.js';
import { firstKhatma, state } from '../store.js';
import { PRAYERS, today } from '../today.js';
import { juzOf, khatmaInfo } from '../khatma.js';
import { $, copyText, esc, ring, shareText } from '../ui.js';
import { APP_NAME } from '../config.js';
import { dayScore } from './worship.js';

// Shortcuts: two columns of pills, each with its round icon.
const QUICK = [
  ['#/adhkar/morning', 'أذكار الصباح', 'sun'],
  ['#/adhkar/evening', 'أذكار المساء', 'moonStar'],
  ['#/tasbeeh', 'السبحة', 'beads'],
  ['#/mine', 'أذكاري', 'heart'],
  ['#/notebook', 'أدعيتي', 'hand'],
  ['#/khatma', 'الختمات', 'quran'],
  ['#/calendar', 'التقويم', 'calendar'],
  ['#/rawatib', 'النوافل', 'mosque'],
  ['#/reminders', 'تذكيراتي', 'bell'],
  ['#/audio', 'الصوتيات', 'play'],
  ['#/tools', 'الأدوات', 'widget'],
  ['#/counter', 'العداد', 'hash'],
];

// The day and the months as a calligrapher writes them: vowelled, the day drawn out.
const DAY_HAND = ['الأَحَـــد', 'الإِثْنَـــيْن', 'الثُّلَاثَـــاء', 'الأَرْبِعَـــاء', 'الخَمِيـــس', 'الجُمُعَـــة', 'السَّبْـــت'];
const HIJRI_HAND = ['مُحَرَّم', 'صَفَر', 'رَبِيعٌ ٱلْأَوَّل', 'رَبِيعٌ ٱلْآخِر', 'جُمَادَىٰ ٱلْأُولَىٰ', 'جُمَادَىٰ ٱلْآخِرَة', 'رَجَب', 'شَعْبَان', 'رَمَضَان', 'شَوَّال', 'ذُو ٱلْقَعْدَة', 'ذُو ٱلْحِجَّة'];
const GREG_HAND = ['يَنَايِر', 'فِبْرَايِر', 'مَارِس', 'أَبْرِيل', 'مَايُو', 'يُونْيُو', 'يُولْيُو', 'أَغُسْطُس', 'سِبْتَمْبِر', 'أُكْتُوبَر', 'نُوفَمْبِر', 'دِيسَمْبِر'];

let dayOffset = 0; // the day shown in the times card: 0 today, -1 yesterday, 1 tomorrow…

// The four moments shown under the prayers, in the order of the day.
const MOMENTS = ['sunrise', 'duha', 'midnight', 'lastThird'];
const MOMENT_NOTE = {
  fajr: 'يدخل وقت صلاة الفجر',
  dhuhr: 'يدخل وقت صلاة الظهر',
  asr: 'يدخل وقت صلاة العصر',
  maghrib: 'تغرب الشمس، ويدخل وقت المغرب',
  isha: 'يدخل وقت صلاة العشاء',
  sunrise: 'تطلع الشمس، وينتهي وقت الفجر',
  get duha() {
    return `بعد الشروق بـ${num(DUHA_START)} دقيقة إلى قبل الظهر بـ${num(DUHA_END)} دقيقة`;
  },
  midnight: 'نصف الليل بين المغرب والفجر',
  lastThird: 'وقت نزول ربنا واستجابة الدعاء',
};

export function render(view) {
  const s = state.settings;
  const info = today();
  const daily = DAILY[(info.day.d + info.day.m * 3) % DAILY.length];
  const d = dailyFor(info.day);
  const texts = {
    ayah: `﴿${d.ayah.text}﴾ [${d.ayah.ref}]`,
    hadith: `قال رسول الله ﷺ: ${d.hadith.text} ${d.hadith.ref}`,
    advice: d.advice.text,
    dhikr: `${daily.text} — ${daily.note}`,
  };

  const h = hijri(info.day, s.hijriAdjust);
  view.innerHTML = `
  <section class="hx-hero">
    <div class="hx-top">
      <button class="hx-btn" data-nav aria-label="القائمة">${icon('rows', 22)}</button>
      <b class="hx-brand">${APP_NAME}</b>
      <span class="hx-top-end">
        <button class="hx-btn" data-search aria-label="بحث">${icon('search', 21)}</button>
        <a class="hx-btn" href="#/settings" aria-label="الإعدادات">${icon('gear', 21)}</a>
      </span>
    </div>
    <div class="hx-day">
      <div><h1>${DAY_HAND[new Date(Date.UTC(info.day.y, info.day.m - 1, info.day.d)).getUTCDay()]}</h1><a href="#/settings/location">${esc(s.location.name)}</a></div>
      <span class="hx-moon" title="القمر الليلة">${moonPhase(h.day)}</span>
    </div>
    <a class="hx-dates" href="#/calendar">
      <span><b><em>${num(h.day)}</em> ${HIJRI_HAND[h.month - 1]}</b><small>${num(h.year)} هـ</small></span>
      <span><b><em>${num(info.day.d)}</em> ${GREG_HAND[info.day.m - 1]}</b><small>${num(info.day.y)} م</small></span>
    </a>
    <div class="hx-pill"><span><b data-next-name>${esc(info.nextPrayer.name)}</b> بعد</span><strong data-countdown>${countdown(info.nextPrayer.at - Date.now())}</strong></div>
    <div class="h-leave hx-leave" data-leave>${leaveText(info)}</div>
  </section>

  ${info.isFriday ? `<div class="banner gold">${icon('stars', 22)}<div><b>جمعة مباركة</b><span>الإكثار من الصلاة على النبي ﷺ، وتحرّي ساعة الإجابة</span></div></div>` : ''}

  <div class="hx-body">
    ${wirdNow(info)}
    <div data-period-tile>${nowTile(info)}</div>

    <nav class="hx-grid" aria-label="اختصارات">
      ${QUICK.map(([href, label, ic]) => `<a href="${href}"><span>${icon(ic, 21)}</span><b>${label}</b></a>`).join('')}
    </nav>

    ${khatmaCard()}
    ${prayersCard(info)}
    ${worshipCard(info)}
    <a class="card hx-week" href="#/calendar">
      <div class="hx-head"><h2>التقويم</h2><small>${GREG_MONTHS[info.day.m - 1]} ${num(info.day.y)} · ${HIJRI_MONTHS[h.month - 1]}</small></div>
      <ul>${weekStrip(info)}</ul>
    </a>
    ${momentsCard(info)}
  </div>

  <h3 class="section-title small h-title">${icon('stars', 16)} زاد اليوم</h3>
  <section class="today-cards" data-cards>
    ${todayCard('ayah', 'آية اليوم', 'quran', `<span class="hafs ayah"><span class="ayah-br">﴿</span>${esc(d.ayah.text)}<span class="ayah-br">﴾</span></span>`, d.ayah.ref)}
    ${todayCard('hadith', 'حديث اليوم', 'quote', esc(d.hadith.text), d.hadith.ref)}
    ${todayCard('advice', 'نصيحة اليوم', 'heart', esc(d.advice.text), '')}
    ${todayCard('dhikr', 'ذكر اليوم', 'beads', esc(daily.text), daily.note)}
  </section>
  <div class="dots" data-dots>${[0, 1, 2, 3].map((i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;

  let lastTile = nowTile(info);
  view.addEventListener('click', onClick);
  const cards = $('[data-cards]', view);
  cards.addEventListener('scroll', () => {
    const i = Math.round(Math.abs(cards.scrollLeft) / cards.clientWidth);
    [...$('[data-dots]', view).children].forEach((dot, j) => dot.classList.toggle('on', i === j));
  }, { passive: true });
  return {
    tick() {
      const info2 = today();
      // Redraw when the day, the next moment, or the kind of time changes.
      if (info2.key !== info.key || info2.next.at !== info.next.at || info2.nextPrayer.at !== info.nextPrayer.at || info2.period.key !== info.period.key) {
        return 'rerender';
      }
      $('[data-countdown]', view).textContent = countdown(info2.nextPrayer.at - Date.now());
      $('[data-leave]', view).innerHTML = leaveText(info2);
      const p2 = nowTile(info2);
      if (p2 !== lastTile) $('[data-period-tile]', view).innerHTML = lastTile = p2;
    },
    destroy() {
      view.removeEventListener('click', onClick);
    },
  };

  function onClick(e) {
    if (e.target.closest('[data-search]')) return import('./search.js').then((m) => m.openSearch());
    const nav = e.target.closest('[data-pday]');
    if (nav) {
      dayOffset = nav.dataset.pday === '0' ? 0 : dayOffset + Number(nav.dataset.pday);
      const now = today();
      $('[data-prayers]', view).outerHTML = prayersCard(now);
      $('[data-moments]', view).outerHTML = momentsCard(now);
      return;
    }
    const act = e.target.closest('[data-card-act]');
    if (act) {
      const [kind, what] = act.dataset.cardAct.split(':');
      return what === 'copy' ? copyText(texts[kind]) : shareText(texts[kind]);
    }
  }
}

// How far the day has moved from the last moment to the next one.
function progress(info) {
  const span = info.next.at - info.prev.at;
  return Math.max(0, Math.min(100, ((Date.now() - info.prev.at) / span) * 100));
}

// The sentence under the countdown: what the coming moment is.
function endsText(info) {
  return `<span>${icon(PRAYER_ICONS[info.next.key] || 'clock', 15)} ${esc(MOMENT_NOTE[info.next.key] || '')}</span>`;
}

// The adhkar for this time of the day, as the first card under the dates.
function wirdNow(info) {
  const now = Date.now();
  const t = info.times;
  const id = now >= t.fajr.at && now < t.asr.at ? 'morning' : now >= t.asr.at && now < t.isha.at ? 'evening' : 'sleep';
  const cat = CATEGORY_BY_ID[id];
  const done = wirdDone(cat);
  const all = cat.items.length;
  const fin = done === all;
  return `<a class="hx-now" href="#/adhkar/${id}">
    <span class="hx-now-ic">${icon(fin ? 'check' : cat.icon, 24)}</span>
    <span class="hx-now-text"><b>${esc(cat.title)} <em>· ${fin ? 'تمّت' : 'الآن'}</em></b><small>${fin ? 'تقبّل الله منك' : done ? `قرأت ${num(done)} من ${num(all)}` : esc(cat.subtitle)}</small></span>
    ${icon('back', 20, 'hx-go')}</a>`;
}

// The moment coming (or, around a prayer, its adhan and iqama), as the second card.
function nowTile(info) {
  const a = info.adhan;
  if (a) {
    const since = a.since === 0 ? `حان الآن أذان ${esc(a.name)}` : `مضى على أذان ${esc(a.name)} ${minutesText(a.since)}`;
    const iq = a.iqamaIn === null ? '' : a.iqamaIn > 0 ? `الإقامة بعد ${minutesText(a.iqamaIn)}` : a.iqamaIn === 0 ? 'حان وقت الإقامة' : `أُقيمت الصلاة منذ ${minutesText(-a.iqamaIn)}`;
    return `<div class="hx-now"><span class="hx-now-ic">${icon('mosque', 24)}</span><span class="hx-now-text"><b>${since}</b>${iq ? `<small>${iq}</small>` : ''}</span></div>`;
  }
  const n = info.next;
  return `<div class="hx-now"><span class="hx-now-ic">${icon(PRAYER_ICONS[n.key] || 'clock', 24)}</span>
    <span class="hx-now-text"><b>${esc(n.name)} <em>· قريباً</em></b><small>${esc(MOMENT_NOTE[n.key] || '')}</small></span>
    <span class="hx-now-time">${clockText(n.hours, state.settings.clock24)}</span></div>`;
}

// When the time of the prayer now in its time runs out: Fajr at sunrise, Dhuhr at Asr, Asr at
// sunset, Maghrib at Isha, and Isha at the middle of the night (its chosen time).
const LEAVES = { fajr: 'sunrise', dhuhr: 'asr', asr: 'maghrib', maghrib: 'isha', isha: 'midnight' };
function leaveText(info) {
  const p = info.lastPrayer;
  const now = Date.now();
  const end = [info.yesterday, info.times, info.tomorrow]
    .map((d) => d?.[LEAVES[p.key]]?.at)
    .filter((at) => at > p.at)
    .sort((a, b) => a - b)[0];
  if (!end || end <= now) return '';
  return `<span>${icon('clock', 15)} باقي على خروج وقت ${esc(p.name)}</span><b>${countdown(end - now)}</b>`;
}

// The kind of time it is now (Duha, the afternoon, the last third…); around a prayer, the
// minutes since its adhan and until its iqama.
function periodTile(info) {
  const a = info.adhan;
  if (a) {
    const since = a.since === 0 ? `حان الآن أذان ${esc(a.name)}` : `مضى على أذان ${esc(a.name)} ${minutesText(a.since)}`;
    const iq = a.iqamaIn === null ? '' : a.iqamaIn > 0 ? `الإقامة بعد ${minutesText(a.iqamaIn)}` : a.iqamaIn === 0 ? 'حان وقت الإقامة' : `أُقيمت الصلاة منذ ${minutesText(-a.iqamaIn)}`;
    return `<span class="h-now-bar"></span><span class="h-now-text"><b>${since}</b>${iq ? `<small>${iq}</small>` : ''}</span>`;
  }
  const n = info.period;
  return `<span class="h-now-ic">${icon(PERIOD_ICONS[n.key] || 'stars', 20)}</span>
    <span class="h-now-text"><b><small>الآن</small> ${esc(n.title)}</b><small>${esc(n.sub)}</small></span>`;
}
const PERIOD_ICONS = { sunrise: 'sunrise', duha: 'sun', zawal: 'sun', day: 'sun', night: 'moon', midnight: 'moon', qiyam: 'stars' };

// The day shown in the two time cards: today, or another day picked with the arrows.
function shownDay(info) {
  const s = state.settings;
  if (!dayOffset) return info;
  const day = addDays(info.day, dayOffset);
  return { day, times: dayTimes(day, s, hijri(day, s.hijriAdjust).month === 9), next: {}, other: true };
}

// The prayers of the day (and sunrise), each with its iqama; the arrows move to another day.
function prayersCard(info) {
  const s = state.settings;
  const shown = shownDay(info);
  const d = shown.day;
  const now = Date.now();
  const label = dayOffset === 0 ? 'اليوم' : dayOffset === 1 ? 'غداً' : dayOffset === -1 ? 'أمس' : weekday(d);
  const tiles = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].map((key) => {
    const t = shown.times[key];
    const c = clock(t.hours, s.clock24);
    const isNext = !shown.other && info.nextPrayer.at === t.at;
    const isNow = !shown.other && info.lastPrayer.at === t.at;
    const wait = s.iqama?.[key];
    const sub = key === 'sunrise' ? `الإشراق: ${clockText(shown.times.duha.hours, s.clock24)}` : wait ? `الإقامة: ${clockText(t.hours + wait / 60, s.clock24)}` : '';
    return `<li class="hx-pr ${isNext ? 'next' : ''} ${isNow ? 'now' : ''} ${!shown.other && t.at <= now && !isNow ? 'passed' : ''}">
      ${icon(PRAYER_ICONS[key], 20)}<b>${t.name}</b><strong>${c.time}<small>${c.period}</small></strong>${sub ? `<span>${sub}</span>` : ''}</li>`;
  }).join('');
  return `<section class="card hx-times" data-prayers>
    <div class="hx-head"><h2>مواقيت الصلاة</h2><a class="link" href="#/settings/method">${esc(METHODS[s.method]?.name.split(' — ')[0] || '')}</a></div>
    <div class="pday">
      <button class="icon-btn ghost sm flip" data-pday="-1" aria-label="اليوم السابق">${icon('chevron', 20)}</button>
      <button class="pday-label ${dayOffset ? 'other' : ''}" data-pday="0"><b>${label}</b><small>${weekday(d)}، ${num(d.d)} ${GREG_MONTHS[d.m - 1]} • ${hijriText(d, s.hijriAdjust)}</small></button>
      <button class="icon-btn ghost sm" data-pday="1" aria-label="اليوم التالي">${icon('chevron', 20)}</button>
    </div>
    <ul class="hx-prayers">${tiles}</ul>
  </section>`;
}

// Sunrise, Duha, the middle of the night and its last third, for the same day.
function momentsCard(info) {
  const h24 = state.settings.clock24;
  const shown = shownDay(info);
  const now = Date.now();
  const tiles = MOMENTS.map((key) => {
    const t = shown.times[key];
    const c = clock(t.hours, h24);
    const isNext = !shown.other && info.next.key === key && info.next.at === t.at;
    const ends = key === 'duha' ? shown.times.duhaEnd.at : t.at;
    const passed = !shown.other && ends <= now && !isNext && (key === 'sunrise' || key === 'duha');
    const sub = key === 'duha' ? `إلى ${clockText(shown.times.duhaEnd.hours, h24)}، قبل الظهر بـ${num(DUHA_END)} دقيقة` : MOMENT_NOTE[key];
    return `<li class="h-tile ${isNext ? 'next' : ''} ${passed ? 'passed' : ''}">
      <span class="h-tile-head">${icon(PRAYER_ICONS[key] || 'sun', 18)}<b>${t.name}</b>${isNext ? '<em>القادم</em>' : ''}</span>
      <span class="h-tile-time">${c.time}<small>${c.period}</small></span>
      <small class="h-tile-note">${sub}</small>
    </li>`;
  }).join('');
  return `<section class="card h-times" data-moments>
    <div class="card-head"><h2>${icon('clock', 18)} أوقات النهار والليل</h2>${dayOffset ? `<small class="muted">${weekday(shown.day)}</small>` : ''}</div>
    <ul class="h-tiles">${tiles}</ul>
  </section>`;
}

// Where the khatma has reached, as a dark card.
function khatmaCard() {
  const k = firstKhatma();
  if (!k) {
    return `<a class="hx-dark" href="#/khatma">
      <div class="hx-dark-head">${icon('quran', 22)}<h2>الختمة</h2></div>
      <div class="hx-dark-tile"><small>ورد يومي من القرآن</small><b>ابدأ ختمة جديدة</b></div></a>`;
  }
  const i = khatmaInfo(k);
  const pct = Math.round((i.read / i.total) * 100);
  return `<a class="hx-dark" href="#/khatma">
    <div class="hx-dark-head">${icon('quran', 22)}<h2>${esc(k.name)}</h2></div>
    <div class="hx-dark-tile"><small>${i.done ? 'أتممت الختمة' : `ورد اليوم · الجزء ${num(juzOf(i.pos))}`}</small><b>${i.done ? 'تقبّل الله منك' : i.pos === i.wirdTo ? `صفحة ${num(i.pos)}` : `من صفحة ${num(i.pos)} إلى ${num(i.wirdTo)}`}</b></div>
    <div class="hx-dark-bar"><span>${num(i.read)} / ${num(i.total)}</span><i style="--p:${pct}%"></i></div></a>`;
}

// Today's follow-up and the average of the last seven days, as a dark card.
function worshipCard(info) {
  const sc = dayScore(info.key);
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += dayScore(dayKey(addDays(info.day, -i))).fraction;
  const pct = (f) => `${num(Math.round(f * 100))}٪`;
  return `<a class="hx-dark hx-score" href="#/worship">
    <div class="hx-score-row">
      <span><small>إنجاز اليوم</small><b>${pct(sc.fraction)}</b></span>
      <span><small>معدل آخر سبعة أيام</small><b>${pct(sum / 7)}</b></span>
      <i class="hx-score-go">${icon('arrowUp', 20)}</i>
    </div>
    <small class="hx-score-sub">متابعة · ${num(sc.done)} من ${num(sc.total)} اليوم</small>
    <div class="hx-dark-bar"><i style="--p:${Math.round(sc.fraction * 100)}%"></i></div></a>`;
}

function todayCard(kind, label, ic, html, ref) {
  return `<article class="today-card tc-${kind}">
    <div class="tc-head">${icon(ic, 17)}<span>${label}</span></div>
    <p class="tc-text">${html}</p>
    <div class="tc-foot">
      <small>${esc(ref)}</small>
      <div>
        <button class="icon-btn ghost sm" data-card-act="${kind}:copy" aria-label="نسخ">${icon('copy', 18)}</button>
        <button class="icon-btn ghost sm" data-card-act="${kind}:share" aria-label="مشاركة">${icon('share', 18)}</button>
      </div>
    </div>
  </article>`;
}

// The adhkar for this time of day: morning until Asr, evening until Isha, then sleep.
function wirdSuggestion(info) {
  const now = Date.now();
  const t = info.times;
  const id = now >= t.fajr.at && now < t.asr.at ? 'morning' : now >= t.asr.at && now < t.isha.at ? 'evening' : 'sleep';
  const cat = CATEGORY_BY_ID[id];
  const done = wirdDone(cat);
  const all = cat.items.length;
  const finished = done === all;
  return `<a class="card h-mini tone-${cat.tone} ${finished ? 'done' : ''}" href="#/adhkar/${id}">
    <span class="h-mini-ring">${ring(done / all, 48, 5)}<i>${icon(finished ? 'check' : cat.icon, 20)}</i></span>
    <b>${finished ? `أتممت ${esc(cat.title.replace('أذكار ', ''))}` : esc(cat.title)}</b>
    <small>${finished ? 'تقبّل الله منك' : done ? `قرأت ${num(done)} من ${num(all)}` : esc(cat.subtitle)}</small>
  </a>`;
}

// The moon as it looks on this Hijri day: lit from the right while waxing, from the left
// while waning (a crescent, half, gibbous or full moon).
function moonPhase(hday) {
  const p = Math.min(1, Math.max(0, (hday - 1) / 29.53));
  const r = 20;
  const k = Math.cos(2 * Math.PI * p); // 1 at the new moon, -1 at the full moon
  const rx = Math.abs(k) * r;
  const waxing = p < 0.5;
  // The lit limb (a half circle), then the terminator (half an ellipse) back to the top.
  const limb = waxing ? 1 : 0;
  const term = waxing ? (k > 0 ? 0 : 1) : k > 0 ? 1 : 0;
  const d = `M24 ${24 - r} A${r} ${r} 0 0 ${limb} 24 ${24 + r} A${rx.toFixed(2)} ${r} 0 0 ${term} 24 ${24 - r}Z`;
  return `<svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><circle cx="24" cy="24" r="${r}" class="moon-dark"/><path d="${d}" class="moon-lit"/></svg>`;
}
