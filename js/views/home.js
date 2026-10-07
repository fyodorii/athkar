// Home: live clock, Hijri and Gregorian dates, next prayer countdown and today's times.

import { CATEGORY_BY_ID, DAILY } from '../adhkar-data.js';
import { wirdDone } from './adhkar.js';
import { dailyFor } from '../daily-data.js';
import { clock, clockText, countdown, gregText, hijriText, num, weekday } from '../dates.js';
import { icon, PRAYER_ICONS } from '../icons.js';
import { forbiddenTimes, iqamaTime, METHODS, PRAYER_END, PRAYERS } from '../prayer.js';
import { syncSchedule } from '../push.js';
import { save, state } from '../store.js';
import { hoursAt, today } from '../today.js';
import { todayPortion } from '../khatma.js';
import { dayTasks, hifzDay, HIFZ_DAYS, isChecked, partDone } from '../hifz.js';
import { PAGES } from '../quran-data.js';
import { $, copyText, esc, ring, shareText, toast } from '../ui.js';
import { cyclePrayer, dayScore, prayerIcon, prayerStreak } from './worship.js';

const QUICK = [
  ['#/mine', 'أذكاري', 'heart', 'rose'],
  ['#/notebook', 'أدعيتي', 'hand', 'teal'],
  ['#/quran', 'الختمة', 'quran', 'emerald'],
  ['#/hifz', 'ورد الحفظ', 'bookmark', 'amber'],
  ['#/ruqyah', 'الرقية', 'book', 'teal'],
  ['#/qibla', 'القبلة', 'kaaba', 'emerald'],
  ['#/radio', 'الإذاعة', 'radio', 'indigo'],
  ['#/tasbeeh', 'السبحة', 'beads', 'amber'],
  ['#/qailulah', 'القيلولة', 'moon', 'teal'],
  ['#/walk', 'المشي الياباني', 'stars', 'amber'],
  ['#/focus', '١٠ دقائق', 'clock', 'rose'],
  ['#/tools', 'الأدوات', 'widget', 'indigo'],
];

// Rows under the five prayers: Duha, the middle of the night and its last third.
const EXTRA = ['duha', 'midnight', 'lastThird'];

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
  const notifyOn = s.notify.enabled;

  view.innerHTML = `
  <section class="hero">
    <div class="hero-art" aria-hidden="true"></div>
    <div class="hero-top">
      <a class="chip glass" href="#/settings/location">${icon('pin', 16)}<span>${esc(s.location.name)}</span></a>
      <div class="hero-actions">
        <a class="icon-btn glass" href="#/qibla" aria-label="القبلة">${icon('compass', 20)}</a>
        <a class="icon-btn glass" href="#/settings/notify" aria-label="التنبيهات">${icon(notifyOn ? 'bell' : 'bellOff', 20)}</a>
        <a class="icon-btn glass" href="#/settings" aria-label="الإعدادات">${icon('gear', 20)}</a>
      </div>
    </div>
    <div class="hero-clock" aria-live="off">
      <span class="t" data-clock>${c.time}</span><span class="s" data-sec>${c.sec}</span>${c.period ? `<span class="p" data-period>${c.period}</span>` : ''}
    </div>
    <div class="hero-dates">
      <div class="hijri">${icon('moon', 16)}<span><b>${weekday(info.day)}</b> ${hijriText(info.day, s.hijriAdjust)}</span></div>
      <div class="greg">${icon('calendar', 15)}<span>${gregText(info.day)}</span></div>
    </div>
    <div class="next glass">
      <div class="next-row">
        <div class="next-name">
          <small>الصلاة القادمة</small>
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

  ${info.isFriday ? `<a class="banner gold" href="#/quran">${icon('stars', 22)}<div><b>جمعة مباركة</b><span>سورة الكهف، والإكثار من الصلاة على النبي ﷺ، وتحرّي ساعة الإجابة</span></div></a>` : ''}

  <section class="card prayers">
    <div class="card-head">
      <h2>مواقيت الصلاة</h2>
      <a class="link" href="#/settings/method">${esc(METHODS[s.method]?.name.split(' — ')[0] || '')}</a>
    </div>
    <ul class="prayer-list">
      ${PRAYERS.map((k) => prayerRow(info, k)).join('')}
    </ul>
    <ul class="extra-times">
      ${EXTRA.map((k) => {
        const c2 = clock(info.times[k].hours, s.clock24);
        return `<li><span>${icon(PRAYER_ICONS[k], 18)}</span><b>${info.times[k].name}</b><em>${c2.time} <small>${c2.period}</small></em></li>`;
      }).join('')}
    </ul>
  </section>

  ${nahyCard(info)}

  ${wirdSuggestion(info)}

  <section class="quick">
    ${QUICK.map(([href, label, ic, tone]) => `<a class="quick-tile tone-${tone}" href="${href}">${icon(ic, 24)}<span>${label}</span></a>`).join('')}
  </section>

  ${khatmaCard(info)}
  ${hifzCard()}

  ${worshipCard(info)}

  <section class="today-cards" data-cards>
    ${todayCard('ayah', 'آية اليوم', 'quran', `<span class="hafs">${esc(d.ayah.text)}</span>`, d.ayah.ref)}
    ${todayCard('hadith', 'حديث اليوم', 'quote', esc(d.hadith.text), d.hadith.ref)}
    ${todayCard('advice', 'نصيحة اليوم', 'heart', esc(d.advice.text), '')}
    ${todayCard('dhikr', 'ذكر اليوم', 'beads', esc(daily.text), daily.note)}
  </section>
  <div class="dots" data-dots>${[0, 1, 2, 3].map((i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>

  <div class="foot-links">
    <a href="#/settings/widget">${icon('widget', 18)} ويدجت الشاشة</a>
    <a href="#/settings/notify">${icon('bell', 18)} التنبيهات</a>
  </div>`;

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
      // Redraw when the day, the next prayer, the running prayer or a forbidden time changes.
      const same = (a, b) => (a && a.at) === (b && b.at);
      if (info2.key !== info.key || info2.next.at !== info.next.at || !same(info2.current, info.current) || info2.forbidden?.key !== info.forbidden?.key) {
        return 'rerender';
      }
      $('[data-clock]', view).textContent = c2.time;
      $('[data-sec]', view).textContent = c2.sec;
      const p = $('[data-period]', view);
      if (p) p.textContent = c2.period;
      $('[data-countdown]', view).textContent = countdown(info2.next.at - Date.now());
      $('[data-progress]', view).style.width = `${progress(info2)}%`;
      $('[data-ends]', view).innerHTML = endsText(info2);
    },
    destroy() {
      view.removeEventListener('click', onClick);
    },
  };

  function onClick(e) {
    const act = e.target.closest('[data-card-act]');
    if (act) {
      const [kind, what] = act.dataset.cardAct.split(':');
      return what === 'copy' ? copyText(texts[kind]) : shareText(texts[kind]);
    }
    const quick = e.target.closest('[data-quick]');
    if (quick) {
      e.preventDefault();
      const v = cyclePrayer(info.key, quick.dataset.quick);
      quick.className = `qp p${v}`;
      quick.querySelector('.qp-mark').innerHTML = prayerIcon(v) || '';
      const sc = dayScore(info.key);
      $('[data-wscore]', view).innerHTML = ring(sc.fraction, 54, 6);
      $('[data-wpct]', view).textContent = `${num(Math.round(sc.fraction * 100))}٪`;
      return;
    }
    const bell = e.target.closest('[data-bell]');
    if (!bell) return;
    e.preventDefault();
    const k = bell.dataset.bell;
    s.notify.prayers[k] = !s.notify.prayers[k];
    save();
    bell.classList.toggle('on', s.notify.prayers[k]);
    bell.innerHTML = icon(s.notify.prayers[k] ? 'bell' : 'bellOff', 18);
    if (!s.notify.enabled) {
      toast('فعّل التنبيهات من الإعدادات لتصلك عند كل صلاة');
    } else {
      toast(s.notify.prayers[k] ? `سيصلك تنبيه صلاة ${esc(info.times[k].name)}` : `أُوقف تنبيه صلاة ${esc(info.times[k].name)}`);
      syncSchedule();
    }
  }
}

function progress(info) {
  const span = info.next.at - info.prev.at;
  return Math.max(0, Math.min(100, ((Date.now() - info.prev.at) / span) * 100));
}

function prayerRow(info, k) {
  const s = state.settings;
  const t = info.times[k];
  const isNext = info.next.key === k && info.next.at === t.at;
  const isCurrent = info.current?.key === k && info.current.at === t.at;
  const passed = t.at <= Date.now() && !isNext && !isCurrent;
  const name = k === 'dhuhr' && info.isFriday ? 'الجمعة' : t.name;
  const c = clock(t.hours, s.clock24);
  const iq = k !== 'sunrise' && s.iqama?.[k] ? iqamaTime(info.times, k, s.iqama) : null;
  const bell =
    k === 'sunrise'
      ? '<span class="bell-space"></span>'
      : `<button class="bell ${s.notify.prayers[k] ? 'on' : ''}" data-bell="${k}" aria-label="تنبيه ${name}">${icon(s.notify.prayers[k] ? 'bell' : 'bellOff', 18)}</button>`;
  return `<li class="prayer ${isNext ? 'next' : ''} ${isCurrent ? 'current' : ''} ${passed ? 'passed' : ''} ${k === 'sunrise' ? 'minor' : ''}">
    <span class="p-icon">${icon(PRAYER_ICONS[k], 20)}</span>
    <span class="p-name"><span>${name}${isNext ? '<em>القادمة</em>' : isCurrent ? '<em class="now">وقتها الآن</em>' : ''}</span><small class="p-end">${endLabel(info, k)}</small></span>
    <span class="p-time"><span>${c.time}<small>${c.period}</small></span>${iq ? `<small class="p-iqama">الإقامة ${clockText(iq.hours, s.clock24)}</small>` : ''}</span>
    ${bell}
  </li>`;
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

// Today's worship at a glance, with the five prayers to tick off right here.
function worshipCard(info) {
  const sc = dayScore(info.key);
  const rec = state.worship[info.key] || {};
  const streak = prayerStreak();
  return `<section class="card worship-card">
    <a class="card-head" href="#/worship">
      <h2>${icon('check', 18)} عباداتي اليوم</h2>
      <span class="link">${streak ? `${num(streak)} ${streak === 1 ? 'يوم' : 'أيام'} متتالية` : 'السجل'} ${icon('chevron', 14)}</span>
    </a>
    <div class="worship-row">
      <a class="w-score" href="#/worship"><span data-wscore>${ring(sc.fraction, 54, 6)}</span><b data-wpct>${num(Math.round(sc.fraction * 100))}٪</b></a>
      <div class="qps">
        ${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
          .map((k) => {
            const v = rec[k] || 0;
            const name = k === 'dhuhr' && info.isFriday ? 'الجمعة' : info.times[k].name;
            return `<button class="qp p${v}" data-quick="${k}" aria-label="${name}"><span class="qp-mark">${prayerIcon(v)}</span><small>${name}</small></button>`;
          })
          .join('')}
      </div>
    </div>
  </section>`;
}

// "The time for Dhuhr ends in 01:23:45", or what time it is when no prayer is due.
function endsText(info) {
  const f = info.forbidden;
  const nahy = f ? `<span class="nahy">${icon('info', 15)} وقت نهي عن النافلة (${esc(f.name)}) حتى <b>${clockText(f.to.hours, state.settings.clock24)}</b></span>` : '';
  const q = info.iqama;
  const iqama = q
    ? `<span class="iqama">${icon('mosque', 15)} إقامة ${esc(q.name)} بعد <b>${countdown(q.at - Date.now())}</b> (${clockText(q.hours, state.settings.clock24)})</span>`
    : '';
  return iqama + currentText(info) + nahy;
}

function currentText(info) {
  const now = Date.now();
  const h24 = state.settings.clock24;
  const c = info.current;
  const t = info.times;
  if (c) {
    // Asr has a chosen time (until a shadow is twice an object) before its time of need.
    const chosen = c.key === 'asr' && state.settings.asr === 1 && now < t.asr2.at;
    const end = chosen ? t.asr2 : c.end;
    const left = end.at - now;
    const label = chosen ? 'وقت الاختيار للعصر' : c.key === 'asr' && state.settings.asr === 1 ? 'وقت الضرورة للعصر' : `وقت ${esc(c.name)}`;
    return `<span class="${left < 20 * 60000 ? 'warn' : ''}">${icon('clock', 15)} يخرج ${label} بعد <b>${countdown(left)}</b> (${clockText(end.hours, h24)})</span>`;
  }
  if (now >= t.sunrise.at && now < t.dhuhr.at) {
    if (info.forbidden?.key === 'zawal') return `<span>${icon('sun', 15)} انتهى وقت الضحى، والظهر ${clockText(t.dhuhr.hours, h24)}</span>`;
    return `<span>${icon('sun', 15)} وقت الضحى — ${now < t.duha.at ? `يبدأ ${clockText(t.duha.hours, h24)}` : 'صلِّ ركعتي الضحى'}</span>`;
  }
  return `<span>${icon('stars', 15)} ${now >= t.lastThird.at - 86400000 || now >= t.lastThird.at ? 'الثلث الأخير من الليل — وقت نزول واستجابة' : 'بعد منتصف الليل'}</span>`;
}

function khatmaCard(info) {
  const k = state.khatma;
  if (!k.start) {
    return `<a class="card khatma-mini" href="#/quran">
      <span class="km-icon">${icon('quran', 24)}</span>
      <span class="km-text"><b>ابدأ ختمتك</b><small>حدد مدة الختمة، ويحسب لك وردك اليومي</small></span>${icon('chevron', 18, 'muted')}</a>`;
  }
  const p = todayPortion(k, info.day);
  return `<a class="card khatma-mini" href="#/quran">
    <span class="km-ring">${ring(k.page / PAGES, 52, 5)}<b>${num(Math.floor((k.page / PAGES) * 100))}٪</b></span>
    <span class="km-text"><b>${k.page >= PAGES ? 'أتممت الختمة' : p.done ? 'أتممت وردك اليوم ✓' : `وردك اليوم: ${num(p.size)} صفحة`}</b>
      <small>${k.page >= PAGES ? 'تقبّل الله منك' : p.hizb ? `الحزب ${num(p.hizb.n)}: ${esc(p.hizb.name)}` : `من ص ${num(p.from)} (${esc(p.fromInfo.surahName)}) إلى ص ${num(p.to)} (${esc(p.toInfo.surahName)})`}</small></span>
    ${icon('chevron', 18, 'muted')}</a>`;
}

// Today's memorization wird, once the plan is started.
function hifzCard() {
  const h = state.hifz;
  if (!h.on) return '';
  const e = hifzDay(h.day);
  const tasks = dayTasks(h.day);
  const done = tasks.filter((x) => isChecked(h.day, x.id)).length;
  const range = (a, b) => `${num(a)}–${num(b)}`;
  return `<a class="card khatma-mini" href="#/hifz">
    <span class="km-ring">${ring(done / tasks.length, 52, 5)}<b>${num(done)}/${num(tasks.length)}</b></span>
    <span class="km-text"><b>${partDone(h.day) ? 'أتممت ورد الحفظ ✓' : `ورد الحفظ — اليوم ${num(h.day)} من ${num(HIFZ_DAYS)}`}</b>
      <small>${e.from ? `حفظ الوجه ${range(e.from, e.to)}` : 'تثبيت'}${e.link ? ` • ربط ${range(e.link.from, e.link.to)}` : ''}${e.review ? ` • مراجعة ${range(e.review.from, e.review.to)}` : ''}</small></span>
    ${icon('chevron', 18, 'muted')}</a>`;
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

// "Until 6:14 AM" under each prayer: when its time runs out. Asr shows its chosen time
// (until a shadow is twice an object) and its time of need (until sunset).
function endLabel(info, k) {
  const h24 = state.settings.clock24;
  const t = info.times;
  if (k === 'sunrise') return 'نهاية وقت الفجر';
  if (k === 'asr' && state.settings.asr === 1 && t.asr2.at > t.asr.at) {
    return `الاختيار حتى ${clockText(t.asr2.hours, h24)} • الضرورة حتى ${clockText(t.maghrib.hours, h24)}`;
  }
  return `يخرج وقتها ${clockText(t[PRAYER_END[k]].hours, h24)}`;
}

function nahyCard(info) {
  const h24 = state.settings.clock24;
  const now = Date.now();
  return `<section class="card nahy-card">
    <div class="card-head"><h2>${icon('info', 18)} أوقات النهي</h2><small class="muted">عن صلاة النافلة</small></div>
    <ul class="nahy-list">
      ${forbiddenTimes(info.times)
        .map((f) => {
          const on = now >= f.from.at && now < f.to.at;
          const past = now >= f.to.at;
          return `<li class="${on ? 'on' : ''} ${past ? 'past' : ''}">
            <div><b>${esc(f.name)}${on ? '<em>الآن</em>' : ''}</b><small>${esc(f.desc)}</small></div>
            <span class="nahy-time">${clockText(f.from.hours, h24)}<i>←</i>${clockText(f.to.hours, h24)}</span>
          </li>`;
        })
        .join('')}
    </ul>
    <p class="hint">ويُستثنى منها قضاء الفريضة الفائتة، وذوات الأسباب كتحية المسجد وسنة الوضوء على الراجح من أقوال أهل العلم.</p>
  </section>`;
}
