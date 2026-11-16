// «التقويم»: a month of the Umm al-Qura calendar, Hijri or Gregorian, each day with its other
// date; a tapped day shows its dates and its prayer times.

import { clock, fromHijri, GREG_MONTHS, hijri, hijriMonthLength, HIJRI_MONTHS, num, weekday } from '../dates.js';
import { icon } from '../icons.js';
import { addDays, dayTimes } from '../prayer.js';
import { save, state } from '../store.js';
import { PRAYERS, today } from '../today.js';
import { $, pageHeader } from '../ui.js';

const DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const wd = (day) => new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
const same = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;

export function render(view) {
  const s = state.settings;
  const adj = () => s.hijriAdjust;
  const now = today().day;
  let anchor = now; // a day of the month shown
  let picked = now;

  // The days of the month that holds `anchor`, in the chosen calendar.
  const monthDays = () => {
    if (s.calMode === 'greg') {
      const len = new Date(Date.UTC(anchor.y, anchor.m, 0)).getUTCDate();
      return Array.from({ length: len }, (_, i) => ({ y: anchor.y, m: anchor.m, d: i + 1 }));
    }
    const h = hijri(anchor, adj());
    const first = fromHijri(h.year, h.month, 1, adj()) || addDays(anchor, 1 - h.day);
    return Array.from({ length: hijriMonthLength(h.year, h.month, adj()) }, (_, i) => addDays(first, i));
  };

  const title = (days) => {
    if (s.calMode === 'greg') return { main: `${GREG_MONTHS[anchor.m - 1]} ${num(anchor.y)}`, sub: hijriSpan(days) };
    const h = hijri(anchor, adj());
    const a = days[0];
    const b = days.at(-1);
    const greg = a.m === b.m ? `${GREG_MONTHS[a.m - 1]} ${num(a.y)}` : `${GREG_MONTHS[a.m - 1]} – ${GREG_MONTHS[b.m - 1]} ${num(b.y)}`;
    return { main: `${HIJRI_MONTHS[h.month - 1]} ${num(h.year)} هـ`, sub: greg };
  };
  const hijriSpan = (days) => {
    const a = hijri(days[0], adj());
    const b = hijri(days.at(-1), adj());
    return a.month === b.month ? `${HIJRI_MONTHS[a.month - 1]} ${num(a.year)} هـ` : `${HIJRI_MONTHS[a.month - 1]} – ${HIJRI_MONTHS[b.month - 1]} ${num(b.year)} هـ`;
  };

  const cell = (day) => {
    const h = hijri(day, adj());
    const [big, small] = s.calMode === 'greg' ? [day.d, h.day === 1 ? HIJRI_MONTHS[h.month - 1] : h.day] : [h.day, day.d === 1 ? GREG_MONTHS[day.m - 1] : day.d];
    const fri = wd(day) === 5;
    return `<button class="cal-day ${same(day, now) ? 'today' : ''} ${same(day, picked) ? 'on' : ''} ${fri ? 'fri' : ''}" data-day="${day.y}-${day.m}-${day.d}">
      <b>${num(big)}</b><small>${typeof small === 'number' ? num(small) : small}</small></button>`;
  };

  const dayInfo = (day) => {
    const h = hijri(day, adj());
    const times = dayTimes(day, s, h.month === 9);
    const tile = (k) => {
      const c = clock(times[k].hours, s.clock24);
      return `<li><small>${times[k].name}</small><b>${c.time}</b><span>${c.period}</span></li>`;
    };
    return `<section class="card cal-info">
      <div class="cal-info-head">
        <span class="cal-info-ic">${icon('calendar', 20)}</span>
        <div><b>${weekday(day)}${same(day, now) ? ' · اليوم' : ''}</b>
          <span>${num(h.day)} ${HIJRI_MONTHS[h.month - 1]} ${num(h.year)} هـ</span>
          <small>${num(day.d)} ${GREG_MONTHS[day.m - 1]} ${num(day.y)} م</small></div>
      </div>
      <ul class="cal-times">${['fajr', 'sunrise', ...PRAYERS.slice(1)].map(tile).join('')}</ul>
    </section>`;
  };

  const draw = () => {
    const days = monthDays();
    const t = title(days);
    const lead = wd(days[0]);
    view.innerHTML = `
      ${pageHeader('التقويم', { sub: 'تقويم أم القرى' })}
      <div class="seg-mini wide cal-mode" data-mode>
        <button class="${s.calMode !== 'greg' ? 'on' : ''}" data-v="hijri">هجري</button>
        <button class="${s.calMode === 'greg' ? 'on' : ''}" data-v="greg">ميلادي</button>
      </div>
      <section class="card cal">
        <div class="cal-head">
          <button class="icon-btn ghost" data-step="-1" aria-label="الشهر السابق">${icon('back', 22)}</button>
          <button class="cal-title" data-today><b>${t.main}</b><small>${t.sub}</small></button>
          <button class="icon-btn ghost" data-step="1" aria-label="الشهر التالي">${icon('chevron', 22)}</button>
        </div>
        <div class="cal-grid">
          ${DAYS.map((d) => `<span class="cal-wd">${d}</span>`).join('')}
          ${'<i></i>'.repeat(lead)}${days.map(cell).join('')}
        </div>
        ${same(anchor, now) || days.some((d) => same(d, now)) ? '' : `<button class="btn ghost wide cal-back" data-today>${icon('reset', 18)} العودة إلى اليوم</button>`}
      </section>
      ${dayInfo(picked)}
      <p class="hint">التاريخ الهجري بتقويم أم القرى، وقد تختلف بداية الشهر بحسب رؤية الهلال. يمكنك تعديله يوماً من <a class="link" href="#/settings">الإعدادات</a>.</p>`;
  };
  draw();

  view.onclick = (e) => {
    const m = e.target.closest('[data-mode] [data-v]');
    if (m) {
      s.calMode = m.dataset.v;
      save();
      return draw();
    }
    const st = e.target.closest('[data-step]');
    if (st) {
      const days = monthDays();
      anchor = Number(st.dataset.step) < 0 ? addDays(days[0], -1) : addDays(days.at(-1), 1);
      return draw();
    }
    if (e.target.closest('[data-today]')) {
      anchor = picked = now;
      return draw();
    }
    const d = e.target.closest('[data-day]');
    if (d) {
      const [y, mo, dd] = d.dataset.day.split('-').map(Number);
      picked = { y, m: mo, d: dd };
      const y0 = window.scrollY;
      draw();
      window.scrollTo(0, y0);
      $('.cal-info', view)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
