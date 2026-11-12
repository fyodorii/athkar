// «ختماتي»: one or more khatmas, each with where its reading has reached in the mushaf, the
// pages read out of 604 with a segment for each juz, and its own name.

import { gregText, num } from '../dates.js';
import { icon } from '../icons.js';
import { dayKey } from '../prayer.js';
import { JUZ, PAGES } from '../quran-data.js';
import { save, state, uid } from '../store.js';
import { today } from '../today.js';
import { confirmSheet, esc, haptic, openSheet, pageHeader, ring, toast } from '../ui.js';

// The juz (1…30) a page is in.
export const juzOf = (page) => {
  let j = 0;
  while (j < 29 && JUZ[j + 1] <= page) j++;
  return j + 1;
};

const clamp = (p) => Math.min(PAGES, Math.max(1, p));
const dateOf = (ms) => {
  const d = new Date(ms);
  return gregText({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
};

export function render(view) {
  const find = (id) => state.khatmas.find((k) => k.id === id);

  const card = (k) => {
    const pos = clamp(k.pos);
    const read = Math.min(PAGES, k.read);
    const done = read >= PAGES;
    const segs = JUZ.map((start, i) => {
      const end = (JUZ[i + 1] || PAGES + 1) - 1;
      const f = Math.max(0, Math.min(1, (k.read - start + 1) / (end - start + 1)));
      return `<i class="${f >= 1 ? 'full' : f > 0 ? 'part' : ''}"></i>`;
    }).join('');
    return `<section class="card kh" data-k="${k.id}">
      <div class="kh-top">
        <span class="kh-ring">${ring(read / PAGES, 58, 5)}<b>${num(Math.round((read / PAGES) * 100))}%</b></span>
        <span class="kh-text">
          <small>${esc(k.name)}</small>
          <b>${done ? 'أتممت الختمة، تقبّل الله منك' : `أكمل من صفحة ${num(pos)}`}</b>
          <small>${done ? `${num(PAGES)} صفحة` : `الجزء ${num(juzOf(pos))} • قرأت ${num(read)} من ${num(PAGES)}`}</small>
        </span>
        <button class="icon-btn ghost sm" data-more aria-label="خيارات">${icon('more', 20)}</button>
      </div>
      <div class="kh-segs">${segs}</div>
      ${
        done
          ? `<button class="btn primary wide" data-again>${icon('reset', 20)} ابدأها من جديد</button>`
          : `<button class="btn primary wide" data-mark>${icon('bookmark', 20)} سجّل وين وصلت</button>`
      }
    </section>`;
  };

  const draw = () => {
    view.innerHTML = `
      ${pageHeader('ختماتي', { back: '#/home', actions: `<a class="icon-btn" href="#/settings/notify" aria-label="تذكير الورد">${icon('bell', 20)}</a>` })}
      ${state.khatmas.map(card).join('') || `<div class="empty"><div class="empty-art">${icon('quran', 44)}</div><b>لا ختمات</b><p>ابدأ ختمة، وسجّل كل يوم أين وصلت.</p></div>`}
      <button class="btn ghost wide" data-new>${icon('plus', 20)} ختمة جديدة</button>
      ${
        state.khatmaLog.length
          ? `<section class="group kh-log"><h4>سجلّ الختمات</h4>
          ${[...state.khatmaLog]
            .reverse()
            .map((h) => `<div class="row"><span class="row-icon">${icon(h.pages >= PAGES ? 'check' : 'quran', 20)}</span><span class="row-label">${esc(h.name || 'ختمة')}<small>${h.start ? `${dateOf(h.start)} – ` : ''}${dateOf(h.end)}</small></span><span class="row-value">${h.pages >= PAGES ? 'تامة' : `${num(h.pages)} صفحة`}</span></div>`)
            .join('')}</section>`
          : ''
      }
      <p class="hint center">ما تسجّله من الصفحات يُضاف إلى ورد القرآن في متابعة اليوم.</p>`;
  };

  // The last page read: moves the place, and counts the pages in today's wird.
  const mark = (k) => {
    let page = clamp(k.pos);
    openSheet(
      `<p class="sheet-sub">آخر صفحة قريتها في «${esc(k.name)}»</p>
       <div class="kh-pick">
         <button class="icon-btn" data-d="-1" aria-label="أقل">${icon('minus', 22)}</button>
         <b data-page></b>
         <button class="icon-btn" data-d="1" aria-label="أكثر">${icon('plus', 22)}</button>
       </div>
       <input class="kh-range" type="range" min="1" max="${PAGES}" step="1" value="${page}" data-range>
       <div class="sheet-actions"><button class="btn primary" data-ok>سجّل</button></div>`,
      (el, close) => {
        const show = () => {
          el.querySelector('[data-page]').textContent = `صفحة ${num(page)} • الجزء ${num(juzOf(page))}`;
          el.querySelector('[data-range]').value = page;
        };
        show();
        el.addEventListener('click', (e) => {
          const d = e.target.closest('[data-d]');
          if (d) {
            page = clamp(page + Number(d.dataset.d));
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

  // Ends a khatma into the log (if anything was read) and starts it over.
  const restart = (k) => {
    if (k.read > 0) state.khatmaLog.push({ name: k.name, start: k.startedAt, end: Date.now(), pages: Math.min(PAGES, k.read) });
    Object.assign(k, { pos: 1, read: 0, startedAt: 0 });
    save();
    draw();
  };

  // A new khatma, or a new name for one.
  const edit = (k) => {
    openSheet(
      `<form class="form">
         <label class="field"><span>اسم الختمة</span><input name="name" maxlength="40" required value="${esc(k?.name || '')}" placeholder="مثل: ختمة رمضان، ختمة التدبر"></label>
         ${k ? '' : `<label class="field"><span>تبدأ من صفحة</span><input name="page" type="number" inputmode="numeric" min="1" max="${PAGES}" value="1"></label>`}
         <div class="sheet-actions"><button class="btn primary" type="submit">${k ? 'حفظ' : 'ابدأ الختمة'}</button><button class="btn ghost" type="button" data-close>إلغاء</button></div>
       </form>`,
      (el, close) => {
        const f = el.querySelector('form');
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = f.name.value.trim();
          if (!name) return;
          if (k) k.name = name;
          else {
            const page = clamp(Math.round(Number(f.page.value) || 1));
            state.khatmas.push({ id: uid(), name, pos: page, read: page - 1, startedAt: 0 });
          }
          save();
          close();
          draw();
        });
        if (!k) setTimeout(() => f.name.focus(), 300);
      },
      { title: k ? 'اسم الختمة' : 'ختمة جديدة' }
    );
  };

  const menu = (k) => {
    openSheet(
      `<div class="menu">
         <button data-a="name">${icon('edit', 20)} تغيير الاسم</button>
         <button data-a="juz">${icon('reset', 20)} ابدأ من أول الجزء<small>إذا انقطع خيطك – وتقدّمك ما ينقص</small></button>
         <button data-a="again">${icon('reset', 20)} ابدأها من جديد<small>والحالية تُحفظ في السجل</small></button>
         <button class="danger" data-a="del">${icon('trash', 20)} حذف الختمة</button>
       </div>`,
      (el, close) =>
        el.addEventListener('click', async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (!a) return;
          close();
          if (a === 'name') return edit(k);
          if (a === 'juz') {
            k.pos = JUZ[juzOf(clamp(k.pos)) - 1];
            save();
            draw();
            return toast(`${icon('check', 18)} تبدأ من أول الجزء ${num(juzOf(k.pos))}، صفحة ${num(k.pos)}`);
          }
          if (a === 'again') {
            if (k.read > 0 && k.read < PAGES && !(await confirmSheet('تبدأ هذه الختمة من أول المصحف؟ ما قرأته يُحفظ في السجل.', { ok: 'ابدأ من جديد', danger: false }))) return;
            return restart(k);
          }
          if (a === 'del' && (await confirmSheet(`حذف «${k.name}»؟`))) {
            state.khatmas = state.khatmas.filter((x) => x !== k);
            save();
            draw();
          }
        }),
      { title: k.name }
    );
  };

  draw();
  view.onclick = (e) => {
    if (e.target.closest('[data-new]')) return edit(null);
    const k = find(e.target.closest('[data-k]')?.dataset.k);
    if (!k) return;
    if (e.target.closest('[data-mark]')) return mark(k);
    if (e.target.closest('[data-again]')) return restart(k);
    if (e.target.closest('[data-more]')) menu(k);
  };
  return { destroy: () => (view.onclick = null) };
}
