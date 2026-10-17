// Home: live clock, Hijri and Gregorian dates, the next moment (sunrise, Duha, midnight, the
// last third) with a countdown, and the day's times.

import { CATEGORY_BY_ID, DAILY } from '../adhkar-data.js';
import { wirdDone } from './adhkar.js';
import { dailyFor } from '../daily-data.js';
import { clock, clockText, countdown, GREG_MONTHS, gregText, hijri, hijriText, num, weekday } from '../dates.js';
import { icon, PRAYER_ICONS } from '../icons.js';
import { addDays, dayTimes, METHODS } from '../prayer.js';
import { save, state } from '../store.js';
import { hoursAt, today } from '../today.js';
import { $, copyText, esc, ring, shareText, toast } from '../ui.js';
import { dayScore } from './worship.js';
import { daysText, nextOccasion, rangeText } from './calendar.js';

const QUICK = [
  ['#/notebook', 'أدعيتي', 'hand', 'teal'],
  ['#/calendar', 'التقويم', 'grid', 'teal'],
  ['#/occasions', 'المناسبات', 'calendar', 'rose'],
  ['#/qailulah', 'القيلولة', 'moon', 'teal'],
  ['#/walk', 'المشي الياباني', 'stars', 'amber'],
  ['#/focus', '١٠ دقائق', 'clock', 'rose'],
  ['#/tools', 'الأدوات', 'widget', 'indigo'],
];

let dayOffset = 0; // the day shown in the times card: 0 today, -1 yesterday, 1 tomorrow…

// The four moments shown, in the order of the day.
const MOMENTS = ['sunrise', 'duha', 'midnight', 'lastThird'];
const MOMENT_NOTE = {
  sunrise: 'تطلع الشمس، وينتهي وقت الفجر',
  duha: 'بعد الشروق بـ١٥ دقيقة',
  midnight: 'نصف الليل بين المغرب والفجر',
  lastThird: 'وقت نزول ربنا واستجابة الدعاء',
};

function bigClock() {
  const { h, m, s } = hoursAt();
  const c = clock(h + m / 60, state.settings.clock24);
  return { time: c.time, period: c.period, sec: num(String(s).padStart(2, '0')) };
}

export function render(view) {
  const s = state.settings;
  const info = today();
  const c = bigClock();
  const daily = DAILY[(info.day.d + info.day.m * 3) % DAILY.length];
  const d = dailyFor(info.day);
  const texts = {
    ayah: `﴿${d.ayah.text}﴾ [${d.ayah.ref}]`,
    hadith: `قال رسول الله ﷺ: ${d.hadith.text} ${d.hadith.ref}`,
    advice: d.advice.text,
    dhikr: `${daily.text} — ${daily.note}`,
  };

  view.innerHTML = `
  <section class="hero">
    <div class="hero-art" aria-hidden="true"></div>
    <div class="hero-top">
      <a class="chip glass" href="#/settings/location">${icon('pin', 16)}<span>${esc(s.location.name)}</span></a>
      <div class="hero-actions">
        <a class="icon-btn glass" href="#/settings" aria-label="الإعدادات">${icon('gear', 20)}</a>
      </div>
    </div>
    <div class="hero-main">
      <div class="hero-clock" aria-live="off">
        <span class="t" data-clock>${c.time}</span><span class="s" data-sec>${c.sec}</span>${c.period ? `<span class="p" data-period>${c.period}</span>` : ''}
      </div>
      <div class="hero-dates">
        <span class="hero-moon" title="القمر الليلة">${moonPhase(hijri(info.day, s.hijriAdjust).day)}</span>
        <div class="hijri">${icon('moon', 16)}<span><b>${weekday(info.day)}</b> ${hijriText(info.day, s.hijriAdjust)}</span></div>
        <div class="greg">${icon('calendar', 15)}<span>${gregText(info.day)}</span></div>
      </div>
    </div>
    <div class="next glass">
      <div class="next-row">
        <div class="next-name">
          <small>القادم</small>
          <strong data-next-name>${esc(info.next.name)}</strong>
        </div>
        <div class="next-time">
          <small data-next-at>${clockText(info.next.hours, s.clock24)}</small>
          <strong class="countdown" data-countdown>${countdown(info.next.at - Date.now())}</strong>
        </div>
      </div>
      <div class="bar"><i data-progress style="width:${progress(info)}%"></i></div>
      <div class="ends" data-ends>${endsText(info)}</div>
    </div>
  </section>

  <div class="home-grid">
    <div class="home-col">
      <section class="now-tiles">
        <div class="card analog" aria-label="الساعة">${analogClock()}</div>
        <div class="card period tp-${info.period.key}" data-period-tile>${periodTile(info)}</div>
      </section>

      ${info.isFriday ? `<div class="banner gold">${icon('stars', 22)}<div><b>جمعة مباركة</b><span>الإكثار من الصلاة على النبي ﷺ، وتحرّي ساعة الإجابة</span></div></div>` : ''}

      ${timesCard(info)}

    </div>
    <div class="home-col">
      ${wirdSuggestion(info)}

      <section class="quick">
        ${QUICK.map(([href, label, ic, tone]) => `<a class="quick-tile tone-${tone}" href="${href}">${icon(ic, 24)}<span>${label}</span></a>`).join('')}
      </section>

      ${occasionCard()}

      ${worshipCard(info)}
    </div>
  </div>

  <section class="today-cards" data-cards>
    ${todayCard('ayah', 'آية اليوم', 'quran', `<span class="hafs">${esc(d.ayah.text)}</span>`, d.ayah.ref)}
    ${todayCard('hadith', 'حديث اليوم', 'quote', esc(d.hadith.text), d.hadith.ref)}
    ${todayCard('advice', 'نصيحة اليوم', 'heart', esc(d.advice.text), '')}
    ${todayCard('dhikr', 'ذكر اليوم', 'beads', esc(daily.text), daily.note)}
  </section>
  <div class="dots" data-dots>${[0, 1, 2, 3].map((i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>

  <div class="foot-links">
    <a href="#/settings">${icon('gear', 18)} الإعدادات</a>
  </div>`;

  setHands(view);
  let lastTile = periodTile(info);
  view.addEventListener('click', onClick);
  const cards = $('[data-cards]', view);
  cards.addEventListener('scroll', () => {
    const i = Math.round(Math.abs(cards.scrollLeft) / cards.clientWidth);
    [...$('[data-dots]', view).children].forEach((dot, j) => dot.classList.toggle('on', i === j));
  }, { passive: true });
  return {
    tick() {
      const c2 = bigClock();
      const info2 = today();
      // Redraw when the day, the next moment, or the kind of time changes.
      if (info2.key !== info.key || info2.next.at !== info.next.at || info2.period.key !== info.period.key) {
        return 'rerender';
      }
      $('[data-clock]', view).textContent = c2.time;
      $('[data-sec]', view).textContent = c2.sec;
      const p = $('[data-period]', view);
      if (p) p.textContent = c2.period;
      $('[data-countdown]', view).textContent = countdown(info2.next.at - Date.now());
      $('[data-progress]', view).style.width = `${progress(info2)}%`;
      setHands(view);
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
      $('[data-times]', view).outerHTML = timesCard(today());
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

// The kind of time it is now: Duha, the afternoon, the last third…
function periodTile(info) {
  const n = info.period;
  return `<div class="pt-row"><span class="pt-ic">${icon(PERIOD_ICONS[n.key] || 'stars', 24)}</span><small class="pt-now">الآن</small></div>
    <b>${esc(n.title)}</b><small>${esc(n.sub)}</small>`;
}
const PERIOD_ICONS = { sunrise: 'sunrise', duha: 'sun', day: 'sun', night: 'moon', midnight: 'moon', qiyam: 'stars' };

// The times card, for today or another day picked with the arrows: sunrise, Duha, the
// middle of the night and its last third.
function timesCard(info) {
  const s = state.settings;
  let shown = info;
  if (dayOffset) {
    const day = addDays(info.day, dayOffset);
    const times = dayTimes(day, s, hijri(day, s.hijriAdjust).month === 9);
    shown = { day, times, next: {}, other: true };
  }
  const d = shown.day;
  const h24 = s.clock24;
  const label = dayOffset === 0 ? 'اليوم' : dayOffset === 1 ? 'غداً' : dayOffset === -1 ? 'أمس' : weekday(d);
  const rows = MOMENTS.map((key) => {
    const t = shown.times[key];
    const c = clock(t.hours, h24);
    const isNext = !shown.other && info.next.key === key && info.next.at === t.at;
    const passed = !shown.other && t.at <= Date.now() && !isNext && (key === 'sunrise' || key === 'duha');
    const sub = MOMENT_NOTE[key];
    return `<li class="prayer moment ${isNext ? 'next' : ''} ${passed ? 'passed' : ''}">
      <span class="p-icon">${icon(PRAYER_ICONS[key] || 'sun', 20)}</span>
      <span class="p-name"><span>${t.name}${isNext ? '<em>القادم</em>' : ''}</span><small class="p-end">${sub}</small></span>
      <span class="p-time"><span>${c.time}<small>${c.period}</small></span></span>
    </li>`;
  }).join('');
  return `<section class="card prayers" data-times>
    <div class="card-head">
      <h2>${icon('clock', 18)} الأوقات</h2>
      <a class="link" href="#/settings/method">${esc(METHODS[s.method]?.name.split(' — ')[0] || '')}</a>
    </div>
    <div class="pday">
      <button class="icon-btn ghost sm flip" data-pday="-1" aria-label="اليوم السابق">${icon('chevron', 20)}</button>
      <button class="pday-label ${dayOffset ? 'other' : ''}" data-pday="0"><b>${label}</b><small>${weekday(d)}، ${num(d.d)} ${GREG_MONTHS[d.m - 1]} • ${hijriText(d, s.hijriAdjust)}</small></button>
      <button class="icon-btn ghost sm" data-pday="1" aria-label="اليوم التالي">${icon('chevron', 20)}</button>
    </div>
    <ul class="prayer-list">${rows}</ul>
  </section>`;
}

// Today's follow-up at a glance: the share done and the link to the full list.
function worshipCard(info) {
  const sc = dayScore(info.key);
  return `<a class="card worship-card" href="#/worship">
    <div class="worship-row">
      <span class="w-score"><span>${ring(sc.fraction, 54, 6)}</span><b>${num(Math.round(sc.fraction * 100))}٪</b></span>
      <span class="km-text"><b>متابعتي اليوم</b><small>${num(sc.done)} من ${num(sc.total)} — اضغط للتسجيل</small></span>
      ${icon('chevron', 18, 'muted')}
    </div>
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
  return `<a class="suggest card ${finished ? 'done' : ''}" href="#/adhkar/${id}">
    <div class="suggest-icon tone-${cat.tone}">${icon(finished ? 'check' : cat.icon, 26)}</div>
    <div class="suggest-text"><b>${finished ? `أتممت ${cat.title}` : id === 'sleep' ? 'وِرد النوم' : `حان وقت ${cat.title}`}</b>
      <span>${finished ? 'تقبّل الله منك' : done ? `قرأت ${num(done)} من ${num(all)}` : esc(cat.subtitle)}</span></div>
    <span class="suggest-ring tone-${cat.tone}">${ring(done / all, 40, 4)}</span>
  </a>`;
}

// A small analog clock; its hands turn in tick().
function analogClock() {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const r1 = i % 3 ? 40 : 37;
    return `<line x1="${50 + r1 * Math.sin(a)}" y1="${50 - r1 * Math.cos(a)}" x2="${50 + 44 * Math.sin(a)}" y2="${50 - 44 * Math.cos(a)}" class="${i % 3 ? '' : 'major'}"/>`;
  }).join('');
  return `<svg viewBox="0 0 100 100" class="analog-svg">
    <circle cx="50" cy="50" r="48" class="face"/>${ticks}
    <line x1="50" y1="54" x2="50" y2="28" class="hand-h" data-hh/>
    <line x1="50" y1="56" x2="50" y2="16" class="hand-m" data-hm/>
    <line x1="50" y1="58" x2="50" y2="12" class="hand-s" data-hs/>
    <circle cx="50" cy="50" r="3" class="pin"/>
  </svg>`;
}

function setHands(view) {
  const { h, m, s } = hoursAt();
  const set = (sel, deg) => $(sel, view)?.setAttribute('transform', `rotate(${deg} 50 50)`);
  set('[data-hh]', ((h % 12) + m / 60) * 30);
  set('[data-hm]', (m + s / 60) * 6);
  set('[data-hs]', s * 6);
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
