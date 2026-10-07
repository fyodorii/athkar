// Home: live clock, Hijri and Gregorian dates, next prayer countdown and today's times.

import { CATEGORY_BY_ID, DAILY } from '../adhkar-data.js';
import { dailyFor } from '../daily-data.js';
import { clock, clockText, countdown, gregText, hijriText, num, weekday } from '../dates.js';
import { icon, PRAYER_ICONS } from '../icons.js';
import { METHODS, PRAYERS } from '../prayer.js';
import { syncSchedule } from '../push.js';
import { save, state } from '../store.js';
import { adhkarNow, hoursAt, today } from '../today.js';
import { $, copyText, esc, ring, shareText, toast } from '../ui.js';
import { cyclePrayer, dayScore, prayerIcon, prayerStreak } from './worship.js';

const SUGGEST = {
  morning: { text: 'حان وقت أذكار الصباح', sub: 'من الفجر إلى طلوع الشمس' },
  evening: { text: 'حان وقت أذكار المساء', sub: 'من العصر إلى غروب الشمس' },
  sleep: { text: 'أذكار النوم', sub: 'اختم يومك بذكر الله' },
  prayer: { text: 'أذكار بعد الصلاة', sub: 'دبر كل صلاة مكتوبة' },
};

const QUICK = ['morning', 'evening', 'prayer', 'sleep'];

function bigClock() {
  const { h, m, s } = hoursAt();
  const c = clock(h + m / 60, state.settings.clock24);
  return { time: c.time, period: c.period, sec: num(String(s).padStart(2, '0')) };
}

export function render(view) {
  const s = state.settings;
  const info = today();
  const c = bigClock();
  const suggestion = adhkarNow(info);
  const cat = CATEGORY_BY_ID[suggestion];
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
    </div>
  </section>

  ${info.isFriday ? `<a class="banner gold" href="#/adhkar/tasbih">${icon('stars', 22)}<div><b>جمعة مباركة</b><span>سورة الكهف، والإكثار من الصلاة على النبي ﷺ، وتحرّي ساعة الإجابة</span></div></a>` : ''}

  <section class="card prayers">
    <div class="card-head">
      <h2>مواقيت الصلاة</h2>
      <a class="link" href="#/settings/method">${esc(METHODS[s.method]?.name.split(' — ')[0] || '')}</a>
    </div>
    <ul class="prayer-list">
      ${PRAYERS.map((k) => prayerRow(info, k)).join('')}
    </ul>
    <div class="night-times">
      <span>${icon('stars', 15)} منتصف الليل <b>${clockText(info.times.midnight.hours, s.clock24)}</b></span>
      <span>الثلث الأخير <b>${clockText(info.times.lastThird.hours, s.clock24)}</b></span>
    </div>
  </section>

  <a class="suggest card" href="#/adhkar/${suggestion}">
    <div class="suggest-icon tone-${cat.tone}">${icon(cat.icon, 26)}</div>
    <div class="suggest-text"><b>${SUGGEST[suggestion].text}</b><span>${SUGGEST[suggestion].sub}</span></div>
    ${icon('chevron', 20, 'muted')}
  </a>

  <section class="quick">
    ${QUICK.map((id) => {
      const q = CATEGORY_BY_ID[id];
      return `<a class="quick-tile tone-${q.tone}" href="#/adhkar/${id}">${icon(q.icon, 24)}<span>${esc(q.title)}</span></a>`;
    }).join('')}
  </section>

  ${worshipCard(info)}

  <section class="today-cards" data-cards>
    ${todayCard('ayah', 'آية اليوم', 'book', `﴿${esc(d.ayah.text)}﴾`, d.ayah.ref)}
    ${todayCard('hadith', 'حديث اليوم', 'quote', esc(d.hadith.text), d.hadith.ref)}
    ${todayCard('advice', 'نصيحة اليوم', 'heart', esc(d.advice.text), '')}
    ${todayCard('dhikr', 'ذكر اليوم', 'beads', esc(daily.text), daily.note)}
  </section>
  <div class="dots" data-dots>${[0, 1, 2, 3].map((i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>

  <div class="foot-links">
    <a href="#/qibla">${icon('compass', 18)} اتجاه القبلة</a>
    <a href="#/tasbeeh">${icon('beads', 18)} السبحة</a>
    <a href="#/settings/widget">${icon('widget', 18)} ويدجت الشاشة</a>
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
      if (info2.key !== info.key || info2.next.at !== info.next.at) return 'rerender';
      $('[data-clock]', view).textContent = c2.time;
      $('[data-sec]', view).textContent = c2.sec;
      const p = $('[data-period]', view);
      if (p) p.textContent = c2.period;
      $('[data-countdown]', view).textContent = countdown(info2.next.at - Date.now());
      $('[data-progress]', view).style.width = `${progress(info2)}%`;
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
  const passed = t.at <= Date.now() && !isNext;
  const name = k === 'dhuhr' && info.isFriday ? 'الجمعة' : t.name;
  const c = clock(t.hours, s.clock24);
  const bell =
    k === 'sunrise'
      ? '<span class="bell-space"></span>'
      : `<button class="bell ${s.notify.prayers[k] ? 'on' : ''}" data-bell="${k}" aria-label="تنبيه ${name}">${icon(s.notify.prayers[k] ? 'bell' : 'bellOff', 18)}</button>`;
  return `<li class="prayer ${isNext ? 'next' : ''} ${passed ? 'passed' : ''} ${k === 'sunrise' ? 'minor' : ''}">
    <span class="p-icon">${icon(PRAYER_ICONS[k], 20)}</span>
    <span class="p-name">${name}${isNext ? '<em>القادمة</em>' : ''}</span>
    <span class="p-time">${c.time}<small>${c.period}</small></span>
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
