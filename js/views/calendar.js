// «التقويم»: a Hijri month of the Umm al-Qura calendar, each day with its Gregorian date and
// dots for what it holds: an occasion, a recommended fast, a day in history, the user's own
// appointments. A tapped day shows them in a bubble over it.

import { clock, fromHijri, GREG_MONTHS, hijri, hijriMonthLength, HIJRI_MONTHS, num, weekday } from '../dates.js';
import { icon } from '../icons.js';
import { addDays, dayKey, dayTimes } from '../prayer.js';
import { save, state, uid } from '../store.js';
import { PRAYERS, today } from '../today.js';
import { $, esc, openSheet, pageHeader, toast } from '../ui.js';

const DAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const wd = (day) => new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
const same = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;

// What a Hijri day holds: [kind, label], kind one of occasion, fast, history.
export function dayEvents(h, weekdayNum) {
  const out = [];
  const [m, d] = [h.month, h.day];
  const eid = (m === 10 && d === 1) || (m === 12 && d >= 10 && d <= 13);
  if (m === 1 && d === 1) out.push(['occasion', 'رأس السنة الهجرية']);
  if (m === 9 && d === 1) out.push(['occasion', 'بداية شهر رمضان']);
  if (m === 9 && d === 21) out.push(['occasion', 'العشر الأواخر من رمضان']);
  if (m === 10 && d === 1) out.push(['occasion', 'عيد الفطر']);
  if (m === 12 && d === 8) out.push(['occasion', 'يوم التروية']);
  if (m === 12 && d === 9) out.push(['occasion', 'يوم عرفة']);
  if (m === 12 && d === 10) out.push(['occasion', 'عيد الأضحى']);
  if (m === 12 && d >= 11 && d <= 13) out.push(['occasion', 'أيام التشريق']);
  if (m === 9 && d === 17) out.push(['history', 'غزوة بدر الكبرى (٢ هـ)']);
  if (m === 9 && d === 20) out.push(['history', 'فتح مكة (٨ هـ)']);
  if (!eid && m !== 9) {
    if (m === 1 && d === 9) out.push(['fast', 'صيام تاسوعاء']);
    if (m === 1 && d === 10) out.push(['fast', 'صيام عاشوراء']);
    if (m === 12 && d === 9) out.push(['fast', 'صيام يوم عرفة']);
    else if (m === 12 && d <= 8) out.push(['fast', 'العشر من ذي الحجة']);
    if (d >= 13 && d <= 15) out.push(['fast', 'الأيام البيض']);
    if (weekdayNum === 1) out.push(['fast', 'صيام الاثنين']);
    if (weekdayNum === 4) out.push(['fast', 'صيام الخميس']);
  }
  return out;
}

const apptsOf = (day) => state.appts[dayKey(day)] || [];

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

  const dots = (day, h) => {
    const kinds = new Set(dayEvents(h, wd(day)).map(([k]) => k));
    if (apptsOf(day).length) kinds.add('appt');
    return ['occasion', 'fast', 'history', 'appt'].filter((k) => kinds.has(k)).map((k) => `<i class="dot-${k}"></i>`).join('');
  };

  const cell = ([day, out]) => {
    const h = hijri(day, adj());
    return `<button class="cl-day ${out ? 'out' : ''} ${same(day, now) ? 'today' : ''} ${same(day, picked) ? 'on' : ''}" data-day="${day.y}-${day.m}-${day.d}">
      <b>${num(h.day)}</b><small>${num(day.d)}</small><span class="cl-dots">${dots(day, h)}</span></button>`;
  };

  const bubble = () => {
    if (!picked) return '';
    const h = hijri(picked, adj());
    const ev = dayEvents(h, wd(picked));
    const ap = apptsOf(picked);
    return `<div class="cl-pop" data-pop>
      <b>${num(h.day)} ${HIJRI_MONTHS[h.month - 1]}</b>
      <small>${weekday(picked)} ${num(picked.d)} ${GREG_MONTHS[picked.m - 1]} ${num(picked.y)}</small>
      ${ev.map(([k, l]) => `<span class="ev-${k}">${l}</span>`).join('')}
      ${ap.map((a) => `<span class="ev-appt">${esc(a.text)}</span>`).join('')}
      <button data-appts>${icon('calendar', 18)} مواعيدي${ap.length ? ` (${num(ap.length)})` : ''}</button>
      <i class="cl-pop-tip"></i>
    </div>`;
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
        ${bubble()}
      </section>
      <div class="cl-legend"><span><i class="dot-occasion"></i>مناسبة</span><span><i class="dot-fast"></i>صيام مستحب</span><span><i class="dot-history"></i>حدث تاريخي</span><span><i class="dot-appt"></i>مواعيدي</span></div>
      ${days.some((d) => same(d, now)) ? '' : `<button class="btn ghost wide" data-today>${icon('reset', 18)} العودة إلى الشهر الحالي</button>`}
      ${dayInfo(picked || now)}
      <p class="hint">التاريخ الهجري بتقويم أم القرى، وقد تختلف بداية الشهر بحسب رؤية الهلال. يمكنك تعديله يوماً من <a class="link" href="#/settings">الإعدادات</a>.</p>`;
    placeBubble();
  };

  // The bubble sits over the tapped day, its tip pointing at it, kept within the calendar.
  const placeBubble = () => {
    const pop = $('[data-pop]', view);
    if (!pop) return;
    const cal = $('[data-cal]', view);
    const c = $('.cl-day.on', view);
    const cr = cal.getBoundingClientRect();
    const r = c.getBoundingClientRect();
    const w = pop.offsetWidth;
    const mid = r.left + r.width / 2 - cr.left;
    const left = Math.max(6, Math.min(cr.width - w - 6, mid - w / 2));
    pop.style.left = `${left}px`;
    const above = r.top - cr.top - pop.offsetHeight - 10;
    if (above >= 0) pop.style.top = `${above}px`;
    else {
      pop.style.top = `${r.bottom - cr.top + 10}px`;
      pop.classList.add('below');
    }
    $('.cl-pop-tip', pop).style.left = `${mid - left - 8}px`;
  };

  const apptSheet = (day) => {
    const key = dayKey(day);
    const h = hijri(day, adj());
    openSheet(
      `<div data-body></div>`,
      (el) => {
        const body = el.querySelector('[data-body]');
        const drawSheet = () => {
          const list = state.appts[key] || [];
          body.innerHTML = `
            <p class="hint">${weekday(day)} ${num(h.day)} ${HIJRI_MONTHS[h.month - 1]} ${num(h.year)} هـ · ${num(day.d)} ${GREG_MONTHS[day.m - 1]} ${num(day.y)}</p>
            ${list.length ? `<div class="menu">${list.map((x) => `<div class="appt-row"><span>${esc(x.text)}</span><button class="icon-btn ghost sm" data-del="${x.id}" aria-label="حذف">${icon('close', 18)}</button></div>`).join('')}</div>` : '<p class="hint center">لا مواعيد في هذا اليوم.</p>'}
            <form class="sur-add" data-add><input name="text" maxlength="100" required placeholder="موعد جديد…"><button class="btn primary" type="submit">${icon('plus', 18)} أضف</button></form>`;
        };
        drawSheet();
        body.addEventListener('submit', (e) => {
          e.preventDefault();
          const text = e.target.text.value.trim();
          if (!text) return;
          (state.appts[key] ??= []).push({ id: uid(), text });
          save();
          drawSheet();
          draw();
          toast(`${icon('check', 18)} أُضيف الموعد`);
        });
        body.addEventListener('click', (e) => {
          const d = e.target.closest('[data-del]');
          if (!d) return;
          state.appts[key] = (state.appts[key] || []).filter((x) => x.id !== d.dataset.del);
          if (!state.appts[key].length) delete state.appts[key];
          save();
          drawSheet();
          draw();
        });
      },
      { title: 'مواعيدي' }
    );
  };

  draw();
  view.onclick = (e) => {
    if (e.target.closest('[data-appts]')) return apptSheet(picked);
    if (e.target.closest('[data-pop]')) return;
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
      picked = same(day, picked) ? null : day;
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
