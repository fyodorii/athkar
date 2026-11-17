// «آيات»: one verse on a quiet page, a different one each time it is opened (or tapped).

import { AYAT } from '../daily-data.js';
import { icon } from '../icons.js';
import { copyText, esc, shareText } from '../ui.js';

const LAST = 'adhkar-app:ayah';

function pick() {
  let last = -1;
  try {
    last = Number(localStorage.getItem(LAST) ?? -1);
  } catch (e) {
    /* nothing kept */
  }
  let i = Math.floor(Math.random() * AYAT.length);
  if (AYAT.length > 1 && i === last) i = (i + 1 + Math.floor(Math.random() * (AYAT.length - 1))) % AYAT.length;
  try {
    localStorage.setItem(LAST, String(i));
  } catch (e) {
    /* nothing kept */
  }
  return i;
}

// "الرعد: ٢٨" → "سورة الرعد · آية ٢٨"
const refText = (ref) => {
  const [surah, ayah] = String(ref).split(':').map((x) => x.trim());
  return ayah ? `سورة ${surah} · آية ${ayah}` : `سورة ${surah}`;
};

export function render(view) {
  let i = pick();
  const draw = () => {
    const [ayah, plain, ref] = AYAT[i];
    view.innerHTML = `
      <section class="ay-page">
        <header class="ay-top">
          <a class="icon-btn ghost" href="#/home" aria-label="رجوع">${icon('back', 22)}</a>
          <span class="ay-actions">
            <button class="icon-btn ghost" data-copy aria-label="نسخ">${icon('copy', 20)}</button>
            <button class="icon-btn ghost" data-share aria-label="مشاركة">${icon('share', 20)}</button>
          </span>
        </header>
        <button class="ay-body" data-next aria-label="آية أخرى">
          <p class="ay-text hafs">${esc(ayah)}</p>
          <small class="ay-ref">${esc(refText(ref))}</small>
        </button>
        <button class="ay-more" data-next>${icon('reset', 16)} آية أخرى</button>
      </section>`;
    view.dataset.plain = `﴿${plain}﴾ [${refText(ref)}]`;
  };
  draw();
  view.onclick = (e) => {
    if (e.target.closest('[data-next]')) {
      i = pick();
      draw();
    } else if (e.target.closest('[data-copy]')) copyText(view.dataset.plain);
    else if (e.target.closest('[data-share]')) shareText(view.dataset.plain);
  };
  return { destroy: () => {
    view.onclick = null;
    delete view.dataset.plain;
  } };
}
