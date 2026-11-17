// «التقويم»: a Hijri month of the Umm al-Qura calendar, each day with its Gregorian date; a
// tapped day shows its prayer times.

import { clock, fromHijri, GREG_MONTHS, hijri, hijriMonthLength, HIJRI_MONTHS, num, weekday } from '../dates.js';
import { icon } from '../icons.js';
import { addDays, dayTimes } from '../prayer.js';
import { state } from '../store.js';
import { PRAYERS, today } from '../today.js';
import { pageHeader } from '../ui.js';

const DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const wd = (day) => new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
const same = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;

export function render(view) {
  const s = state.settings;
  const adj = () => s.hijriAdjust;
  const now = today().day;
  let anchor = now; // a day of the Hijri month shown
  let picked = null; // the day whose bubble is open

  const month = () => {
    const h = hijri(anchor, adj());
    const first = fromHijri(h.year, h.month, 1, adj()) || addDays(anchor, 1 - h.day);
    const len = hijriMonthLength(h.year, h.month, adj());
    const days = Array.from({ length: len }, (_, i) => addDays(first, i));
    const lead = wd(first);
    const before = Array.from({ length: lead }, (_, i) => addDays(first, i - lead));
    const tail = (7 - ((lead + len) % 7)) % 7;
    const after = Array.from({ length: tail }, (_, i) => addDays(days.at(-1), i + 1));
    return { h, days, cells: [...before.map((d) => [d, true]), ...days.map((d) => [d, false]), ...after.map((d) => [d, true])] };
  };

  const cell = ([day, out]) => {
    const h = hijri(day, adj());
    return `<button class="cl-day ${out ? 'out' : ''} ${same(day, now) ? 'today' : ''} ${same(day, picked) ? 'on' : ''}" data-day="${day.y}-${day.m}-${day.d}">
      <b>${num(h.day)}</b><small>${num(day.d)}</small></button>`;
  };

  const dayInfo = (day) => {
    const h = hijri(day, adj());
    const times = dayTimes(day, s, h.month === 9);
    const tile = (k) => {
      const c = clock(times[k].hours, s.clock24);
      return `<li><small>${times[k].name}</small><b>${c.time}</b><span>${c.period}</span></li>`;
    };
    return `<section class="card cal-info">
      <div class="cal-info-head"><b>مواقيت ${same(day, now) ? 'اليوم' : `${weekday(day)} ${num(h.day)} ${HIJRI_MONTHS[h.month - 1]}`}</b></div>
      <ul class="cal-times">${['fajr', 'sunrise', ...PRAYERS.slice(1)].map(tile).join('')}</ul>
    </section>`;
  };

  const draw = () => {
    const { h, days, cells } = month();
    const a = days[0];
    const b = days.at(-1);
    const greg = a.y === b.y ? `${GREG_MONTHS[a.m - 1]} – ${GREG_MONTHS[b.m - 1]} ${num(b.y)}` : `${GREG_MONTHS[a.m - 1]} ${num(a.y)} – ${GREG_MONTHS[b.m - 1]} ${num(b.y)}`;
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(`<div class="cl-row">${cells.slice(i, i + 7).map(cell).join('')}</div>`);
    view.innerHTML = `
      ${pageHeader('التقويم', { sub: 'تقويم أم القرى' })}
      <div class="cl-head">
        <div><h2>${HIJRI_MONTHS[h.month - 1]} ${num(h.year)}</h2><small>${icon('calendar', 16)} ${a.m === b.m ? `${GREG_MONTHS[a.m - 1]} ${num(a.y)}` : greg}</small></div>
        <span class="cl-nav">
          <button data-step="-1" aria-label="الشهر السابق">${icon('back', 20)}</button>
          <button data-step="1" aria-label="الشهر التالي">${icon('chevron', 20)}</button>
        </span>
      </div>
      <section class="cl-cal" data-cal>
        <div class="cl-wds">${DAYS.map((d) => `<span>${d}</span>`).join('')}</div>
        ${rows.join('')}
      </section>
      ${days.some((d) => same(d, now)) ? '' : `<button class="btn ghost wide" data-today>${icon('reset', 18)} العودة إلى الشهر الحالي</button>`}
      ${dayInfo(picked || now)}
      <p class="hint">التاريخ الهجري بتقويم أم القرى، وقد تختلف بداية الشهر بحسب رؤية الهلال. يمكنك تعديله يوماً من <a class="link" href="#/settings">الإعدادات</a>.</p>`;
  };

  draw();
  view.onclick = (e) => {
    const st = e.target.closest('[data-step]');
    if (st) {
      const { days } = month();
      anchor = Number(st.dataset.step) < 0 ? addDays(days[0], -1) : addDays(days.at(-1), 1);
      picked = null;
      return draw();
    }
    if (e.target.closest('[data-today]')) {
      anchor = now;
      picked = null;
      return draw();
    }
    const d = e.target.closest('[data-day]');
    if (d) {
      const [y, mo, dd] = d.dataset.day.split('-').map(Number);
      const day = { y, m: mo, d: dd };
      picked = day;
      if (picked && d.classList.contains('out')) anchor = picked; // a day of the next or previous month opens it
      const y0 = window.scrollY;
      draw();
      window.scrollTo(0, y0);
      return;
    }
    if (picked) {
      picked = null;
      draw();
    }
  };
  return { destroy: () => (view.onclick = null) };
}

// The week of today, for the home screen: seven days from today, today marked.
export function weekStrip(info) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(info.day, i);
    return `<li class="${i ? '' : 'today'}"><small>${DAYS[wd(day)]}</small><b>${num(day.d)}</b><span>${num(hijri(day, state.settings.hijriAdjust).day)}</span></li>`;
  }).join('');
}
