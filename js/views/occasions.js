// The Islamic occasions of the year with how long until each: the occasions tab, a card on
// the home screen for the next one, and a sheet with the virtue of each.

import { GREG_MONTHS, HIJRI_MONTHS, num, WEEKDAYS } from '../dates.js';
import { icon } from '../icons.js';
import { daysBetween, occasionsFrom } from '../occasions.js';
import { state } from '../store.js';
import { today } from '../today.js';
import { esc, openSheet, pageHeader } from '../ui.js';

const adj = () => state.settings.hijriAdjust;
const wd = (day) => new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
const sameDay = (a, b) => a && b && a.y === b.y && a.m === b.m && a.d === b.d;

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
    ${pageHeader('المناسبات', { sub: 'أيام الإسلام وفضلها ومتى تأتي' })}
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
       <p class="occ-when"><b>${num(e.hijri.day)} ${HIJRI_MONTHS[e.hijri.month - 1]} ${num(e.hijri.year)} هـ</b><span>${rangeText(e.start, e.end)} • ${daysBetween(t.day, e.end) < 0 ? 'انتهت' : n < 0 ? 'جارية الآن' : daysText(n)}</span></p>
       <p class="occ-text">${esc(e.text)}</p>
       ${e.ref ? `<small class="muted">${esc(e.ref)}</small>` : ''}
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
