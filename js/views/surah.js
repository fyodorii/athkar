// Reading al-Kahf, al-Mulk and al-Baqarah in the mushaf's script, with the place you
// stopped at kept for next time; finishing al-Mulk or al-Baqarah ticks it in «عباداتي».

import { num } from '../dates.js';
import { icon } from '../icons.js';
import { BASMALA } from '../ruqyah-data.js';
import { save, state } from '../store.js';
import { today } from '../today.js';
import { $, esc, haptic, pageHeader, toast } from '../ui.js';

export const QUICK_SURAHS = [
  { id: 'kahf', name: 'الكهف', icon: 'mountain', when: 'كل جمعة', virtue: '«من قرأ سورة الكهف يوم الجمعة أضاء له من النور ما بين الجمعتين»', ref: 'رواه الحاكم والبيهقي، وصححه الألباني' },
  { id: 'mulk', name: 'الملك', icon: 'crown', when: 'كل ليلة', virtue: '«سورة من القرآن ثلاثون آية شفعت لرجل حتى غُفر له، وهي: تبارك الذي بيده الملك»', ref: 'رواه أبو داود والترمذي وحسّنه' },
  { id: 'baqarah', name: 'البقرة', icon: 'shield', when: 'في البيت', virtue: '«لا تجعلوا بيوتكم مقابر، إن الشيطان ينفر من البيت الذي تُقرأ فيه سورة البقرة»', ref: 'رواه مسلم' },
];

// The «وصول سريع» card: the three surahs a tap away.
export function quickSurahs() {
  return `<section class="card quick-surahs">
    <h3>وصول سريع</h3>
    <div>${QUICK_SURAHS.map((q) => `<a href="#/surah/${q.id}"><span class="qs-ic">${icon(q.icon, 22)}</span><b>${q.name}</b></a>`).join('')}</div>
  </section>`;
}

const scale = () => state.settings.quranScale || 1;

export function renderSurah(view, id) {
  const meta = QUICK_SURAHS.find((q) => q.id === id);
  if (!meta) {
    location.replace('#/quran');
    return null;
  }
  const mark = (state.surahs[id] ??= { ayah: 0, done: '' });
  let alive = true;
  let saveTimer;

  view.innerHTML = `
    ${pageHeader(`سورة ${meta.name}`, {
      back: '#/quran',
      sub: meta.when === 'كل جمعة' ? 'تُقرأ يوم الجمعة' : meta.when === 'كل ليلة' ? 'تُقرأ كل ليلة' : 'تُقرأ في البيت',
      actions: `<button class="icon-btn ghost" data-zoom="-1" aria-label="تصغير الخط">${icon('minus', 22)}</button><button class="icon-btn ghost" data-zoom="1" aria-label="تكبير الخط">${icon('plus', 22)}</button>`,
    })}
    <div class="banner gold">${icon(meta.icon, 22)}<div><b>${esc(meta.virtue)}</b><span>${esc(meta.ref)}</span></div></div>
    <div data-resume></div>
    <section class="mushaf" style="--qscale:${scale()}"><p class="center muted">جارٍ التحميل…</p></section>`;

  import(`../surahs/${id}.js`).then(({ SURAH, AYAT }) => {
    if (!alive) return;
    let page = 0;
    const parts = [];
    AYAT.forEach(([text, p], i) => {
      if (p !== page) {
        if (page) parts.push(`</p><div class="mushaf-page"><span>${num(page)}</span></div><p class="hafs">`);
        page = p;
      }
      parts.push(`<span class="aya" data-a="${i + 1}">${esc(text)}</span> `);
    });
    $('.mushaf', view).innerHTML = `
      <p class="mushaf-title">سورة ${esc(SURAH.name)}</p>
      <p class="hafs basmala">${BASMALA}</p>
      <p class="hafs">${parts.join('')}</p>
      <div class="mushaf-page"><span>${num(page)}</span></div>`;
    $('.mushaf', view).insertAdjacentHTML(
      'afterend',
      `<button class="btn primary wide" data-done>${icon('check', 20)} ${mark.done === today().key ? 'قرأتها اليوم' : 'أتممت قراءتها'}</button>`
    );
    if (mark.ayah > 3 && mark.ayah < AYAT.length) {
      $('[data-resume]', view).innerHTML = `<button class="btn ghost wide" data-resume-go>${icon('bookmark', 18)} أكمل من حيث توقفت — الآية ${num(mark.ayah)}</button>`;
    }
  });

  // Remember the first ayah on screen as the place to come back to.
  const onScroll = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.3)?.closest?.('[data-a]');
      if (el) {
        mark.ayah = Number(el.dataset.a);
        save();
      }
    }, 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  view.onclick = (e) => {
    const z = e.target.closest('[data-zoom]');
    if (z) {
      state.settings.quranScale = Math.max(0.8, Math.min(1.8, Math.round((scale() + Number(z.dataset.zoom) * 0.1) * 10) / 10));
      save();
      $('.mushaf', view).style.setProperty('--qscale', scale());
      return;
    }
    if (e.target.closest('[data-resume-go]')) {
      $(`[data-a="${mark.ayah}"]`, view)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      $(`[data-a="${mark.ayah}"]`, view)?.classList.add('flash');
      e.target.closest('[data-resume-go]').remove();
      return;
    }
    if (e.target.closest('[data-done]')) {
      const key = today().key;
      mark.done = key;
      mark.ayah = 0;
      if (id === 'mulk' || id === 'baqarah') (state.worship[key] ??= {})[id] = 1;
      save();
      haptic(30);
      e.target.closest('[data-done]').innerHTML = `${icon('check', 20)} قرأتها اليوم`;
      toast(`${icon('check', 18)} تقبّل الله منك${id === 'kahf' ? '' : ' — سُجّلت في عباداتي'}`);
    }
  };
  return {
    destroy() {
      alive = false;
      clearTimeout(saveTimer);
      window.removeEventListener('scroll', onScroll);
      view.onclick = null;
    },
  };
}
