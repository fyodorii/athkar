// My adhkar (the user's own list, with counters and reminders, which can also be
// filled from the authentic adhkar), and the full-screen tasbeeh.

import { CATEGORIES, CATEGORY_BY_ID } from '../adhkar-data.js';
import { num } from '../dates.js';
import { icon } from '../icons.js';
import { syncSchedule } from '../push.js';
import { isSaved, newDay, save, state, toggleSaved, uid } from '../store.js';
import { today } from '../today.js';
import { $, $$, confirmSheet, copyText, esc, haptic, openSheet, pageHeader, ring, segmented, shareText, toast } from '../ui.js';

export const MINE_TABS = [
  ['#/mine', 'أذكاري'],
  ['#/notebook', 'أدعيتي'],
  ['#/notebook/saved', 'المحفوظات'],
];
const TABS = MINE_TABS;

// ---- Morning, evening and sleep: tap a card to count it down ----

export const WIRDS = ['morning', 'evening', 'sleep'];
const WIRD_TABS = [
  ['#/adhkar/morning', 'الصباح'],
  ['#/adhkar/evening', 'المساء'],
  ['#/adhkar/sleep', 'النوم'],
];

const counts = () => {
  newDay(today().key);
  return state.progress.counts;
};
export const wirdDone = (cat) => cat.items.filter((x) => (counts()[x.id] || 0) >= x.count).length;

export function renderWird(view, id) {
  const cat = CATEGORY_BY_ID[id];
  const scale = state.settings.textScale;

  const draw = () => {
    const c = counts();
    const done = wirdDone(cat);
    view.innerHTML = `
      ${pageHeader(cat.title, {
        back: '#/mine',
        sub: `<span data-done>${num(done)}</span> من ${num(cat.items.length)} • ${esc(cat.subtitle)}`,
        actions: `<button class="icon-btn ghost" data-reset aria-label="البدء من جديد">${icon('reset', 22)}</button>`,
      })}
      ${segmented(WIRD_TABS, `#/adhkar/${id}`)}
      <div class="cat-bar"><i data-bar style="width:${(done / cat.items.length) * 100}%"></i></div>
      <section class="dhikr-list" style="--scale:${scale};--qscale:${state.settings.quranScale || 1}">
        ${cat.items.map((x, i) => wirdCard(x, c[x.id] || 0, i + 1)).join('')}
      </section>
      <div class="finish ${done === cat.items.length ? 'show' : ''}" data-finish>
        ${icon('check', 28)}<b>أتممت ${esc(cat.title)}</b><span>تقبّل الله منك</span>
      </div>`;
  };
  draw();

  const count = (card, item) => {
    const c = counts();
    const n = c[item.id] || 0;
    if (n >= item.count) return;
    c[item.id] = n + 1;
    save();
    haptic();
    const left = item.count - c[item.id];
    card.querySelector('[data-left]').textContent = left ? num(left) : '';
    card.querySelector('.counter').classList.add('bump');
    setTimeout(() => card.querySelector('.counter')?.classList.remove('bump'), 160);
    card.querySelector('.counter-ring').innerHTML = ring(c[item.id] / item.count, 58, 4);
    if (left) return;
    card.classList.add('done');
    card.querySelector('[data-left]').innerHTML = icon('check', 24);
    haptic(30);
    const done = wirdDone(cat);
    $('[data-done]', view).textContent = num(done);
    $('[data-bar]', view).style.width = `${(done / cat.items.length) * 100}%`;
    const nextCard = $$('.dhikr:not(.done)', view)[0];
    if (nextCard) setTimeout(() => nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
    else $('[data-finish]', view).classList.add('show');
  };

  view.onclick = async (e) => {
    if (e.target.closest('[data-reset]')) {
      if (!(await confirmSheet('إعادة عدّاد هذه الأذكار من البداية؟', { ok: 'إعادة', danger: false }))) return;
      const c = counts();
      for (const x of cat.items) delete c[x.id];
      save();
      draw();
      return window.scrollTo({ top: 0 });
    }
    const card = e.target.closest('.dhikr');
    if (!card) return;
    const item = cat.items.find((x) => x.id === card.dataset.id);
    const action = e.target.closest('[data-act]')?.dataset.act;
    const full = (item.before ? item.before + '\n' : '') + item.text + (item.ref && item.quran ? ` ﴿${item.ref}﴾` : '');
    if (action === 'save') {
      const on = toggleSaved({ ...item, text: full });
      e.target.closest('[data-act]').innerHTML = icon(on ? 'bookmarkOn' : 'bookmark', 20);
      return toast(on ? `${icon('bookmarkOn', 18)} حُفظ في المحفوظات` : 'أُزيل من المحفوظات');
    }
    if (action === 'copy') return copyText(full);
    if (action === 'share') return shareText(full);
    if (e.target.closest('summary, details')) return;
    count(card, item);
  };
  return { destroy: () => (view.onclick = null) };
}

function wirdCard(x, n, no) {
  const done = n >= x.count;
  const left = x.count - n;
  return `<article class="dhikr ${done ? 'done' : ''} ${x.quran ? 'quran' : ''}" data-id="${x.id}">
    <h3 class="dhikr-title"><span class="dhikr-no">${num(no)}</span>${x.title ? esc(x.title) : ''}</h3>
    <div class="dhikr-text ${x.quran ? 'hafs' : ''}">${x.before ? `<span class="before">${esc(x.before)}</span>` : ''}${esc(x.text)}</div>
    ${x.note ? `<p class="dhikr-note">${icon('info', 15)} ${esc(x.note)}</p>` : ''}
    ${x.virtue ? `<details class="virtue"><summary>${icon('stars', 16)} الفضل</summary><p>${esc(x.virtue)}</p></details>` : ''}
    <footer>
      <div class="dhikr-meta">
        ${x.ref ? `<span class="ref">${esc(x.ref)}</span>` : ''}
        <div class="dhikr-actions">
          <button class="icon-btn ghost sm" data-act="save" aria-label="حفظ">${icon(isSaved(x.id) ? 'bookmarkOn' : 'bookmark', 20)}</button>
          <button class="icon-btn ghost sm" data-act="copy" aria-label="نسخ">${icon('copy', 20)}</button>
          <button class="icon-btn ghost sm" data-act="share" aria-label="مشاركة">${icon('share', 20)}</button>
        </div>
      </div>
      <button class="counter" aria-label="عدّ">
        <span class="counter-ring">${ring(n / x.count, 58, 4)}</span>
        <span class="counter-num" data-left>${done ? icon('check', 24) : num(left)}</span>
      </button>
    </footer>
    ${x.count > 1 ? `<span class="times">${x.count === 2 ? 'مرتان' : `${num(x.count)} ${x.count <= 10 ? 'مرات' : 'مرة'}`}</span>` : ''}
  </article>`;
}

// Cards for the three wirds at the top of "my adhkar".
function wirdCards() {
  return `<section class="wird-cards">${WIRDS.map((id) => {
    const c = CATEGORY_BY_ID[id];
    const done = wirdDone(c);
    const all = c.items.length;
    return `<a class="wird-card tone-${c.tone}" href="#/adhkar/${id}">
      <span class="wc-ring">${ring(done / all, 46, 4)}<i>${done === all ? icon('check', 18) : icon(c.icon, 20)}</i></span>
      <b>${esc(c.title.replace('أذكار ', ''))}</b>
      <small>${done === all ? 'تمّت' : `${num(done)} / ${num(all)}`}</small>
    </a>`;
  }).join('')}</section>`;
}

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
      ${wirdCards()}
      <h3 class="section-title small">${icon('heart', 16)} أذكاري الخاصة</h3>
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
  tasbeehList();
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

// The tasbeeh's own list of adhkar: tap one to count it, or edit, delete and add.
// It starts from the usual phrases and is the user's to change.
export function tasbeehList() {
  const t = state.tasbeeh;
  if (!Array.isArray(t.list)) {
    t.list = [...new Set([...PHRASES, ...(t.phrases || [])])];
    delete t.phrases;
    save();
  }
  return t.list;
}

function choosePhrase(redraw) {
  const t = state.tasbeeh;
  const list = tasbeehList();
  const short = (s) => (s.length > 90 ? s.slice(0, 87) + '…' : s);
  openSheet(
    `<div data-body></div>`,
    (el, close) => {
      const body = el.querySelector('[data-body]');
      let editing = -1; // index being edited, or list.length for a new one
      const draw = () => {
        body.innerHTML = `
          <div class="menu phrases">${list
            .map((p, i) =>
              i === editing
                ? `<form class="phrase-edit" data-save="${i}"><textarea name="text" rows="2" maxlength="160">${esc(p)}</textarea>
                    <div><button class="btn primary" type="submit">حفظ</button><button class="btn ghost" type="button" data-cancel>إلغاء</button></div></form>`
                : `<div class="phrase-row ${p === t.phrase ? 'on' : ''}">
                    <button class="phrase-pick" data-i="${i}">${p === t.phrase ? icon('check', 18) : icon('beads', 18)} <span>${esc(short(p))}</span></button>
                    <button class="icon-btn ghost sm" data-edit="${i}" aria-label="تعديل">${icon('edit', 18)}</button>
                    <button class="icon-btn ghost sm danger-ic" data-del="${i}" aria-label="حذف">${icon('trash', 18)}</button>
                  </div>`
            )
            .join('')}</div>
          ${list.length ? '' : '<p class="hint center">القائمة فارغة، أضف ذكراً بالأسفل.</p>'}
          <form class="form new-phrase" data-save="${list.length}">
            <label class="field"><span>ذكر جديد للسبحة</span><textarea name="text" rows="2" maxlength="160" placeholder="اكتب الذكر هنا"></textarea></label>
            <button class="btn primary" type="submit">${icon('plus', 18)} إضافة</button>
          </form>
          <button class="btn ghost wide" data-defaults>${icon('reset', 18)} استعادة الأذكار الافتراضية</button>`;
        if (editing >= 0 && editing < list.length) body.querySelector('.phrase-edit textarea')?.focus();
      };
      draw();

      body.addEventListener('click', async (e) => {
        const pick = e.target.closest('[data-i]');
        if (pick) {
          t.phrase = list[Number(pick.dataset.i)];
          t.count = 0;
          save();
          close();
          return redraw();
        }
        const ed = e.target.closest('[data-edit]');
        if (ed) {
          editing = Number(ed.dataset.edit);
          return draw();
        }
        if (e.target.closest('[data-cancel]')) {
          editing = -1;
          return draw();
        }
        const del = e.target.closest('[data-del]');
        if (del) {
          const i = Number(del.dataset.del);
          if (!(await confirmSheet(`حذف «${short(list[i])}» من السبحة؟`))) return;
          const [gone] = list.splice(i, 1);
          if (gone === t.phrase) {
            t.phrase = list[0] || 'سبحان الله';
            t.count = 0;
          }
          save();
          redraw();
          return draw();
        }
        if (e.target.closest('[data-defaults]')) {
          for (const p of PHRASES) if (!list.includes(p)) list.push(p);
          save();
          toast(`${icon('check', 18)} أُعيدت الأذكار الافتراضية`);
          return draw();
        }
      });
      body.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target.closest('[data-save]');
        const text = form.text.value.trim();
        if (!text) return;
        const i = Number(form.dataset.save);
        if (i < list.length) {
          if (list[i] === t.phrase) t.phrase = text;
          list[i] = text;
        } else if (!list.includes(text)) list.push(text);
        editing = -1;
        save();
        redraw();
        draw();
        toast(`${icon('check', 18)} ${i < list.length ? 'حُفظ التعديل' : 'أُضيف إلى السبحة'}`);
      });
    },
    { title: 'أذكار السبحة' }
  );
}
