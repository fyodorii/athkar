// A surah read whole from the sleep adhkar (as-Sajdah, al-Mulk): its pages as in the Madinah Mushaf,
// each in a framed page with its number, the surah's name and the basmala at its head.

import { num } from '../dates.js';
import { icon } from '../icons.js';
import { BASMALA, SURAH_PAGES } from '../mushaf-data.js';
import { esc, pageHeader } from '../ui.js';

export function render(view, n) {
  const s = SURAH_PAGES[n];
  if (!s) {
    location.replace('#/adhkar/sleep');
    return null;
  }
  view.innerHTML = `
    ${pageHeader(`سورة ${s.name}`, { back: '#/adhkar/sleep', sub: `${num(s.count)} آية · مصحف المدينة` })}
    <div class="ms">
      ${s.pages.map(([page, verses], i) => `<section class="ms-page">
        ${i === 0 ? `<div class="ms-head"><span>سورة ${esc(s.name)}</span></div><p class="ms-basmala hafs">${esc(BASMALA)}</p>` : ''}
        <p class="ms-text hafs">${verses.map(esc).join(' ')}</p>
        <span class="ms-num">${num(page)}</span>
      </section>`).join('')}
    </div>
    <a class="btn ghost wide" href="#/adhkar/sleep">${icon('back', 18)} العودة إلى أذكار النوم</a>`;
  return null;
}
