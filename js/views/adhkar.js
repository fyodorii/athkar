// Adhkar library (categories and their counters), "my adhkar" and the tasbeeh counter.

import { CATEGORIES, CATEGORY_BY_ID } from '../adhkar-data.js';
import { num } from '../dates.js';
import { icon } from '../icons.js';
import { syncSchedule } from '../push.js';
import { isSaved, save, state, todayCounts, toggleSaved, uid } from '../store.js';
import { today } from '../today.js';
import { $, $$, confirmSheet, copyText, esc, haptic, openSheet, pageHeader, ring, segmented, shareText, toast } from '../ui.js';

const TABS = [
  ['#/adhkar', 'الأذكار'],
  ['#/mine', 'أذكاري'],
];

const counts = () => todayCounts(today().key);
const doneIn = (cat) => cat.items.filter((x) => (counts()[x.id] || 0) >= x.count).length;

// ---- Categories ----

export function renderList(view) {
  view.innerHTML = `
    ${pageHeader('الأذكار', { sub: 'من الكتاب والسنة الصحيحة' })}
    ${segmented(TABS, '#/adhkar')}
    <section class="cat-grid">
      ${CATEGORIES.map((c) => {
        const done = doneIn(c);
        const all = c.items.length;
        return `<a class="cat tone-${c.tone}" href="#/adhkar/${c.id}">
          <div class="cat-icon">${icon(c.icon, 26)}</div>
          <div class="cat-text"><b>${esc(c.title)}</b><span>${esc(c.subtitle)}</span></div>
          <div class="cat-progress">${done ? `${ring(done / all, 34, 4)}<i>${done === all ? icon('check', 14) : num(done)}</i>` : `<small>${num(all)}</small>`}</div>
        </a>`;
      }).join('')}
    </section>`;
}

// ---- One category: tap a card to count it down ----

export function renderCategory(view, id) {
  const cat = CATEGORY_BY_ID[id];
  if (!cat) {
    location.hash = '#/adhkar';
    return;
  }
  const scale = state.settings.textScale;

  const draw = () => {
    const c = counts();
    const done = doneIn(cat);
    view.innerHTML = `
      ${pageHeader(cat.title, {
        back: '#/adhkar',
        sub: `<span data-done>${num(done)}</span> من ${num(cat.items.length)}`,
        actions: `<button class="icon-btn ghost" data-reset aria-label="البدء من جديد">${icon('reset', 22)}</button>`,
      })}
      <div class="cat-bar"><i data-bar style="width:${(done / cat.items.length) * 100}%"></i></div>
      <section class="dhikr-list" style="--scale:${scale}">
        ${cat.items.map((x) => dhikrCard(x, c[x.id] || 0)).join('')}
      </section>
      <div class="finish ${done === cat.items.length ? 'show' : ''}" data-finish>
        ${icon('check', 28)}<b>أتممت ${esc(cat.title)}</b><span>تقبّل الله منك</span>
      </div>`;
  };
  draw();

  const onClick = async (e) => {
    const card = e.target.closest('.dhikr');
    if (!card) return;
    const item = cat.items.find((x) => x.id === card.dataset.id);
    const action = e.target.closest('[data-act]')?.dataset.act;
    const full = (item.before ? item.before + '\n' : '') + item.text;
    if (action === 'save') {
      const on = toggleSaved(item.id);
      e.target.closest('[data-act]').innerHTML = icon(on ? 'bookmarkOn' : 'bookmark', 20);
      toast(on ? `${icon('bookmarkOn', 18)} حُفظ في دفتري` : 'أُزيل من دفتري');
      return;
    }
    if (action === 'copy') return copyText(full);
    if (action === 'share') return shareText(full);
    if (e.target.closest('summary, details')) return;
    count(card, item);
  };

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
    if (!left) {
      card.classList.add('done');
      card.querySelector('[data-left]').innerHTML = icon('check', 24);
      haptic(30);
      const done = doneIn(cat);
      $('[data-done]', view).textContent = num(done);
      $('[data-bar]', view).style.width = `${(done / cat.items.length) * 100}%`;
      const nextCard = $$('.dhikr:not(.done)', view)[0];
      if (nextCard) setTimeout(() => nextCard.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
      else $('[data-finish]', view).classList.add('show');
    }
  };

  const onReset = async (e) => {
    if (!e.target.closest('[data-reset]')) return;
    if (!(await confirmSheet('إعادة عدّاد هذه الأذكار من البداية؟', { ok: 'إعادة', danger: false }))) return;
    const c = counts();
    for (const x of cat.items) delete c[x.id];
    save();
    draw();
    window.scrollTo({ top: 0 });
  };

  view.addEventListener('click', onClick);
  view.addEventListener('click', onReset);
  return {
    destroy() {
      view.removeEventListener('click', onClick);
      view.removeEventListener('click', onReset);
    },
  };
}

function dhikrCard(x, n) {
  const done = n >= x.count;
  const left = x.count - n;
  return `<article class="dhikr ${done ? 'done' : ''} ${x.quran ? 'quran' : ''}" data-id="${x.id}">
    ${x.title ? `<h3 class="dhikr-title">${esc(x.title)}</h3>` : ''}
    <div class="dhikr-text">${x.before ? `<span class="before">${esc(x.before)}</span>` : ''}${esc(x.text)}</div>
    ${x.virtue ? `<details class="virtue"><summary>${icon('stars', 16)} الفضل</summary><p>${esc(x.virtue)}</p></details>` : ''}
    <footer>
      <div class="dhikr-meta">
        ${x.ref ? `<span class="ref">${esc(x.ref)}</span>` : ''}
        <div class="dhikr-actions">
          <button class="icon-btn ghost sm" data-act="save" aria-label="حفظ في دفتري">${icon(isSaved(x.id) ? 'bookmarkOn' : 'bookmark', 20)}</button>
          <button class="icon-btn ghost sm" data-act="copy" aria-label="نسخ">${icon('copy', 20)}</button>
          <button class="icon-btn ghost sm" data-act="share" aria-label="مشاركة">${icon('share', 20)}</button>
        </div>
      </div>
      <button class="counter" aria-label="عدّ">
        <span class="counter-ring">${ring(n / x.count, 58, 4)}</span>
        <span class="counter-num" data-left>${done ? icon('check', 24) : num(left)}</span>
      </button>
    </footer>
    ${x.count > 1 ? `<span class="times">${num(x.count)} ${x.count <= 10 ? 'مرات' : 'مرة'}</span>` : ''}
  </article>`;
}

// ---- My adhkar ----

export function renderMine(view, focusId) {
  const draw = () => {
    counts(); // resets the daily counters on a new day
    const list = state.custom;
    view.innerHTML = `
      ${pageHeader('أذكاري', {
        sub: 'أذكارك الخاصة بعدّادها وتذكيرها',
        actions: `<button class="icon-btn primary" data-add aria-label="إضافة ذكر">${icon('plus', 22)}</button>`,
      })}
      ${segmented(TABS, '#/mine')}
      ${
        list.length
          ? `<section class="mine-list">${list.map(mineCard).join('')}</section>`
          : `<div class="empty">
              <div class="empty-art">${icon('beads', 44)}</div>
              <b>أضف ذكرك الأول</b>
              <p>اكتب الذكر الذي تحب المداومة عليه، وحدّد عدده اليومي، واختر وقتاً ليذكّرك التطبيق به.</p>
              <button class="btn primary" data-add>${icon('plus', 20)} إضافة ذكر</button>
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
    const card = e.target.closest('.mine');
    if (!card) return;
    const item = state.custom.find((c) => c.id === card.dataset.id);
    if (e.target.closest('[data-more]')) return customMenu(item, draw);
    counts();
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
      <p class="mine-text">${esc(c.text)}</p>
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

// ---- Tasbeeh (السبحة) ----

const PHRASES = [
  'سبحان الله',
  'الحمد لله',
  'الله أكبر',
  'لا إله إلا الله',
  'أستغفر الله',
  'سبحان الله وبحمده',
  'سبحان الله العظيم',
  'لا حول ولا قوة إلا بالله',
  'اللهم صل على محمد',
  'لا إله إلا أنت سبحانك إني كنت من الظالمين',
];
const T_TARGETS = [33, 99, 100, 1000, 0];

export function renderTasbeeh(view) {
  const t = state.tasbeeh;
  const dayNow = today().key;
  if (t.day !== dayNow) {
    t.day = dayNow;
    t.today = 0;
    save();
  }
  const phrases = () => [...PHRASES, ...(t.phrases || [])];
  // Share of the current round done; a finished round shows full until the next tap.
  const frac = () => (t.target ? (t.count % t.target || (t.count ? t.target : 0)) / t.target : 0);
  const roundText = () => (t.target ? `الدورة ${num(Math.ceil(t.count / t.target) || 1)} • الهدف ${num(t.target)}` : 'بلا حد');

  const draw = () => {
    view.innerHTML = `
      ${pageHeader('السبحة', {
        sub: 'اضغط على الدائرة للتسبيح',
        actions: `<button class="icon-btn ghost" data-reset aria-label="تصفير">${icon('reset', 22)}</button>`,
      })}
      <div class="chips scroll" data-phrases>
        ${phrases().map((p) => `<button class="chip-opt ${p === t.phrase ? 'on' : ''}" data-p="${esc(p)}">${esc(p)}</button>`).join('')}
        <button class="chip-opt add" data-new aria-label="ذكر جديد">${icon('plus', 16)}</button>
      </div>
      <section class="tasbeeh">
        <p class="tasbeeh-phrase">${esc(t.phrase)}</p>
        <button class="tasbeeh-btn" data-tap aria-label="سبّح">
          <span class="beads-orbit" data-orbit style="--turn:${(t.count % 33) * (360 / 33)}deg">${beads()}</span>
          <span data-ring>${ring(frac(), 236, 9)}</span>
          <span class="tasbeeh-count"><b data-count>${num(t.count)}</b><small data-round>${roundText()}</small></span>
        </button>
        <div class="chips centered" data-targets>
          ${T_TARGETS.map((n) => `<button class="chip-opt ${t.target === n ? 'on' : ''}" data-t="${n}">${n ? num(n) : '∞'}</button>`).join('')}
        </div>
        <div class="stats">
          <div><small>تسبيح اليوم</small><b data-today>${num(t.today || 0)}</b></div>
          <div><small>المجموع الكلي</small><b data-total>${num(t.total)}</b></div>
        </div>
        <p class="hint center">${icon('info', 15)} «كلمتان خفيفتان على اللسان، ثقيلتان في الميزان، حبيبتان إلى الرحمن: سبحان الله وبحمده، سبحان الله العظيم» — متفق عليه</p>
      </section>`;
  };
  draw();

  const tap = () => {
    t.count += 1;
    t.total += 1;
    t.today = (t.today || 0) + 1;
    save();
    const reached = t.target && t.count % t.target === 0;
    haptic(reached ? 40 : 10);
    if (reached) toast(`${icon('check', 18)} أتممت ${num(t.target)} — ${esc(t.phrase)}`);
    $('[data-ring]', view).innerHTML = ring(frac(), 236, 9);
    $('[data-count]', view).textContent = num(t.count);
    $('[data-round]', view).textContent = roundText();
    $('[data-total]', view).textContent = num(t.total);
    $('[data-today]', view).textContent = num(t.today);
    $('[data-orbit]', view).style.setProperty('--turn', `${(t.count % 33) * (360 / 33)}deg`);
  };

  const onClick = async (e) => {
    if (e.target.closest('[data-tap]')) return tap();
    if (e.target.closest('[data-new]')) return newPhrase(draw);
    const p = e.target.closest('[data-p]');
    if (p) {
      t.phrase = p.dataset.p;
      t.count = 0;
      save();
      return draw();
    }
    const n = e.target.closest('[data-t]');
    if (n) {
      t.target = Number(n.dataset.t);
      save();
      return draw();
    }
    if (e.target.closest('[data-reset]') && (await confirmSheet('تصفير العدّاد الحالي؟', { ok: 'تصفير', danger: false }))) {
      t.count = 0;
      save();
      draw();
    }
  };
  // Volume keys cannot be read on the web; Space/Enter count on a keyboard.
  const onKey = (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.target.closest('input, textarea, button')) {
      e.preventDefault();
      tap();
    }
  };
  view.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  return {
    destroy() {
      view.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    },
  };
}

function beads() {
  let s = '';
  for (let i = 0; i < 33; i++) s += `<i style="transform: rotate(${i * (360 / 33)}deg) translateY(calc(var(--r) * -1))"></i>`;
  return s;
}

function newPhrase(redraw) {
  const t = state.tasbeeh;
  openSheet(
    `<form class="form">
       <label class="field"><span>الذكر</span><textarea name="text" rows="2" maxlength="120" required placeholder="مثال: سبحان الله وبحمده عدد خلقه"></textarea></label>
       ${t.phrases?.length ? `<div class="field"><span>أذكارك في السبحة (اضغط للحذف)</span><div class="chips">${t.phrases.map((p, i) => `<button type="button" class="chip-opt" data-rm="${i}">${esc(p)} ×</button>`).join('')}</div></div>` : ''}
       <div class="sheet-actions"><button class="btn primary" type="submit">إضافة إلى السبحة</button><button class="btn ghost" type="button" data-close>إلغاء</button></div>
     </form>`,
    (el, close) => {
      const form = el.querySelector('form');
      el.addEventListener('click', (e) => {
        const rm = e.target.closest('[data-rm]');
        if (!rm) return;
        t.phrases.splice(Number(rm.dataset.rm), 1);
        save();
        rm.remove();
        redraw();
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = form.text.value.trim();
        if (!text) return;
        t.phrases = [...(t.phrases || []).filter((p) => p !== text), text];
        t.phrase = text;
        t.count = 0;
        save();
        close();
        redraw();
      });
    },
    { title: 'ذكر جديد للسبحة' }
  );
}
