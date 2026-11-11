// «ختمتي»: where the reading has reached in the mushaf, the pages read out of 604 with a
// segment for each juz, and starting again from the juz or a new khatma.

import { gregText, num } from '../dates.js';
import { icon } from '../icons.js';
import { dayKey } from '../prayer.js';
import { JUZ, PAGES } from '../quran-data.js';
import { save, state } from '../store.js';
import { today } from '../today.js';
import { confirmSheet, haptic, openSheet, pageHeader, toast } from '../ui.js';

// The juz (1…30) a page is in.
export const juzOf = (page) => {
  let j = 0;
  while (j < 29 && JUZ[j + 1] <= page) j++;
  return j + 1;
};

export function render(view) {
  const k = state.khatma;

  const draw = () => {
    const pos = Math.min(PAGES, Math.max(1, k.pos));
    const finished = k.read >= PAGES;
    const juz = juzOf(pos);
    const segs = JUZ.map((start, i) => {
      const end = (JUZ[i + 1] || PAGES + 1) - 1;
      const f = Math.max(0, Math.min(1, (k.read - start + 1) / (end - start + 1)));
      return `<i class="${f >= 1 ? 'full' : f > 0 ? 'part' : ''}" title="الجزء ${num(i + 1)}"></i>`;
    }).join('');
    view.innerHTML = `
      ${pageHeader('ختمتي', { back: '#/home', actions: `<a class="icon-btn" href="#/settings/notify" aria-label="تذكير الورد">${icon('bell', 20)}</a>` })}
      <section class="card kh-pos">
        <small>موضعك</small>
        <b>${finished ? 'أتممت الختمة، تقبّل الله منك' : `أكمل من صفحة ${num(pos)} – الجزء ${num(juz)}`}</b>
        ${
          finished
            ? `<button class="btn primary wide" data-new>${icon('reset', 20)} ابدأ ختمة جديدة</button>`
            : `<button class="btn primary wide" data-mark>${icon('bookmark', 20)} سجّل وين وصلت</button>`
        }
      </section>
      <section class="card kh-progress">
        <span>قرأتَ ${num(Math.min(PAGES, k.read))} من ${num(PAGES)} صفحة</span>
        <div class="kh-segs">${segs}</div>
      </section>
      <div class="kh-actions">
        <button data-juz>${icon('reset', 26)}<span><b>ابدأ من أول الجزء</b><small>إذا انقطع خيطك – وتقدّمك ما ينقص</small></span></button>
        <button data-new>${icon('reset', 26)}<span><b>ابدأ ختمة جديدة</b><small>والحالية تُحفظ في سجلّك</small></span></button>
      </div>
      ${
        k.history.length
          ? `<section class="group"><h4>سجلّ الختمات</h4>
          ${[...k.history]
            .reverse()
            .map((h, i) => `<div class="row"><span class="row-icon">${icon(h.pages >= PAGES ? 'check' : 'quran', 20)}</span><span class="row-label">${h.pages >= PAGES ? 'ختمة تامة' : `${num(h.pages)} صفحة`}<small>${h.start ? `${dateOf(h.start)} – ` : ''}${dateOf(h.end)}</small></span><span class="row-value">${num(k.history.length - i)}</span></div>`)
            .join('')}</section>`
          : ''
      }`;
  };

  const dateOf = (ms) => {
    const d = new Date(ms);
    return gregText({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
  };

  // The last page read: moves the place, and counts the pages in today's wird.
  const mark = () => {
    let page = Math.min(PAGES, Math.max(1, k.pos));
    openSheet(
      `<p class="sheet-sub">آخر صفحة قريتها</p>
       <div class="kh-pick">
         <button class="icon-btn" data-d="-1" aria-label="أقل">${icon('minus', 22)}</button>
         <b data-page></b>
         <button class="icon-btn" data-d="1" aria-label="أكثر">${icon('plus', 22)}</button>
       </div>
       <input class="kh-range" type="range" min="1" max="${PAGES}" step="1" value="${page}" data-range>
       <div class="sheet-actions"><button class="btn primary" data-ok>سجّل</button></div>`,
      (el, close) => {
        const show = () => {
          el.querySelector('[data-page]').textContent = `صفحة ${num(page)}`;
          el.querySelector('[data-range]').value = page;
        };
        show();
        el.addEventListener('click', (e) => {
          const d = e.target.closest('[data-d]');
          if (d) {
            page = Math.min(PAGES, Math.max(1, page + Number(d.dataset.d)));
            haptic();
            return show();
          }
          if (!e.target.closest('[data-ok]')) return;
          const added = Math.max(0, page - k.pos + 1);
          if (!k.startedAt) k.startedAt = Date.now();
          k.pos = page + 1;
          k.read = Math.max(k.read, page);
          if (added) {
            const day = (state.worship[dayKey(today().day)] ??= {});
            day.quran = Math.min(999, (day.quran || 0) + added);
          }
          save();
          close();
          draw();
          toast(k.read >= PAGES ? `${icon('check', 18)} أتممت الختمة، تقبّل الله منك` : `${icon('check', 18)} سُجّلت صفحة ${num(page)}${added ? ` • ${num(added)} في ورد اليوم` : ''}`);
        });
        el.addEventListener('input', (e) => {
          if (!e.target.matches('[data-range]')) return;
          page = Number(e.target.value);
          show();
        });
      },
      { title: 'وين وصلت؟' }
    );
  };

  draw();
  view.onclick = async (e) => {
    if (e.target.closest('[data-mark]')) return mark();
    if (e.target.closest('[data-juz]')) {
      k.pos = JUZ[juzOf(Math.min(PAGES, Math.max(1, k.pos))) - 1];
      save();
      draw();
      return toast(`${icon('check', 18)} تبدأ من أول الجزء ${num(juzOf(k.pos))}، صفحة ${num(k.pos)}`);
    }
    if (e.target.closest('[data-new]')) {
      if (k.read > 0 && k.read < PAGES && !(await confirmSheet('تبدأ ختمة جديدة من أول المصحف؟ الحالية تُحفظ في سجلّك.', { ok: 'ابدأ ختمة جديدة', danger: false }))) return;
      if (k.read > 0) k.history.push({ start: k.startedAt, end: Date.now(), pages: Math.min(PAGES, k.read) });
      Object.assign(k, { pos: 1, read: 0, startedAt: 0 });
      save();
      draw();
    }
  };
  return { destroy: () => (view.onclick = null) };
}
