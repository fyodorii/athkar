// My adhkar (the user's own list, with counters and reminders, which can also be
// filled from the authentic adhkar), and the full-screen tasbeeh.

import { CATEGORIES } from '../adhkar-data.js';
import { num } from '../dates.js';
import { icon } from '../icons.js';
import { syncSchedule } from '../push.js';
import { newDay, save, state, uid } from '../store.js';
import { today } from '../today.js';
import { $, $$, confirmSheet, esc, haptic, openSheet, pageHeader, ring, segmented, shareText, toast } from '../ui.js';

export const MINE_TABS = [
  ['#/mine', 'أذكاري'],
  ['#/notebook', 'أدعيتي'],
  ['#/notebook/saved', 'المحفوظات'],
];
const TABS = MINE_TABS;

// ---- My adhkar ----

export function renderMine(view, focusId) {
  const draw = () => {
    newDay(today().key);
    const list = state.custom;
    view.innerHTML = `
      ${pageHeader('أذكاري', {
        sub: 'أذكارك الخاصة بعدّادها وتذكيرها',
        actions: `<button class="icon-btn ghost" data-pick aria-label="من الأذكار المأثورة">${icon('book', 22)}</button><button class="icon-btn primary" data-add aria-label="إضافة ذكر">${icon('plus', 22)}</button>`,
      })}
      ${segmented(TABS, '#/mine')}
      ${
        list.length
          ? `<section class="mine-list">${list.map(mineCard).join('')}</section>
             <button class="btn ghost wide pick-more" data-pick>${icon('book', 20)} أضف من الأذكار المأثورة</button>`
          : `<div class="empty">
              <div class="empty-art">${icon('beads', 44)}</div>
              <b>أضف ذكرك الأول</b>
              <p>اكتب الذكر الذي تحب المداومة عليه، وحدّد عدده اليومي، واختر وقتاً ليذكّرك التطبيق به.</p>
              <button class="btn primary" data-add>${icon('plus', 20)} إضافة ذكر</button>
              <button class="btn ghost" data-pick>${icon('book', 20)} اختر من الأذكار المأثورة</button>
            </div>`
      }`;
    if (focusId) {
      const el = $(`[data-id="${CSS.escape(focusId)}"]`, view);
      if (el) {
        el.classList.add('flash');
        setTimeout(() => el.scrollIntoView({ block: 'center' }), 50);
      }
      focusId = null;
    }
  };
  draw();

  const onClick = (e) => {
    if (e.target.closest('[data-add]')) return editCustom(null, draw);
    if (e.target.closest('[data-pick]')) return pickAdhkar(draw);
    const card = e.target.closest('.mine');
    if (!card) return;
    const item = state.custom.find((c) => c.id === card.dataset.id);
    if (e.target.closest('[data-more]')) return customMenu(item, draw);
    newDay(today().key);
    item.today = (item.today || 0) + 1;
    item.total = (item.total || 0) + 1;
    save();
    haptic();
    card.outerHTML = mineCard(item);
    if (item.today === item.target) {
      haptic(30);
      toast(`${icon('check', 18)} أتممت وردك اليومي من هذا الذكر`);
    }
  };
  view.addEventListener('click', onClick);
  return { destroy: () => view.removeEventListener('click', onClick) };
}

function mineCard(c) {
  const done = c.target && c.today >= c.target;
  return `<article class="mine ${done ? 'done' : ''}" data-id="${c.id}">
    <div class="mine-body">
      <p class="mine-text ${c.quran ? 'hafs' : ''}">${esc(c.text)}</p>
      ${c.ref ? `<p class="mine-ref">${esc(c.ref)}</p>` : ''}
      <div class="mine-meta">
        ${c.reminder ? `<span class="pill">${icon('bell', 14)} ${num(c.reminder)}</span>` : ''}
        <span class="pill soft">المجموع ${num(c.total || 0)}</span>
      </div>
    </div>
    <div class="mine-count">
      ${ring(c.target ? Math.min(1, (c.today || 0) / c.target) : 0, 64, 5)}
      <span><b>${num(c.today || 0)}</b>${c.target ? `<small>/${num(c.target)}</small>` : ''}</span>
    </div>
    <button class="icon-btn ghost sm more" data-more aria-label="خيارات">${icon('more', 20)}</button>
  </article>`;
}

function customMenu(item, redraw) {
  openSheet(
    `<p class="sheet-preview">${esc(item.text)}</p>
     <div class="menu">
       <button data-a="edit">${icon('edit', 20)} تعديل</button>
       <button data-a="reset">${icon('reset', 20)} تصفير عدّاد اليوم</button>
       <button data-a="note">${icon('book', 20)} نسخه إلى دفتري</button>
       <button data-a="share">${icon('share', 20)} مشاركة</button>
       <button data-a="delete" class="danger">${icon('trash', 20)} حذف</button>
     </div>`,
    (el, close) => {
      el.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (!a) return;
        close();
        if (a === 'edit') editCustom(item, redraw);
        if (a === 'reset') {
          item.today = 0;
          save();
          redraw();
        }
        if (a === 'note') {
          state.notebook.unshift({ id: uid(), title: '', text: item.text, tag: 'ذكر', pinned: false, created: Date.now(), updated: Date.now() });
          save();
          toast(`${icon('check', 18)} أُضيف إلى دفتري`);
        }
        if (a === 'share') shareText(item.text);
        if (a === 'delete' && (await confirmSheet('حذف هذا الذكر من أذكاري؟'))) {
          state.custom = state.custom.filter((c) => c.id !== item.id);
          save();
          syncSchedule();
          redraw();
        }
      });
    },
    { title: 'الذكر' }
  );
}

const TARGETS = [0, 3, 7, 10, 33, 100, 1000];

export function editCustom(item, onDone, preset = {}) {
  const c = item || { text: preset.text || '', target: 33, reminder: '' };
  openSheet(
    `<form class="form" data-form>
       <label class="field"><span>نص الذكر</span>
         <textarea name="text" rows="4" required placeholder="مثال: سبحان الله وبحمده، سبحان الله العظيم">${esc(c.text)}</textarea></label>
       <div class="field"><span>العدد اليومي</span>
         <div class="chips" data-targets>
           ${TARGETS.map((t) => `<button type="button" class="chip-opt ${c.target === t ? 'on' : ''}" data-t="${t}">${t ? num(t) : 'مفتوح'}</button>`).join('')}
         </div>
         <input type="number" name="target" inputmode="numeric" min="0" max="100000" value="${c.target || ''}" placeholder="أو اكتب عدداً">
       </div>
       <label class="field row"><span>${icon('bell', 18)} تذكير يومي</span>
         <input type="time" name="reminder" value="${esc(c.reminder || '')}"></label>
       <p class="hint">يصلك التذكير في هذا الوقت كل يوم إذا فعّلت التنبيهات من الإعدادات. اتركه فارغاً لإيقافه.</p>
       <div class="sheet-actions">
         <button class="btn primary" type="submit">${item ? 'حفظ' : 'إضافة'}</button>
         <button class="btn ghost" type="button" data-close>إلغاء</button>
       </div>
     </form>`,
    (el, close) => {
      const form = el.querySelector('form');
      el.querySelector('[data-targets]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-t]');
        if (!b) return;
        $$('.chip-opt', el).forEach((x) => x.classList.toggle('on', x === b));
        form.target.value = b.dataset.t === '0' ? '' : b.dataset.t;
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = form.text.value.trim();
        if (!text) return;
        const target = Math.max(0, Math.min(100000, parseInt(form.target.value, 10) || 0));
        const reminder = form.reminder.value || '';
        if (item) Object.assign(item, { text, target, reminder });
        else state.custom.unshift({ id: uid(), text, target, reminder, today: 0, total: 0, created: Date.now() });
        save();
        syncSchedule();
        close();
        toast(`${icon('check', 18)} ${item ? 'حُفظ التعديل' : 'أُضيف الذكر إلى أذكاري'}`);
        onDone?.();
      });
      if (!item) setTimeout(() => form.text.focus(), 300);
    },
    { title: item ? 'تعديل الذكر' : 'ذكر جديد' }
  );
}

// Adds adhkar from the Book and Sunnah to "my adhkar", a whole set or one by one.
function pickAdhkar(redraw) {
  const have = new Set(state.custom.map((c) => c.text));
  openSheet(
    `<p class="hint">اختر ما تريد إضافته إلى أذكارك، بعدده ومصدره. يمكنك تعديله أو حذفه بعد ذلك.</p>
     ${CATEGORIES.map(
       (c) => `<details class="pick-cat">
         <summary><span class="tone-${c.tone} pick-icon">${icon(c.icon, 18)}</span><b>${esc(c.title)}</b><small>${num(c.items.length)}</small></summary>
         <button type="button" class="btn ghost wide" data-all="${c.id}">${icon('plus', 18)} أضف الكل</button>
         ${c.items
           .map(
             (x) => `<label class="pick-item"><input type="checkbox" value="${x.id}" ${have.has(x.text) ? 'checked disabled' : ''}>
               <span>${x.title ? `<b>${esc(x.title)}</b> ` : ''}${esc(x.text.length > 140 ? x.text.slice(0, 137) + '…' : x.text)}<small>${x.count > 1 ? `${num(x.count)} مرات • ` : ''}${esc(x.ref || '')}</small></span></label>`
           )
           .join('')}
       </details>`
     ).join('')}
     <div class="sheet-actions sticky"><button class="btn primary" data-add-picked>إضافة المحدد إلى أذكاري</button></div>`,
    (el, close) => {
      const items = Object.fromEntries(CATEGORIES.flatMap((c) => c.items.map((x) => [x.id, x])));
      const add = (ids) => {
        let n = 0;
        for (const id of ids) {
          const x = items[id];
          if (!x || have.has(x.text)) continue;
          const text = (x.before ? x.before + '\n' : '') + x.text;
          state.custom.push({ id: uid(), text, target: x.count, ref: x.ref || '', reminder: '', today: 0, total: 0, created: Date.now() });
          have.add(x.text);
          n++;
        }
        save();
        close();
        toast(n ? `${icon('check', 18)} أُضيف ${num(n)} إلى أذكاري` : 'لم تختر شيئاً جديداً');
        redraw();
      };
      el.addEventListener('click', (e) => {
        const all = e.target.closest('[data-all]');
        if (all) return add(CATEGORIES.find((c) => c.id === all.dataset.all).items.map((x) => x.id));
        if (e.target.closest('[data-add-picked]')) add($$('input:checked:not(:disabled)', el).map((i) => i.value));
      });
    },
    { title: 'من الأذكار المأثورة' }
  );
}

// ---- Tasbeeh (السبحة): a full-screen counter; tap anywhere to count ----

const PHRASES = [
  'سبحان الله',
  'الحمد لله',
  'الله أكبر',
  'لا إله إلا الله',
  'أستغفر الله',
  'سبحان الله وبحمده',
  'سبحان الله وبحمده، سبحان الله العظيم',
  'لا حول ولا قوة إلا بالله',
  'اللهم صل وسلم على نبينا محمد',
  'لا إله إلا أنت سبحانك إني كنت من الظالمين',
];
const T_TARGETS = [33, 99, 100, 1000, 0];
const FONT_MIN = 22;
const FONT_MAX = 110;

export function renderTasbeeh(view) {
  const t = state.tasbeeh;
  const dayNow = today().key;
  if (t.day !== dayNow) {
    t.day = dayNow;
    t.today = 0;
    save();
  }
  t.fontSize ||= 40;
  const frac = () => (t.target ? (t.count % t.target || (t.count ? t.target : 0)) / t.target : 0);
  const roundText = () => (t.target ? `الدورة ${num(Math.ceil(t.count / t.target) || 1)} • الهدف ${num(t.target)}` : 'عدّ مفتوح بلا حد');

  const draw = () => {
    view.innerHTML = `
      <section class="tsb" data-area>
        <header class="tsb-top" data-ui>
          <a class="icon-btn glass" href="#/home" aria-label="خروج">${icon('back', 22)}</a>
          <div class="tsb-tools">
            <button class="icon-btn glass" data-font="-6" aria-label="تصغير الذكر">${icon('minus', 20)}</button>
            <button class="icon-btn glass" data-font="6" aria-label="تكبير الذكر">${icon('plus', 20)}</button>
            <button class="icon-btn glass" data-phrases aria-label="اختيار الذكر">${icon('beads', 20)}</button>
            <button class="icon-btn glass" data-reset aria-label="تصفير">${icon('reset', 20)}</button>
          </div>
        </header>
        <div class="tsb-phrase" data-phrase style="font-size:${t.fontSize}px">${esc(t.phrase)}</div>
        <div class="tsb-counter">
          <span data-ring>${ring(frac(), 250, 8)}</span>
          <span class="tsb-num"><b data-count>${num(t.count)}</b><small data-round>${roundText()}</small></span>
        </div>
        <p class="tsb-hint">اضغط في أي مكان للتسبيح • باعد بإصبعين لتكبير الذكر</p>
        <footer class="tsb-bottom" data-ui>
          <div class="tsb-targets">${T_TARGETS.map((n) => `<button class="${t.target === n ? 'on' : ''}" data-t="${n}">${n ? num(n) : '∞'}</button>`).join('')}</div>
          <div class="tsb-stats"><span>اليوم <b data-today>${num(t.today || 0)}</b></span><span>المجموع <b data-total>${num(t.total)}</b></span></div>
        </footer>
      </section>`;
  };
  draw();

  const tap = (x, y) => {
    t.count += 1;
    t.total += 1;
    t.today = (t.today || 0) + 1;
    save();
    const reached = t.target && t.count % t.target === 0;
    haptic(reached ? 40 : 10);
    if (reached) toast(`${icon('check', 18)} أتممت ${num(t.target)} — ${esc(t.phrase)}`);
    $('[data-ring]', view).innerHTML = ring(frac(), 250, 8);
    $('[data-count]', view).textContent = num(t.count);
    $('[data-round]', view).textContent = roundText();
    $('[data-total]', view).textContent = num(t.total);
    $('[data-today]', view).textContent = num(t.today);
    const counter = $('.tsb-num', view);
    counter.classList.remove('pop');
    void counter.offsetWidth;
    counter.classList.add('pop');
    if (x !== undefined) {
      const r = document.createElement('i');
      r.className = 'tsb-ripple';
      r.style.left = `${x}px`;
      r.style.top = `${y}px`;
      $('[data-area]', view).appendChild(r);
      setTimeout(() => r.remove(), 600);
    }
  };

  const setFont = (size) => {
    t.fontSize = Math.round(Math.max(FONT_MIN, Math.min(FONT_MAX, size)));
    $('[data-phrase]', view).style.fontSize = `${t.fontSize}px`;
  };

  const onClick = async (e) => {
    const f = e.target.closest('[data-font]');
    if (f) {
      setFont(t.fontSize + Number(f.dataset.font));
      return save();
    }
    if (e.target.closest('[data-phrases]')) return choosePhrase(draw);
    const n = e.target.closest('[data-t]');
    if (n) {
      t.target = Number(n.dataset.t);
      save();
      return draw();
    }
    if (e.target.closest('[data-reset]')) {
      if (await confirmSheet('تصفير العدّاد الحالي؟', { ok: 'تصفير', danger: false })) {
        t.count = 0;
        save();
        draw();
      }
      return;
    }
    if (e.target.closest('[data-ui], a, button')) return;
    tap(e.clientX, e.clientY);
  };

  // Pinch on iPhone (Safari's gesture events) resizes the dhikr text.
  let base = t.fontSize;
  let pinching = false;
  const onGestureStart = (e) => {
    e.preventDefault();
    pinching = true;
    base = t.fontSize;
  };
  const onGestureChange = (e) => {
    e.preventDefault();
    setFont(base * e.scale);
  };
  const onGestureEnd = (e) => {
    e.preventDefault();
    save();
    setTimeout(() => (pinching = false), 300);
  };
  const guardClick = (e) => {
    if (pinching) e.stopPropagation();
  };
  const onKey = (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest('input, textarea, button')) {
      e.preventDefault();
      tap();
    }
  };
  view.addEventListener('click', guardClick, true);
  view.addEventListener('click', onClick);
  view.addEventListener('gesturestart', onGestureStart);
  view.addEventListener('gesturechange', onGestureChange);
  view.addEventListener('gestureend', onGestureEnd);
  document.addEventListener('keydown', onKey);
  return {
    destroy() {
      view.removeEventListener('click', guardClick, true);
      view.removeEventListener('click', onClick);
      view.removeEventListener('gesturestart', onGestureStart);
      view.removeEventListener('gesturechange', onGestureChange);
      view.removeEventListener('gestureend', onGestureEnd);
      document.removeEventListener('keydown', onKey);
    },
  };
}

// Choose what to count: the usual phrases, the user's own adhkar, or a new phrase.
function choosePhrase(redraw) {
  const t = state.tasbeeh;
  const short = (s) => (s.length > 90 ? s.slice(0, 87) + '…' : s);
  const list = [...PHRASES, ...(t.phrases || []), ...state.custom.map((c) => c.text).filter((x) => x.length <= 160)];
  const unique = [...new Set(list)];
  openSheet(
    `<div class="menu phrases">${unique
      .map((p, i) => `<button data-i="${i}" class="${p === t.phrase ? 'on' : ''}">${p === t.phrase ? icon('check', 18) : icon('beads', 18)} <span>${esc(short(p))}</span></button>`)
      .join('')}</div>
     <form class="form new-phrase">
       <label class="field"><span>ذكر جديد للسبحة</span><textarea name="text" rows="2" maxlength="160" placeholder="اكتب الذكر هنا"></textarea></label>
       <button class="btn primary" type="submit">${icon('plus', 18)} إضافة واختيار</button>
     </form>`,
    (el, close) => {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (!b) return;
        t.phrase = unique[Number(b.dataset.i)];
        t.count = 0;
        save();
        close();
        redraw();
      });
      el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const text = e.target.text.value.trim();
        if (!text) return;
        t.phrases = [...(t.phrases || []).filter((p) => p !== text), text];
        t.phrase = text;
        t.count = 0;
        save();
        close();
        redraw();
      });
    },
    { title: 'اختر الذكر' }
  );
}
