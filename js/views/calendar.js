// The calendar (a Gregorian or Hijri month, with each day's prayer times and occasions)
// and the year's Islamic occasions with how long until each.

import { clockText, GREG_MONTHS, gregText, hijri, HIJRI_MONTHS, hijriText, num, weekday, WEEKDAYS } from '../dates.js';
import { icon } from '../icons.js';
import { daysBetween, hijriMonthDays, occasionsFrom, occasionsOn } from '../occasions.js';
import { addDays, dayKey, dayTimes } from '../prayer.js';
import { state } from '../store.js';
import { today } from '../today.js';
import { esc, openSheet, pageHeader } from '../ui.js';

const WD_SHORT = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
const TIMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha', 'midnight', 'lastThird'];
const TIME_ICONS = { fajr: 'moonStar', sunrise: 'sunrise', dhuhr: 'sun', asr: 'sunLow', maghrib: 'sunset', isha: 'moon', midnight: 'moon', lastThird: 'stars' };
const TIME_NAMES = { midnight: 'منتصف الليل', lastThird: 'الثلث الأخير' };

const adj = () => state.settings.hijriAdjust;
const wd = (day) => new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
const sameDay = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;
const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return { y, m, d };
};

export function daysText(n) {
  if (n <= 0) return 'اليوم';
  if (n === 1) return 'غداً';
  if (n === 2) return 'بعد يومين';
  if (n <= 10) return `بعد ${num(n)} أيام`;
  return `بعد ${num(n)} يوماً`;
}

export function rangeText(a, b) {
  if (sameDay(a, b)) return `${num(a.d)} ${GREG_MONTHS[a.m - 1]} ${num(a.y)}`;
  if (a.m === b.m && a.y === b.y) return `${num(a.d)}–${num(b.d)} ${GREG_MONTHS[a.m - 1]} ${num(a.y)}`;
  return `${num(a.d)} ${GREG_MONTHS[a.m - 1]} – ${num(b.d)} ${GREG_MONTHS[b.m - 1]} ${num(b.y)}`;
}

let mode = 'greg'; // greg | hijri, kept while the app is open

// ---- Calendar ----

export function renderCalendar(view, key) {
  const t = today();
  let selected = key ? parseKey(key) : t.day;
  // The month shown: a Gregorian {y, m} or a Hijri {year, month}.
  let greg = { y: selected.y, m: selected.m };
  let hij = hijri(selected, adj());

  const cells = () => {
    let days;
    if (mode === 'greg') {
      const n = new Date(Date.UTC(greg.y, greg.m, 0)).getUTCDate();
      days = Array.from({ length: n }, (_, i) => ({ y: greg.y, m: greg.m, d: i + 1 }));
    } else {
      days = hijriMonthDays(hij.year, hij.month, selected, adj()).map((x) => x.day);
    }
    const lead = wd(days[0]);
    const before = Array.from({ length: lead }, (_, i) => addDays(days[0], i - lead));
    const total = Math.ceil((lead + days.length) / 7) * 7;
    const after = Array.from({ length: total - lead - days.length }, (_, i) => addDays(days[days.length - 1], i + 1));
    return { days, list: [...before.map((d) => [d, true]), ...days.map((d) => [d, false]), ...after.map((d) => [d, true])] };
  };

  const title = (days) => {
    const a = days[0];
    const b = days[days.length - 1];
    if (mode === 'greg') {
      const ha = hijri(a, adj());
      const hb = hijri(b, adj());
      return [`${GREG_MONTHS[greg.m - 1]} ${num(greg.y)}`, ha.month === hb.month ? `${HIJRI_MONTHS[ha.month - 1]} ${num(ha.year)} هـ` : `${HIJRI_MONTHS[ha.month - 1]} – ${HIJRI_MONTHS[hb.month - 1]} ${num(hb.year)} هـ`];
    }
    return [`${HIJRI_MONTHS[hij.month - 1]} ${num(hij.year)} هـ`, a.m === b.m ? `${GREG_MONTHS[a.m - 1]} ${num(a.y)}` : `${GREG_MONTHS[a.m - 1]} – ${GREG_MONTHS[b.m - 1]} ${num(b.y)}`];
  };

  const draw = () => {
    const { days, list } = cells();
    const [main, sub] = title(days);
    const h24 = state.settings.clock24;
    const sh = hijri(selected, adj());
    const times = dayTimes(selected, state.settings, sh.month === 9);
    const occ = occasionsOn(selected, adj());
    const white = sh.day >= 13 && sh.day <= 15;
    view.innerHTML = `
      ${pageHeader('التقويم', { back: '#/home', actions: `<button class="icon-btn ghost" data-today aria-label="اليوم">${icon('grid', 22)}</button>` })}
      <div class="seg-big"><button class="${mode === 'greg' ? 'on' : ''}" data-mode="greg">ميلادي</button><button class="${mode === 'hijri' ? 'on' : ''}" data-mode="hijri">هجري</button></div>
      <section class="card cal">
        <div class="cal-head">
          <button class="icon-btn ghost sm flip" data-month="-1" aria-label="الشهر السابق">${icon('chevron', 20)}</button>
          <div><b>${main}</b><small>${sub}</small></div>
          <button class="icon-btn ghost sm" data-month="1" aria-label="الشهر التالي">${icon('chevron', 20)}</button>
        </div>
        <div class="cal-grid">
          ${WD_SHORT.map((w) => `<span class="cal-wd">${w}</span>`).join('')}
          ${list
            .map(([d, out]) => {
              const h = hijri(d, adj());
              const big = mode === 'greg' ? d.d : h.day;
              const small = mode === 'greg' ? h.day : d.d;
              const dot = occasionsOn(d, adj()).length ? 'occ' : h.day >= 13 && h.day <= 15 ? 'white' : '';
              return `<button class="cal-day ${out ? 'out' : ''} ${sameDay(d, selected) ? 'sel' : ''} ${sameDay(d, t.day) ? 'today' : ''} ${wd(d) === 5 ? 'fri' : ''}" data-day="${dayKey(d)}">
                <b>${num(big)}</b><small>${num(small)}</small>${dot ? `<i class="${dot}"></i>` : ''}</button>`;
            })
            .join('')}
        </div>
        <div class="cal-legend"><span><i class="occ"></i> مناسبة</span><span><i class="white"></i> الأيام البيض</span></div>
      </section>

      <section class="card cal-dayinfo">
        <div class="card-head"><h2>${icon('calendar', 18)} ${weekday(selected)}${sameDay(selected, t.day) ? ' — اليوم' : ''}</h2></div>
        <p class="cal-dates"><b>${hijriText(selected, adj())}</b><span>${gregText(selected)}</span></p>
        ${occ.map((o) => `<button class="cal-occ" data-occ="${o.id}">${icon(o.icon, 18)}<span>${esc(o.name)}</span>${icon('chevron', 16)}</button>`).join('')}
        ${white ? `<p class="cal-note">${icon('moon', 15)} من الأيام البيض: يُستحب صيامها</p>` : ''}
        ${wd(selected) === 1 || wd(selected) === 4 ? `<p class="cal-note">${icon('leaf', 15)} يُستحب صيام الاثنين والخميس</p>` : ''}
        <div class="cal-times">
          ${TIMES.map((k) => {
            const name = TIME_NAMES[k] || times[k].name;
            return `<div><span>${icon(TIME_ICONS[k], 18)}</span><small>${name}</small><b>${clockText(times[k].hours, h24)}</b></div>`;
          }).join('')}
        </div>
      </section>`;
  };
  draw();

  view.onclick = (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) {
      mode = m.dataset.mode;
      greg = { y: selected.y, m: selected.m };
      hij = hijri(selected, adj());
      return draw();
    }
    const step = e.target.closest('[data-month]');
    if (step) {
      const n = Number(step.dataset.month);
      if (mode === 'greg') {
        const i = greg.y * 12 + greg.m - 1 + n;
        greg = { y: Math.floor(i / 12), m: (i % 12) + 1 };
      } else {
        const i = hij.year * 12 + hij.month - 1 + n;
        hij = { year: Math.floor(i / 12), month: (i % 12) + 1, day: 1 };
      }
      return draw();
    }
    const d = e.target.closest('[data-day]');
    if (d) {
      selected = parseKey(d.dataset.day);
      // A day from the next or previous month opens that month.
      greg = { y: selected.y, m: selected.m };
      hij = hijri(selected, adj());
      return draw();
    }
    if (e.target.closest('[data-today]')) {
      selected = today().day;
      greg = { y: selected.y, m: selected.m };
      hij = hijri(selected, adj());
      return draw();
    }
    const o = e.target.closest('[data-occ]');
    if (o) {
      const entry = occasionsFrom(addDays(selected, 0), adj(), 30).find((x) => x.id === o.dataset.occ);
      if (entry) occasionSheet(entry);
    }
  };
  return {
    destroy() {
      view.onclick = null;
    },
  };
}

// ---- Occasions ----

export function renderOccasions(view) {
  const t = today();
  const list = occasionsFrom(t.day, adj());
  const next = list[0];
  // Grouped under their Hijri month and year.
  const groups = [];
  for (const e of list) {
    const label = `${HIJRI_MONTHS[e.hijri.month - 1]} ${num(e.hijri.year)}`;
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] });
    groups.at(-1).items.push(e);
  }
  const left = (e) => daysBetween(t.day, e.start);
  view.innerHTML = `
    ${pageHeader('المناسبات', { back: '#/home', actions: `<a class="icon-btn ghost" href="#/calendar" aria-label="التقويم">${icon('grid', 22)}</a>` })}
    ${
      next
        ? `<section class="card occ-next" data-key="${next.key}">
            <div class="occ-next-top">
              <span class="occ-ic">${icon(next.icon, 26)}</span>
              <div><small>${left(next) <= 0 ? 'المناسبة الحالية' : 'المناسبة القادمة'}</small><b>${esc(next.name)}</b></div>
              <span class="pill">${left(next) < 0 ? 'جارية الآن' : daysText(left(next))}</span>
            </div>
            <div class="occ-next-dates">
              <div><small>التاريخ الهجري</small><b>${num(next.hijri.day)} ${HIJRI_MONTHS[next.hijri.month - 1]} ${num(next.hijri.year)} هـ</b></div>
              <div><small>التاريخ الميلادي</small><b>${rangeText(next.start, next.end)}</b></div>
            </div>
          </section>`
        : ''
    }
    <p class="hint">التواريخ محسوبة بتقويم أم القرى، وقد تختلف بداية الشهر بحسب ثبوت رؤية الهلال في بلدك. يمكنك تعديل التاريخ الهجري يوماً من <a class="link" href="#/settings">الإعدادات</a>.</p>
    ${groups
      .map(
        (g) => `<div class="group list">
          <h4>${g.label}</h4>
          ${g.items
            .map(
              (e) => `<button class="row occ-row" data-key="${e.key}">
                <span class="row-icon">${icon(e.icon, 20)}</span>
                <span class="row-label">${esc(e.name)}<small>${rangeText(e.start, e.end)}</small></span>
                <span class="row-value">${left(e) < 0 ? 'الآن' : daysText(left(e))}</span></button>`
            )
            .join('')}
        </div>`
      )
      .join('')}`;
  view.onclick = (e) => {
    const r = e.target.closest('[data-key]');
    if (r) occasionSheet(list.find((x) => x.key === r.dataset.key));
  };
  return {
    destroy() {
      view.onclick = null;
    },
  };
}

function occasionSheet(e) {
  const t = today();
  const n = daysBetween(t.day, e.start);
  openSheet(
    `<div class="occ-sheet">
       <span class="occ-ic">${icon(e.icon, 30)}</span>
       <p class="occ-when"><b>${num(e.hijri.day)} ${HIJRI_MONTHS[e.hijri.month - 1]} ${num(e.hijri.year)} هـ</b><span>${rangeText(e.start, e.end)} • ${n < 0 ? 'جارية الآن' : daysText(n)}</span></p>
       <p class="occ-text">${esc(e.text)}</p>
       ${e.ref ? `<small class="muted">${esc(e.ref)}</small>` : ''}
       <a class="btn ghost wide" href="#/calendar/${dayKey(e.start)}" data-close>${icon('calendar', 18)} عرضها في التقويم</a>
     </div>`,
    null,
    { title: e.name }
  );
}

// The next occasion within `days`, for a card on the home screen.
export function nextOccasion(within = 45) {
  const t = today();
  const e = occasionsFrom(t.day, adj(), within)[0];
  return e ? { ...e, left: daysBetween(t.day, e.start), weekdayName: WEEKDAYS[wd(e.start)] } : null;
}
