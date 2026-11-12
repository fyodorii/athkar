// Home: Hijri and Gregorian dates, the next moment (a prayer, sunrise, Duha, midnight, the
// last third) with a countdown, the adhan and iqama line, and the day's times.

import { CATEGORY_BY_ID, DAILY } from '../adhkar-data.js';
import { wirdDone } from './adhkar.js';
import { dailyFor } from '../daily-data.js';
import { clock, clockText, countdown, GREG_MONTHS, gregText, hijri, hijriText, minutesText, num, weekday } from '../dates.js';
import { icon, PRAYER_ICONS } from '../icons.js';
import { addDays, dayTimes, DUHA_END, DUHA_START, METHODS } from '../prayer.js';
import { firstKhatma, state } from '../store.js';
import { PRAYERS, today } from '../today.js';
import { juzOf, khatmaInfo } from '../khatma.js';
import { $, copyText, esc, ring, shareText } from '../ui.js';
import { dayScore } from './worship.js';
import { daysText, nextOccasion, rangeText } from './occasions.js';

// Shortcuts, as a grid of eight.
const QUICK = [
  ['#/tasbeeh', 'السبحة', 'beads', 'indigo'],
  ['#/khatma', 'ختمتي', 'quran', 'teal'],
  ['#/rawatib', 'الرواتب', 'mosque', 'emerald'],
  ['#/reminders', 'تذكيراتي', 'bell', 'rose'],
  ['#/notebook', 'أدعيتي', 'hand', 'teal'],
  ['#/debts', 'الديون', 'wallet', 'amber'],
  ['#/datecalc', 'التاريخ', 'calendar', 'indigo'],
  ['#/tools', 'الأدوات', 'widget', 'rose'],
];

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

  view.innerHTML = `
  <section class="h-hero">
    <div class="h-top">
      <button class="icon-btn glass nav-btn" data-nav aria-label="القائمة">${icon('rows', 20)}</button>
      <a class="chip glass" href="#/settings/location">${icon('pin', 16)}<span>${esc(s.location.name)}</span></a>
      <span class="h-top-btns">
        <a class="icon-btn glass" href="#/settings/notify" aria-label="التنبيهات">${icon(s.notify.on ? 'bell' : 'bellOff', 20)}</a>
      </span>
    </div>
    <div class="h-dates">
      <span class="h-moon" title="القمر الليلة">${moonPhase(hijri(info.day, s.hijriAdjust).day)}</span>
      <span><b>${weekday(info.day)}</b><span>${hijriText(info.day, s.hijriAdjust)}</span><small>${gregText(info.day)}</small></span>
    </div>
    <div class="h-count">
      <small>القادم · <b data-next-name>${esc(info.next.name)}</b> <span data-next-at>${clockText(info.next.hours, s.clock24)}</span></small>
      <strong class="countdown" data-countdown>${countdown(info.next.at - Date.now())}</strong>
      <div class="h-bar"><i data-progress style="width:${progress(info)}%"></i></div>
      <p class="h-ends" data-ends>${endsText(info)}</p>
    </div>
    <div class="h-now tp-${info.period.key}" data-period-tile>${periodTile(info)}</div>
  </section>

  ${info.isFriday ? `<div class="banner gold">${icon('stars', 22)}<div><b>جمعة مباركة</b><span>الإكثار من الصلاة على النبي ﷺ، وتحرّي ساعة الإجابة</span></div></div>` : ''}

  <div class="h-body">
    ${prayersCard(info)}
    <section class="h-pair">
      ${wirdSuggestion(info)}
      ${worshipCard(info)}
    </section>
    <nav class="h-grid" aria-label="اختصارات">
      ${QUICK.map(([href, label, ic, tone]) => `<a class="tone-${tone}" href="${href}"><span>${icon(ic, 22)}</span><b>${label}</b></a>`).join('')}
    </nav>
    <div class="h-stack">
      ${khatmaCard()}
      ${occasionCard()}
    </div>
    ${momentsCard(info)}
  </div>

  <h3 class="section-title small h-title">${icon('stars', 16)} زاد اليوم</h3>
  <section class="today-cards" data-cards>
    ${todayCard('ayah', 'آية اليوم', 'quran', `<span class="hafs">${esc(d.ayah.text)}</span>`, d.ayah.ref)}
    ${todayCard('hadith', 'حديث اليوم', 'quote', esc(d.hadith.text), d.hadith.ref)}
    ${todayCard('advice', 'نصيحة اليوم', 'heart', esc(d.advice.text), '')}
    ${todayCard('dhikr', 'ذكر اليوم', 'beads', esc(daily.text), daily.note)}
  </section>
  <div class="dots" data-dots>${[0, 1, 2, 3].map((i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;

  let lastTile = periodTile(info);
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
      if (info2.key !== info.key || info2.next.at !== info.next.at || info2.period.key !== info.period.key) {
        return 'rerender';
      }
      $('[data-countdown]', view).textContent = countdown(info2.next.at - Date.now());
      $('[data-progress]', view).style.width = `${progress(info2)}%`;
      const p2 = periodTile(info2);
      if (p2 !== lastTile) $('[data-period-tile]', view).innerHTML = lastTile = p2;
    },
    destroy() {
      view.removeEventListener('click', onClick);
    },
  };

  function onClick(e) {
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

// The five prayers of the day, with the arrows that move both time cards to another day.
function prayersCard(info) {
  const s = state.settings;
  const shown = shownDay(info);
  const d = shown.day;
  const now = Date.now();
  const label = dayOffset === 0 ? 'اليوم' : dayOffset === 1 ? 'غداً' : dayOffset === -1 ? 'أمس' : weekday(d);
  const prayers = PRAYERS.map((key) => {
    const t = shown.times[key];
    const c = clock(t.hours, s.clock24);
    const isNow = !shown.other && info.lastPrayer.at === t.at;
    const isNext = !shown.other && info.nextPrayer.at === t.at;
    const passed = !shown.other && t.at <= now && !isNow;
    return `<li class="h-pr ${isNow ? 'now' : ''} ${isNext ? 'next' : ''} ${passed ? 'passed' : ''}">
      <b>${t.name}</b>${icon(PRAYER_ICONS[key], 22)}<span>${c.time}</span><small>${c.period}</small></li>`;
  }).join('');
  return `<section class="card h-times" data-prayers>
    <div class="card-head">
      <h2>${icon('mosque', 18)} الصلوات</h2>
      <a class="link" href="#/settings/method">${esc(METHODS[s.method]?.name.split(' — ')[0] || '')}</a>
    </div>
    <div class="pday">
      <button class="icon-btn ghost sm flip" data-pday="-1" aria-label="اليوم السابق">${icon('chevron', 20)}</button>
      <button class="pday-label ${dayOffset ? 'other' : ''}" data-pday="0"><b>${label}</b><small>${weekday(d)}، ${num(d.d)} ${GREG_MONTHS[d.m - 1]} • ${hijriText(d, s.hijriAdjust)}</small></button>
      <button class="icon-btn ghost sm" data-pday="1" aria-label="اليوم التالي">${icon('chevron', 20)}</button>
    </div>
    <ul class="h-prayers">${prayers}</ul>
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

// Where the khatma has reached, and the way back into it.
function khatmaCard() {
  const k = firstKhatma();
  if (!k) {
    return `<a class="card occ-mini kh-mini" href="#/khatma" style="--kc:#3f8ef0">
      <span class="km-icon">${icon('quran', 24)}</span>
      <span class="km-text"><small>الختمات</small><b>ابدأ ختمة جديدة</b><small>ورد يومي من القرآن الكريم بخطة تختارها</small></span>
      <span class="pill">${icon('plus', 16)}</span></a>`;
  }
  const i = khatmaInfo(k);
  return `<a class="card occ-mini kh-mini" href="#/khatma" style="--kc:${i.color}">
    <span class="km-icon">${icon('quran', 24)}</span>
    <span class="km-text"><small>${esc(k.name)}</small><b>${i.done ? 'أتممت الختمة' : `ورد اليوم: ${i.pos === i.wirdTo ? `صفحة ${num(i.pos)}` : `من ${num(i.pos)} إلى ${num(i.wirdTo)}`}`}</b><small>${i.done ? 'تقبّل الله منك' : `الجزء ${num(juzOf(i.pos))} • قرأت ${num(i.read)} من ${num(i.total)}`}</small></span>
    <span class="pill">${num(Math.round((i.read / i.total) * 100))}%</span></a>`;
}

// Today's follow-up at a glance: the share done and the link to the full list.
function worshipCard(info) {
  const sc = dayScore(info.key);
  return `<a class="card h-mini tone-indigo" href="#/worship">
    <span class="h-mini-ring">${ring(sc.fraction, 48, 5)}<b>${num(Math.round(sc.fraction * 100))}٪</b></span>
    <b>متابعتي اليوم</b>
    <small>${num(sc.done)} من ${num(sc.total)}</small>
  </a>`;
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

// The next Islamic occasion and how long until it.
function occasionCard() {
  const o = nextOccasion(400);
  if (!o) return '';
  return `<a class="card occ-mini" href="#/occasions">
    <span class="km-icon">${icon(o.icon, 24)}</span>
    <span class="km-text"><small>${o.left <= 0 ? 'المناسبة الحالية' : 'المناسبة القادمة'}</small><b>${esc(o.name)}</b><small>${rangeText(o.start, o.end)}</small></span>
    <span class="pill">${o.left < 0 ? 'الآن' : daysText(o.left)}</span></a>`;
}
