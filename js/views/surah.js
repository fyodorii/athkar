// Reading al-Kahf, al-Mulk and al-Baqarah: as the pages of the Madinah mushaf (each page in
// its own King Fahd Complex font, swiped like a mushaf), or as continuous text. The place you
// stopped at is kept for next time; finishing al-Mulk or al-Baqarah ticks it in «عباداتي».

import { num } from '../dates.js';
import { JUZ, SURAHS } from '../quran-data.js';
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
const INKS = { blue: 'أزرق', black: 'أسود' };

export function renderSurah(view, id) {
  const meta = QUICK_SURAHS.find((q) => q.id === id);
  if (!meta) {
    location.replace('#/quran');
    return null;
  }
  const mark = (state.surahs[id] ??= { ayah: 0, done: '', page: 0 });
  let cleanup = null;
  let alive = true;
  let drawn = 0; // which draw() a pending import belongs to

  const draw = () => {
    cleanup?.();
    const gen = ++drawn;
    const live = () => alive && gen === drawn;
    const pages = (state.settings.mushafMode || 'pages') === 'pages';
    const ink = state.settings.mushafInk || 'blue';
    view.innerHTML = `
      ${pageHeader(`سورة ${meta.name}`, {
        back: '#/quran',
        sub: meta.when === 'كل جمعة' ? 'تُقرأ يوم الجمعة' : meta.when === 'كل ليلة' ? 'تُقرأ كل ليلة' : 'تُقرأ في البيت',
        actions: `<button class="icon-btn ghost" data-mode aria-label="${pages ? 'نص متصل' : 'صفحات المصحف'}">${icon(pages ? 'rows' : 'book', 22)}</button>${
          pages
            ? `<button class="icon-btn ghost" data-ink aria-label="لون الخط: ${INKS[ink]}"><span class="ink-dot ${ink}"></span></button>`
            : `<button class="icon-btn ghost" data-zoom="-1" aria-label="تصغير الخط">${icon('minus', 22)}</button><button class="icon-btn ghost" data-zoom="1" aria-label="تكبير الخط">${icon('plus', 22)}</button>`
        }`,
      })}
      <div data-body><p class="center muted">جارٍ التحميل…</p></div>
      <button class="btn primary wide" data-done>${icon('check', 20)} ${mark.done === today().key ? 'قرأتها اليوم' : 'أتممت قراءتها'}</button>`;
    cleanup = pages ? mushafPages(view, id, mark, live) : continuous(view, id, mark, live);
  };
  draw();

  view.onclick = (e) => {
    if (e.target.closest('[data-mode]')) {
      state.settings.mushafMode = (state.settings.mushafMode || 'pages') === 'pages' ? 'text' : 'pages';
      save();
      return draw();
    }
    if (e.target.closest('[data-ink]')) {
      state.settings.mushafInk = (state.settings.mushafInk || 'blue') === 'blue' ? 'black' : 'blue';
      save();
      $('.mp-scroller', view)?.setAttribute('data-ink', state.settings.mushafInk);
      $('[data-ink] .ink-dot', view).className = `ink-dot ${state.settings.mushafInk}`;
      return toast(`لون الخط: ${INKS[state.settings.mushafInk]}`);
    }
    const z = e.target.closest('[data-zoom]');
    if (z) {
      state.settings.quranScale = Math.max(0.8, Math.min(1.8, Math.round((scale() + Number(z.dataset.zoom) * 0.1) * 10) / 10));
      save();
      $('.mushaf', view)?.style.setProperty('--qscale', scale());
      return;
    }
    const step = e.target.closest('[data-mp-step]');
    if (step) {
      const list = [...view.querySelectorAll('.mp')];
      const i = list.findIndex((x) => Number(x.dataset.page) === mark.page);
      list[Math.max(0, Math.min(list.length - 1, i + Number(step.dataset.mpStep)))]?.scrollIntoView({ inline: 'start', block: 'nearest', behavior: 'smooth' });
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
      mark.page = 0;
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
      cleanup?.();
      view.onclick = null;
    },
  };
}

// ---- The mushaf's pages ----

// Page fonts already handed to the browser (they stay for the whole visit).
const fontsReady = new Map(); // family → Promise

function pageFont(family, file) {
  if (!fontsReady.has(family)) {
    const f = new window.FontFace(family, `url(fonts/qpc/${file}.woff2)`);
    const p = f.load().then((ff) => {
      document.fonts.add(ff);
      return true;
    });
    p.catch(() => fontsReady.delete(family));
    fontsReady.set(family, p);
  }
  return fontsReady.get(family);
}

const juzOf = (page) => JUZ.filter((first) => first <= page).length;

function pageHtml(pg, surahNo) {
  // The page's own surah name: the one whose header or ayat come first on it.
  const first = pg.lines.find((l) => l[0] === 't')?.[1][0][1];
  const name = SURAHS[(Number(first?.split(':')[0]) || surahNo) - 1][0];
  const centred = pg.p <= 2;
  const lines = pg.lines
    .map((l) => {
      if (l[0] === 'h') return `<div class="mp-h"><span>سورة ${SURAHS[l[1] - 1][0]}</span></div>`;
      if (l[0] === 'b') return '<div class="mp-l mp-b">ﭑﭒﭓ</div>';
      return `<div class="mp-l ${centred ? 'c' : ''}">${l[1].map(([g, a]) => `<span data-a="${a}">${g}</span>`).join('')}</div>`;
    })
    .join('');
  return `<section class="mp" data-page="${pg.p}">
    <div class="mp-sheet">
      <header class="mp-top"><span>${esc(name)}</span><span>الجزء ${num(juzOf(pg.p))}</span></header>
      <div class="mp-lines" style="--pf:'qpc-p${pg.p}'">${lines}</div>
      <p class="mp-wait">جارٍ تحميل الصفحة…</p>
      <footer class="mp-num"><span>${num(pg.p)}</span></footer>
    </div>
  </section>`;
}

function mushafPages(view, id, mark, alive) {
  let observer;
  let saveTimer;
  import(`../mushaf/${id}.js`).then(({ PAGES }) => {
    if (!alive()) return;
    const surahNo = { kahf: 18, mulk: 67, baqarah: 2 }[id];
    $('[data-body]', view).innerHTML = `
      <div class="mp-bar">
        <button class="icon-btn ghost sm flip" data-mp-step="-1" aria-label="الصفحة السابقة">${icon('chevron', 20)}</button>
        <span data-mp-info></span>
        <button class="icon-btn ghost sm" data-mp-step="1" aria-label="الصفحة التالية">${icon('chevron', 20)}</button>
      </div>
      <div class="mp-scroller" dir="rtl" data-ink="${state.settings.mushafInk || 'blue'}">${PAGES.map((pg) => pageHtml(pg, surahNo)).join('')}</div>
      <p class="hint center">اسحب يميناً ويساراً لتقليب الصفحات • خط مصحف المدينة من مجمع الملك فهد</p>`;
    const scroller = $('.mp-scroller', view);
    const list = PAGES.map((pg) => pg.p);
    pageFont('qpc-bsml', 'bsml');
    const ready = (p) =>
      pageFont(`qpc-p${p}`, `p${p}`)
        .then(() => {
          const el = scroller.querySelector(`[data-page="${p}"]`);
          if (!el || el.classList.contains('ready')) return;
          el.classList.add('ready');
          // A few lines are denser than the rest: shrink just those to fit the page's width.
          requestAnimationFrame(() => {
            for (const l of el.querySelectorAll('.mp-l')) {
              if (l.scrollWidth > l.clientWidth + 1) l.style.fontSize = `${(parseFloat(window.getComputedStyle(l).fontSize) * l.clientWidth) / l.scrollWidth - 0.2}px`;
            }
          });
        })
        .catch(() => {
          const w = scroller.querySelector(`[data-page="${p}"] .mp-wait`);
          if (w) w.textContent = 'تعذّر تحميل الصفحة — تحتاج اتصالاً بالإنترنت أول مرة';
        });
    const show = (p) => {
      mark.page = p;
      const i = list.indexOf(p);
      $('[data-mp-info]', view).textContent = `صفحة ${num(p)} • ${num(i + 1)} من ${num(list.length)}`;
      [list[i - 1], p, list[i + 1]].filter(Boolean).forEach(ready);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 500);
    };
    observer = new window.IntersectionObserver(
      (entries) => {
        for (const en of entries) if (en.isIntersecting) show(Number(en.target.dataset.page));
      },
      { root: scroller, threshold: 0.6 }
    );
    scroller.querySelectorAll('.mp').forEach((el) => observer.observe(el));
    // Open where reading stopped last time.
    const start = list.includes(mark.page) ? mark.page : list[0];
    show(start);
    if (start !== list[0]) scroller.querySelector(`[data-page="${start}"]`)?.scrollIntoView({ inline: 'start', block: 'nearest' });
  });
  return () => {
    observer?.disconnect();
    clearTimeout(saveTimer);
  };
}

// ---- Continuous text (larger, resizable) ----

function continuous(view, id, mark, alive) {
  let saveTimer;
  import(`../surahs/${id}.js`).then(({ SURAH, AYAT }) => {
    if (!alive()) return;
    let page = 0;
    const parts = [];
    AYAT.forEach(([text, p], i) => {
      if (p !== page) {
        if (page) parts.push(`</p><div class="mushaf-page"><span>${num(page)}</span></div><p class="hafs">`);
        page = p;
      }
      parts.push(`<span class="aya" data-a="${i + 1}">${esc(text)}</span> `);
    });
    const meta = QUICK_SURAHS.find((q) => q.id === id);
    $('[data-body]', view).innerHTML = `
      <div class="banner gold">${icon(meta.icon, 22)}<div><b>${esc(meta.virtue)}</b><span>${esc(meta.ref)}</span></div></div>
      <div data-resume>${mark.ayah > 3 && mark.ayah < AYAT.length ? `<button class="btn ghost wide" data-resume-go>${icon('bookmark', 18)} أكمل من حيث توقفت — الآية ${num(mark.ayah)}</button>` : ''}</div>
      <section class="mushaf" style="--qscale:${scale()}">
        <p class="mushaf-title">سورة ${esc(SURAH.name)}</p>
        <p class="hafs basmala">${BASMALA}</p>
        <p class="hafs">${parts.join('')}</p>
        <div class="mushaf-page"><span>${num(page)}</span></div>
      </section>`;
  });
  // Remember the first ayah on screen as the place to come back to.
  const onScroll = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.3)?.closest?.('.aya[data-a]');
      if (el) {
        mark.ayah = Number(el.dataset.a);
        save();
      }
    }, 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => {
    clearTimeout(saveTimer);
    window.removeEventListener('scroll', onScroll);
  };
}
