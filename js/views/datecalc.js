// «حاسبة التاريخ»: the difference between two dates, and a date some days before or after
// another, each in the Gregorian or the Hijri (Umm al-Qura) calendar.

import { fromHijri, gregText, hijri, HIJRI_MONTHS, hijriMonthLength, hijriText, num, weekday } from '../dates.js';
import { icon } from '../icons.js';
import { addDays, dayKey } from '../prayer.js';
import { daysBetween } from '../occasions.js';
import { state } from '../store.js';
import { today } from '../today.js';
import { pageHeader } from '../ui.js';

const ui = { tab: 'diff', from: null, to: null, base: null, cal: { from: 'g', to: 'g', base: 'g' }, days: 30, dir: 1 };

const plural = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${num(n)} ${few}` : `${num(n)} ${many}`);
const daysWord = (n) => plural(n, 'يوم واحد', 'يومان', 'أيام', 'يوماً');
const monthsWord = (n) => plural(n, 'شهر واحد', 'شهران', 'أشهر', 'شهراً');
const yearsWord = (n) => plural(n, 'سنة واحدة', 'سنتان', 'سنوات', 'سنة');
const span = ({ y, m, d }) => [y && yearsWord(y), m && monthsWord(m), (d || (!y && !m)) && daysWord(d)].filter(Boolean).join(' و');

// Whole years, months and days from a to b (a ≤ b) on a calendar given by its month lengths.
function breakdown(a, b, monthLen) {
  let y = b.y - a.y;
  let m = b.m - a.m;
  let d = b.d - a.d;
  if (d < 0) {
    m--;
    const pm = b.m === 1 ? 12 : b.m - 1;
    d += monthLen(b.m === 1 ? b.y - 1 : b.y, pm);
  }
  if (m < 0) {
    y--;
    m += 12;
  }
  return { y, m, d };
}
const gregLen = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function render(view) {
  const adj = state.settings.hijriAdjust;
  const now = today().day;
  ui.from ??= now;
  ui.to ??= addDays(now, 30);
  ui.base ??= now;
  const H = (day) => {
    const h = hijri(day, adj);
    return { y: h.year, m: h.month, d: h.day };
  };

  const dateCard = (id, label) => {
    const day = ui[id];
    const cal = ui.cal[id];
    const h = H(day);
    const opts = (n, sel, text = (i) => num(i)) => Array.from({ length: n }, (_, i) => `<option value="${i + 1}" ${i + 1 === sel ? 'selected' : ''}>${text(i + 1)}</option>`).join('');
    const years = Array.from({ length: 201 }, (_, i) => h.y - 100 + i);
    return `<section class="card dc-date">
      <div class="dc-date-top">
        <small>${label} · ${weekday(day)}</small>
        <div class="seg-mini" data-cal="${id}">
          <button class="${cal === 'g' ? 'on' : ''}" data-v="g">ميلادي</button>
          <button class="${cal === 'h' ? 'on' : ''}" data-v="h">هجري</button>
        </div>
      </div>
      <div class="dc-date-main">
        ${icon('calendar', 26)}
        <span><b>${cal === 'g' ? gregText(day) : hijriText(day, adj)}</b><small>${cal === 'g' ? hijriText(day, adj) : gregText(day)}</small></span>
      </div>
      ${
        cal === 'g'
          ? `<label class="dc-edit">${icon('edit', 18)}<input type="date" value="${dayKey(day)}" data-g="${id}"></label>`
          : `<div class="dc-edit hij" data-h="${id}">${icon('edit', 18)}
              <select name="d" aria-label="اليوم">${opts(hijriMonthLength(h.y, h.m, adj), h.d)}</select>
              <select name="m" aria-label="الشهر">${opts(12, h.m, (i) => HIJRI_MONTHS[i - 1])}</select>
              <select name="y" aria-label="السنة">${years.map((y) => `<option value="${y}" ${y === h.y ? 'selected' : ''}>${num(y)}</option>`).join('')}</select>
            </div>`
      }
    </section>`;
  };

  const diff = () => {
    const [a, b] = daysBetween(ui.from, ui.to) >= 0 ? [ui.from, ui.to] : [ui.to, ui.from];
    const n = daysBetween(a, b);
    const g = breakdown(a, b, gregLen);
    const hj = breakdown(H(a), H(b), (y, m) => hijriMonthLength(y, m, adj));
    return `
      ${dateCard('from', 'من')}
      ${dateCard('to', 'إلى')}
      <section class="card dc-result">
        <div><small>بالأيام</small><b class="big">${daysWord(n)}</b></div>
        <div><small>بالأسابيع</small><b>${n >= 7 ? `${plural(Math.floor(n / 7), 'أسبوع واحد', 'أسبوعان', 'أسابيع', 'أسبوعاً')}${n % 7 ? ` و${daysWord(n % 7)}` : ''}` : '—'}</b></div>
        <div><small>بالأشهر</small><b>${span(g)}</b></div>
        <div><small>بالتقويم الهجري</small><b>${span(hj)}</b></div>
      </section>`;
  };

  const plus = () => {
    const out = addDays(ui.base, ui.dir * ui.days);
    return `
      ${dateCard('base', 'التاريخ')}
      <div class="dc-days">
        <label class="field"><span>عدد الأيام</span><input type="number" inputmode="numeric" min="0" max="100000" value="${ui.days}" data-days></label>
        <div class="seg-mini" data-dir>
          <button class="${ui.dir === 1 ? 'on' : ''}" data-v="1">بعد</button>
          <button class="${ui.dir === -1 ? 'on' : ''}" data-v="-1">قبل</button>
        </div>
      </div>
      <section class="card dc-result out" data-out>
        <small>${weekday(out)}</small>
        <b class="big">${gregText(out)}</b>
        <span>${hijriText(out, adj)}</span>
      </section>`;
  };

  const draw = () => {
    view.innerHTML = `
      ${pageHeader('حاسبة التاريخ', { back: '#/tools' })}
      <div class="w-tabs" role="tablist">
        <button class="${ui.tab === 'diff' ? 'on' : ''}" data-seg="diff" role="tab">الفرق بين تاريخين</button>
        <button class="${ui.tab === 'plus' ? 'on' : ''}" data-seg="plus" role="tab">تاريخ + أيام</button>
      </div>
      ${ui.tab === 'diff' ? diff() : plus()}`;
  };
  draw();

  view.onclick = (e) => {
    const tb = e.target.closest('[data-seg]');
    if (tb) {
      ui.tab = tb.dataset.seg;
      return draw();
    }
    const cal = e.target.closest('[data-cal] [data-v]');
    if (cal) {
      ui.cal[cal.closest('[data-cal]').dataset.cal] = cal.dataset.v;
      return draw();
    }
    const dir = e.target.closest('[data-dir] [data-v]');
    if (dir) {
      ui.dir = Number(dir.dataset.v);
      draw();
    }
  };
  view.onchange = (e) => {
    const t = e.target;
    if (t.matches('[data-g]') && /^\d{4}-\d\d-\d\d$/.test(t.value)) {
      const [y, m, d] = t.value.split('-').map(Number);
      ui[t.dataset.g] = { y, m, d };
      return draw();
    }
    const box = t.closest('[data-h]');
    if (box) {
      const get = (n) => Number(box.querySelector(`[name=${n}]`).value);
      const [y, m] = [get('y'), get('m')];
      // A 30th carried into a month of 29 becomes its last day.
      const day = fromHijri(y, m, Math.min(get('d'), hijriMonthLength(y, m, adj)), adj);
      if (day) ui[box.dataset.h] = day;
      draw();
    }
  };
  view.oninput = (e) => {
    if (!e.target.matches('[data-days]')) return;
    ui.days = Math.max(0, Math.min(100000, Math.round(Number(e.target.value) || 0)));
    const out = addDays(ui.base, ui.dir * ui.days);
    view.querySelector('[data-out]').innerHTML = `<small>${weekday(out)}</small><b class="big">${gregText(out)}</b><span>${hijriText(out, adj)}</span>`;
  };
  return { destroy: () => (view.onclick = view.onchange = view.oninput = null) };
}
