// My adhkar (the user's own list, with counters, which can also be
// filled from the authentic adhkar), and the full-screen tasbeeh.

import { CATEGORIES, CATEGORY_BY_ID, MY_ADHKAR } from '../adhkar-data.js';
import { num } from '../dates.js';
import { icon } from '../icons.js';
import { newDay, save, state, uid } from '../store.js';
import { today } from '../today.js';
import { chime, unlockAudio } from '../timers.js';
import { $, $$, confirmSheet, esc, haptic, openSheet, pageHeader, ring, segmented, shareText, toast, toggle } from '../ui.js';

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
      ${WIRDS.includes(id) ? segmented(WIRD_TABS, `#/adhkar/${id}`) : ''}
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
    if (done === cat.items.length) return $('[data-finish]', view).classList.add('show');
    // On to the next one still to read below this card, its start just under the header; never
    // back up to one skipped above, and never past the start of a long one.
    const cards = $$('.dhikr', view);
    const nextCard = cards.slice(cards.indexOf(card) + 1).find((x) => !x.classList.contains('done'));
    if (nextCard) setTimeout(() => nextCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
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
      <h3 class="section-title small">${icon('book', 16)} أذكار اليوم والليلة</h3>
      <section class="occ-grid">
        ${CATEGORIES.filter((c) => !WIRDS.includes(c.id))
          .map((c) => `<a class="tone-${c.tone}" href="#/adhkar/${c.id}"><span>${icon(c.icon, 20)}</span><b>${esc(c.title)}</b><small>${num(c.items.length)}</small></a>`)
          .join('')}
      </section>
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
    // Counting happens on the full-screen counter, so scrolling the list never adds a count.
    haptic();
    location.hash = `#/tasbeeh/${item.id}`;
  };
  view.addEventListener('click', onClick);
  return { destroy: () => view.removeEventListener('click', onClick) };
}

// The text, then a row with today's count, the total and the way into the counter, over a
// thin bar along the card's foot for today's share (no ring).
function mineCard(c) {
  const n = c.today || 0;
  const done = c.target && n >= c.target;
  const share = c.target ? Math.min(1, n / c.target) : 0;
  return `<article class="mine ${done ? 'done' : ''}" data-id="${c.id}">
    <p class="mine-text ${c.quran ? 'hafs' : ''}">${esc(c.text)}</p>
    ${c.ref ? `<p class="mine-ref">${esc(c.ref)}</p>` : ''}
    <div class="mine-foot">
      <span class="mine-num"><b>${num(n)}</b><small>${c.target ? `من ${num(c.target)}` : 'عدد مفتوح'}</small></span>
      <span class="mine-total">المجموع ${num(c.total || 0)}</span>
      <span class="mine-go" role="button" aria-label="عُدّ هذا الذكر">${done ? `${icon('check', 16)} تمّ` : `عُدّ ${icon('chevron', 16)}`}</span>
    </div>
    ${c.target ? `<i class="mine-bar"><i style="width:${share * 100}%"></i></i>` : ''}
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
          redraw();
        }
      });
    },
    { title: 'الذكر' }
  );
}

const TARGETS = [0, 3, 7, 10, 33, 100, 1000];

export function editCustom(item, onDone, preset = {}) {
  const c = item || { text: preset.text || '', target: 33 };
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
        if (item) Object.assign(item, { text, target });
        else state.custom.unshift({ id: uid(), text, target, today: 0, total: 0, created: Date.now() });
        save();
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
          state.custom.push({ id: uid(), text, target: x.count, ref: x.ref || '', today: 0, total: 0, created: Date.now() });
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

const PHRASES = MY_ADHKAR.map((x) => x.replace(/\.$/, ''));
const T_TARGETS = [33, 99, 100, 1000, 0];
const FONT_MIN = 22;
const FONT_MAX = 110;

// Backgrounds and dhikr colours for the tasbeeh screen; `light` backgrounds get dark controls.
const T_BGS = [
  { id: 'blue', name: 'أزرق', css: '' },
  { id: 'emerald', name: 'زمردي', css: 'linear-gradient(170deg, #0f5c4d 0%, #083a32 50%, #04201b 100%)' },
  { id: 'black', name: 'أسود', css: '#000' },
  { id: 'night', name: 'كحلي', css: 'linear-gradient(170deg, #1d2b4f 0%, #0d1730 55%, #060b1a 100%)' },
  { id: 'plum', name: 'بنفسجي', css: 'linear-gradient(170deg, #4a2a6b 0%, #2a1442 55%, #150823 100%)' },
  { id: 'maroon', name: 'عنابي', css: 'linear-gradient(170deg, #6b2232 0%, #3d0f1b 55%, #1f060c 100%)' },
  { id: 'brown', name: 'بني', css: 'linear-gradient(170deg, #5b4127 0%, #362414 55%, #1b1209 100%)' },
  { id: 'gray', name: 'رمادي', css: 'linear-gradient(170deg, #3a3f45 0%, #202428 55%, #0f1113 100%)' },
  { id: 'sand', name: 'رملي', css: 'linear-gradient(170deg, #f7efdc 0%, #ecdcb7 100%)', light: true },
  { id: 'white', name: 'أبيض', css: '#fbfaf6', light: true },
];
const T_INKS = ['#ffffff', '#e3c27a', '#a7f3d0', '#bae6fd', '#fbcfe8', '#fde68a', '#0f5c4d', '#7a4b12', '#1e293b', '#000000'];
const DIM_STEPS = [0, 30, 50, 70];
const DIM_MAX = 85;
const tsbBg = (t) => T_BGS.find((b) => b.id === t.bg) || T_BGS[0];

// Istighfar has no fixed number: it is counted openly, and each one also goes to «متابعتي».
export const isIstighfar = (text) => /[أا]ستغفر/.test(text || '');

// With an id, the screen counts one of «أذكاري» towards its daily number instead of the
// tasbeeh's own dhikr; with «g-<id>» it runs a group, one dhikr after another, each to its
// number. The look (colours, sizes, dimming) is shared.
export function renderTasbeeh(view, mineId) {
  const t = state.tasbeeh;
  const dayNow = today().key;
  if (t.day !== dayNow) {
    t.day = dayNow;
    t.today = 0;
    save();
  }
  t.fontSize ||= 40;
  t.counterSize ||= 1;
  t.dim ||= 0;
  tasbeehList();
  newDay(dayNow);
  const group = mineId?.startsWith('g-') ? state.groups.find((g) => g.id === mineId.slice(2) && g.items.length) : null;
  const mine = mineId && !group ? state.custom.find((c) => c.id === mineId) : null;
  if (mineId && !mine && !group) {
    location.replace(mineId.startsWith('g-') ? '#/tasbeeh' : '#/mine');
    return null;
  }
  if (group) group.i = Math.max(0, Math.min(group.items.length - 1, group.i || 0));
  const step = () => group.items[group.i];
  const box = mine || t; // whose text size is shown and changed (each dhikr of «أذكاري» keeps its own)
  // What is counted: the tasbeeh's dhikr (in rounds of its target) or a dhikr of «أذكاري».
  const src = group
    ? {
        phrase: () => step().text,
        count: () => group.count || 0,
        target: () => step().target || 0,
        today: () => t.today || 0,
        total: () => t.total,
        add() {
          group.count = (group.count || 0) + 1;
          t.total += 1;
          t.today = (t.today || 0) + 1;
        },
        reset: () => (group.count = 0),
      }
    : mine
    ? {
        phrase: () => mine.text,
        count: () => mine.today || 0,
        target: () => mine.target || 0,
        today: () => mine.today || 0,
        total: () => mine.total || 0,
        add() {
          mine.today = (mine.today || 0) + 1;
          mine.total = (mine.total || 0) + 1;
        },
        reset: () => (mine.today = 0),
      }
    : {
        phrase: () => t.phrase,
        count: () => t.count,
        target: () => t.target,
        today: () => t.today || 0,
        total: () => t.total,
        add() {
          t.count += 1;
          t.total += 1;
          t.today = (t.today || 0) + 1;
        },
        reset: () => (t.count = 0),
      };
  const roundText = () => {
    const [c, n] = [src.count(), src.target()];
    if (!n) return 'عدّ مفتوح بلا حد';
    if (group) return `الهدف ${num(n)} • ثم ${group.i + 1 < group.items.length ? 'الذكر التالي' : 'تتم المجموعة'}`;
    if (mine) return c >= n ? `أتممت وردك اليومي (${num(n)})` : `الهدف اليومي ${num(n)}`;
    return `الدورة ${num(Math.ceil(c / n) || 1)} • الهدف ${num(n)}`;
  };

  const draw = () => {
    const bg = tsbBg(t);
    const style = [bg.css && `background:${bg.css}`, t.ink && `--tsb-ink:${t.ink}`, `--tsb-scale:${t.counterSize}`].filter(Boolean).join(';');
    view.innerHTML = `
      <section class="tsb ${bg.light ? 'light' : ''}" data-area style="${style}">
        <header class="tsb-top" data-ui>
          <a class="icon-btn glass" href="${group ? '#/tasbeeh' : mine ? `#/mine/${mine.id}` : '#/home'}" aria-label="خروج">${icon('back', 22)}</a>
          <div class="tsb-tools">
            <button class="icon-btn glass" data-font="-6" aria-label="تصغير الذكر">${icon('minus', 20)}</button>
            <button class="icon-btn glass" data-font="6" aria-label="تكبير الذكر">${icon('plus', 20)}</button>
            <button class="icon-btn glass" data-look aria-label="الألوان والحجم">${icon('palette', 20)}</button>
            <button class="icon-btn glass" data-alerts aria-label="تنبيه الأعداد">${icon(t.alerts.length && (t.alertSound || t.alertVibrate) ? 'bell' : 'bellOff', 20)}</button>
            <button class="icon-btn glass ${t.dim ? 'on' : ''}" data-dim aria-label="تعتيم الصفحة">${icon('moon', 20)}</button>
            ${mine || group ? '' : `<button class="icon-btn glass" data-phrases aria-label="اختيار الذكر">${icon('beads', 20)}</button>`}
            <button class="icon-btn glass" data-reset aria-label="تصفير">${icon('reset', 20)}</button>
          </div>
        </header>
        ${mine ? `<p class="tsb-from">من أذكاري${mine.ref ? ` • ${esc(mine.ref)}` : ''}</p>` : ''}
        ${group ? `<p class="tsb-from">${esc(group.name)} • ${num(group.i + 1)} من ${num(group.items.length)}</p>` : ''}
        <div class="tsb-phrase ${mine?.quran ? 'hafs' : ''}" data-phrase style="font-size:${box.fontSize || 40}px"><span>${esc(src.phrase())}</span></div>
        <div class="tsb-counter">
          <span class="tsb-num"><b data-count>${num(src.count())}</b><small data-round>${roundText()}</small></span>
        </div>
        <p class="tsb-hint">اضغط في أي مكان للتسبيح • باعد بإصبعين لتكبير الذكر</p>
        <footer class="tsb-bottom" data-ui>
          ${
            group
              ? `<div class="tsb-targets tsb-steps">
                  <button data-step="-1" ${group.i ? '' : 'disabled'}>السابق</button>
                  <button data-groups>${icon('layers', 16)} المجموعات</button>
                  <button data-step="1" ${group.i + 1 < group.items.length ? '' : 'disabled'}>التالي</button>
                </div>`
              : mine
                ? ''
                : `<div class="tsb-targets">${T_TARGETS.map((n) => `<button class="${t.target === n ? 'on' : ''}" data-t="${n}">${n ? num(n) : '∞'}</button>`).join('')}<button data-groups aria-label="المجموعات">${icon('layers', 16)}</button></div>`
          }
          <div class="tsb-stats"><span>اليوم <b data-today>${num(src.today())}</b></span><span>المجموع <b data-total>${num(src.total())}</b></span></div>
        </footer>
        <i class="tsb-dim" data-dim-layer style="opacity:${t.dim / 100}"></i>
      </section>`;
  };
  // A dhikr of «أذكاري» starts at the largest size that shows it whole, until resized.
  const fit = (from = 40) => {
    const el = $('[data-phrase]', view);
    let size = from;
    el.style.fontSize = `${size}px`;
    while (size > FONT_MIN && el.scrollHeight > el.clientHeight + 2) el.style.fontSize = `${(size -= 2)}px`;
  };
  const paint = () => {
    draw();
    if (mine && !mine.fontSize) fit();
    if (group) fit(t.fontSize || 40); // a long dhikr of the group is shown whole
  };
  paint();

  const tap = (x, y) => {
    if (t.alertSound && (t.alerts.length || group)) unlockAudio(); // sound needs a touch to start
    src.add();
    if (isIstighfar(src.phrase())) {
      const r = (state.worship[dayNow] ??= {});
      r.istighfar = (r.istighfar || 0) + 1;
    }
    save();
    const [c, n] = [src.count(), src.target()];
    const reached = n && (mine ? c === n : group ? c >= n : c % n === 0);
    // The numbers the user asked to be told about, by sound or vibration or both.
    const alert = t.alerts.includes(c) && (t.alertSound || t.alertVibrate);
    if (alert) {
      if (t.alertSound) chime([0, 0.25], false);
      if (t.alertVibrate) haptic(200, true);
      if (!reached) toast(`${icon('bell', 18)} بلغت ${num(c)}`);
    } else haptic(reached ? 40 : 10);
    if (reached && group) {
      // This dhikr is done: on to the next one, or the group is complete and starts over.
      const last = group.i + 1 >= group.items.length;
      if (t.alertSound) chime(last ? [0, 0.25, 0.5] : [0, 0.25], false);
      haptic(200, true);
      toast(`${icon('check', 18)} ${last ? `أتممت «${esc(group.name)}»، تقبّل الله منك` : `أتممت ${num(n)} — إلى الذكر التالي`}`);
      Object.assign(group, { i: last ? 0 : group.i + 1, count: 0 });
      save();
      return paint();
    }
    if (reached) toast(`${icon('check', 18)} ${mine ? 'أتممت وردك اليومي من هذا الذكر' : `أتممت ${num(n)} — ${esc(src.phrase())}`}`);
    $('[data-count]', view).textContent = num(c);
    $('[data-round]', view).textContent = roundText();
    $('[data-total]', view).textContent = num(src.total());
    $('[data-today]', view).textContent = num(src.today());
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

  const shownSize = () => parseFloat($('[data-phrase]', view).style.fontSize) || 40;
  const setFont = (size) => {
    box.fontSize = Math.round(Math.max(FONT_MIN, Math.min(FONT_MAX, size)));
    $('[data-phrase]', view).style.fontSize = `${box.fontSize}px`;
  };

  const onClick = async (e) => {
    const f = e.target.closest('[data-font]');
    if (f) {
      setFont(shownSize() + Number(f.dataset.font));
      return save();
    }
    if (e.target.closest('[data-phrases]')) return choosePhrase(draw);
    if (e.target.closest('[data-look]')) return tasbeehLook(paint, box);
    if (e.target.closest('[data-alerts]')) return tasbeehAlerts(paint);
    if (e.target.closest('[data-groups]')) return tasbeehGroups();
    const st = e.target.closest('[data-step]');
    if (st) {
      Object.assign(group, { i: Math.max(0, Math.min(group.items.length - 1, group.i + Number(st.dataset.step))), count: 0 });
      save();
      return paint();
    }
    if (e.target.closest('[data-dim]')) {
      // Steps through the dimming levels; from a level set on the slider, to the next one up.
      const next = DIM_STEPS.find((d) => d > t.dim);
      t.dim = next ?? 0;
      save();
      paint();
      return toast(t.dim ? `تعتيم ${num(t.dim)}٪` : 'بلا تعتيم');
    }
    const n = e.target.closest('[data-t]');
    if (n) {
      t.target = Number(n.dataset.t);
      save();
      return draw();
    }
    if (e.target.closest('[data-reset]')) {
      if (await confirmSheet(group ? 'البدء من أول المجموعة؟' : mine ? 'تصفير عدد اليوم لهذا الذكر؟' : 'تصفير العدّاد الحالي؟', { ok: group ? 'من الأول' : 'تصفير', danger: false })) {
        if (group) group.i = 0;
        src.reset();
        save();
        paint();
      }
      return;
    }
    if (e.target.closest('[data-ui], a, button')) return;
    tap(e.clientX, e.clientY);
  };

  // Pinch on iPhone (Safari's gesture events) resizes the dhikr text.
  let base = 40;
  let pinching = false;
  const onGestureStart = (e) => {
    e.preventDefault();
    pinching = true;
    base = shownSize();
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
    // After midnight the counts belong to a new day: draw the screen again for it.
    tick: () => (today().key !== dayNow ? 'rerender' : undefined),
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
          </form>`;
        if (editing >= 0 && editing < list.length) body.querySelector('.phrase-edit textarea')?.focus();
      };
      draw();

      body.addEventListener('click', async (e) => {
        const pick = e.target.closest('[data-i]');
        if (pick) {
          t.phrase = list[Number(pick.dataset.i)];
          t.count = 0;
          if (isIstighfar(t.phrase)) t.target = 0;
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
          if (!(await confirmSheet(`حذف «${short(list[i])}» من السبحة نهائياً؟`, { ok: 'حذف نهائي' }))) return;
          const [gone] = list.splice(i, 1);
          editing = -1;
          if (gone === t.phrase) {
            t.phrase = list[0] || 'سبحان الله';
            t.count = 0;
          }
          save();
          redraw();
          return draw();
        }
      });
      body.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target.closest('[data-save]');
        const text = form.text.value.trim();
        if (!text) return;
        const i = Number(form.dataset.save);
        const isEdit = i < list.length;
        if (!isEdit && list.includes(text)) return toast('هذا الذكر في السبحة من قبل');
        if (isEdit) {
          if (list[i] === t.phrase) t.phrase = text;
          list[i] = text;
        } else list.push(text);
        editing = -1;
        save();
        redraw();
        draw();
        toast(`${icon('check', 18)} ${isEdit ? 'حُفظ التعديل' : 'أُضيف إلى السبحة'}`);
      });
    },
    { title: 'أذكار السبحة' }
  );
}

// Background, dhikr colour, sizes and dimming of the tasbeeh screen; changes show at once behind the sheet.
function tasbeehLook(redraw, box = state.tasbeeh) {
  const t = state.tasbeeh;
  const val = (key) => (key === 'fontSize' ? box.fontSize || 40 : t[key]);
  const shown = (key) => (key === 'counterSize' ? `${num(Math.round(t[key] * 100))}٪` : key === 'dim' ? `${num(t[key])}٪` : num(val(key)));
  const slider = (key, label, min, max, step) => `
    <label class="field range-field"><span>${label} <b data-out="${key}">${shown(key)}</b></span>
      <input type="range" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${val(key)}"></label>`;
  openSheet(
    `<div data-body></div>`,
    (el) => {
      const body = el.querySelector('[data-body]');
      const draw = () => {
        const bg = tsbBg(t);
        body.innerHTML = `
          <h4 class="sheet-sub">لون الخلفية</h4>
          <div class="swatches">${T_BGS.map((b) => `<button class="swatch ${b.id === bg.id ? 'on' : ''}" data-bg="${b.id}" style="background:${b.css || 'linear-gradient(170deg, #2a5cc4, #070f2c)'}" aria-label="${b.name}" title="${b.name}"></button>`).join('')}</div>
          <h4 class="sheet-sub">لون الذكر</h4>
          <div class="swatches">
            <button class="swatch auto ${!t.ink ? 'on' : ''}" data-ink="" aria-label="تلقائي" title="تلقائي">${icon('reset', 16)}</button>
            ${T_INKS.map((c) => `<button class="swatch ${t.ink === c ? 'on' : ''}" data-ink="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}
          </div>
          ${slider('fontSize', 'حجم الذكر', FONT_MIN, FONT_MAX, 1)}
          ${slider('counterSize', 'حجم العدّاد', 0.6, 1.4, 0.05)}
          ${slider('dim', 'تعتيم الصفحة', 0, DIM_MAX, 5)}
          <button class="btn ghost wide" data-look-reset>${icon('reset', 18)} الألوان والأحجام الأصلية</button>`;
      };
      draw();
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-bg]');
        const k = e.target.closest('[data-ink]');
        if (b) t.bg = b.dataset.bg;
        else if (k) t.ink = k.dataset.ink;
        else if (e.target.closest('[data-look-reset]')) {
          Object.assign(t, { bg: 'blue', ink: '', counterSize: 1, dim: 0 });
          if (box === t) t.fontSize = 40;
          else delete box.fontSize;
        }
        else return;
        haptic();
        save();
        redraw();
        draw();
      });
      body.addEventListener('input', (e) => {
        const r = e.target.closest('[data-range]');
        if (!r) return;
        const key = r.dataset.range;
        (key === 'fontSize' ? box : t)[key] = Number(r.value);
        body.querySelector(`[data-out="${key}"]`).textContent = shown(key);
        save();
        redraw();
      });
    },
    { title: 'ألوان السبحة وحجمها' }
  );
}

// The counts at which the tasbeeh tells the user, by sound or vibration: add to them or remove.
function tasbeehAlerts(redraw) {
  const t = state.tasbeeh;
  openSheet(
    `<div data-body></div>`,
    (el) => {
      const body = el.querySelector('[data-body]');
      const draw = () => {
        body.innerHTML = `
          <p class="hint">ينبّهك التطبيق بالصوت أو بالاهتزاز أثناء التسبيح عند الوصول لأحد الأعداد التالية، ويمكنك الإضافة إليها أو إلغاء بعضها.</p>
          <div class="menu alerts">
            ${t.alerts.map((n) => `<div><b>${num(n)}</b><button class="icon-btn ghost sm danger-ic" data-del="${n}" aria-label="حذف">${icon('close', 18)}</button></div>`).join('') || '<p class="hint center">لا أعداد. أضف عدداً بالأسفل.</p>'}
          </div>
          <form class="alert-add" data-add>
            <input name="n" type="number" inputmode="numeric" min="1" max="100000" placeholder="عدد جديد، مثل ${num(99)}" required>
            <button class="btn primary" type="submit">${icon('plus', 18)} إضافة</button>
          </form>
          <div class="row"><span class="row-label">الصوت</span>${toggle('alertSound', t.alertSound)}</div>
          <div class="row"><span class="row-label">الاهتزاز</span>${toggle('alertVibrate', t.alertVibrate)}</div>
          <p class="hint">الصوت لا يُسمع والجوال على الصامت. والاهتزاز على الآيفون نقرة خفيفة، ويحتاج iOS 17.4 أو أحدث.</p>`;
      };
      draw();
      body.addEventListener('click', (e) => {
        const d = e.target.closest('[data-del]');
        if (!d) return;
        t.alerts = t.alerts.filter((n) => n !== Number(d.dataset.del));
        save();
        draw();
        redraw();
      });
      body.addEventListener('submit', (e) => {
        e.preventDefault();
        const n = Math.round(Number(e.target.n.value));
        if (!(n > 0) || n > 100000) return;
        if (!t.alerts.includes(n)) t.alerts = [...t.alerts, n].sort((a, b) => a - b);
        save();
        draw();
        redraw();
      });
      body.addEventListener('change', (e) => {
        const name = e.target.name;
        if (name !== 'alertSound' && name !== 'alertVibrate') return;
        t[name] = e.target.checked;
        save();
        // Let the choice be heard or felt at once.
        if (t[name]) name === 'alertSound' ? (unlockAudio(), chime([0, 0.25], false)) : haptic(200, true);
        redraw();
      });
    },
    { title: 'تنبيه الأعداد' }
  );
}

// Groups: adhkar counted in order, each to its own number; when one is done the next comes.
function tasbeehGroups() {
  const short = (x) => (x.length > 60 ? x.slice(0, 57) + '…' : x);
  openSheet(
    `<div data-body></div>`,
    (el, close) => {
      const body = el.querySelector('[data-body]');
      let edit = null; // a copy of the group being edited, or a new one
      const draw = () => {
        if (!edit) {
          body.innerHTML = `
            <p class="hint">المجموعة أذكار متتابعة، لكل ذكر عدده؛ إذا أتممته جاء الذي بعده، ثم الذي بعده.</p>
            ${state.groups
              .map(
                (g) => `<div class="grp">
                  <button class="grp-go" data-run="${g.id}"><b>${esc(g.name)}</b><small>${num(g.items.length)} أذكار${g.i || g.count ? ` • وصلت إلى الذكر ${num(g.i + 1)} (${num(g.count)})` : ''}</small></button>
                  <button class="icon-btn ghost sm" data-edit="${g.id}" aria-label="تعديل">${icon('edit', 18)}</button>
                  <button class="icon-btn ghost sm danger-ic" data-del="${g.id}" aria-label="حذف">${icon('trash', 18)}</button>
                </div>`
              )
              .join('')}
            <button class="btn ghost wide" data-new>${icon('plus', 18)} مجموعة جديدة</button>`;
          return;
        }
        body.innerHTML = `
          <form class="form" data-save>
            <label class="field"><span>اسم المجموعة</span><input name="name" maxlength="40" required value="${esc(edit.name)}" placeholder="مثل: برنامج يومي"></label>
            <div class="grp-items">
              ${edit.items
                .map(
                  (x, i) => `<div class="grp-item"><span>${esc(short(x.text))}</span>
                    <input type="number" inputmode="numeric" min="1" max="100000" value="${x.target}" data-target="${i}" aria-label="العدد">
                    <button type="button" class="icon-btn ghost sm" data-up="${i}" aria-label="تقديم" ${i ? '' : 'disabled'}>${icon('arrowUp', 16)}</button>
                    <button type="button" class="icon-btn ghost sm danger-ic" data-rm="${i}" aria-label="حذف">${icon('close', 16)}</button></div>`
                )
                .join('') || '<p class="hint center">أضف الأذكار بالترتيب الذي تريده.</p>'}
            </div>
            <div class="alert-add">
              <select name="pick" aria-label="ذكر من السبحة">${tasbeehList().map((p, i) => `<option value="${i}">${esc(short(p))}</option>`).join('')}</select>
              <button class="btn ghost" type="button" data-add>${icon('plus', 18)} أضف</button>
            </div>
            <div class="sheet-actions"><button class="btn primary" type="submit">حفظ المجموعة</button><button class="btn ghost" type="button" data-back>رجوع</button></div>
          </form>`;
      };
      draw();
      body.addEventListener('click', async (e) => {
        const run = e.target.closest('[data-run]');
        if (run) {
          close();
          location.hash = `#/tasbeeh/g-${run.dataset.run}`;
          return;
        }
        const ed = e.target.closest('[data-edit]');
        if (ed) edit = JSON.parse(JSON.stringify(state.groups.find((g) => g.id === ed.dataset.edit)));
        else if (e.target.closest('[data-new]')) edit = { id: '', name: '', i: 0, count: 0, items: [] };
        else if (e.target.closest('[data-back]')) edit = null;
        else if (e.target.closest('[data-add]')) {
          edit.name = body.querySelector('[name=name]').value;
          edit.items.push({ text: tasbeehList()[Number(body.querySelector('[name=pick]').value)], target: 100 });
        } else if (e.target.closest('[data-rm]')) edit.items.splice(Number(e.target.closest('[data-rm]').dataset.rm), 1);
        else if (e.target.closest('[data-up]')) {
          const i = Number(e.target.closest('[data-up]').dataset.up);
          [edit.items[i - 1], edit.items[i]] = [edit.items[i], edit.items[i - 1]];
        } else {
          const del = e.target.closest('[data-del]');
          if (!del || !(await confirmSheet('حذف هذه المجموعة؟'))) return;
          state.groups = state.groups.filter((g) => g.id !== del.dataset.del);
          save();
          if (location.hash === `#/tasbeeh/g-${del.dataset.del}`) location.hash = '#/tasbeeh';
        }
        draw();
      });
      body.addEventListener('input', (e) => {
        if (e.target.name === 'name') edit.name = e.target.value;
        const i = e.target.dataset.target;
        if (i !== undefined) edit.items[Number(i)].target = Math.max(1, Math.min(100000, Math.round(Number(e.target.value) || 1)));
      });
      body.addEventListener('submit', (e) => {
        e.preventDefault();
        edit.name = edit.name.trim();
        if (!edit.name) return;
        if (!edit.items.length) return toast('أضف ذكراً واحداً على الأقل');
        const old = state.groups.find((g) => g.id === edit.id);
        // A changed list starts again from its first dhikr.
        if (old) Object.assign(old, edit, { i: 0, count: 0 });
        else state.groups.push({ ...edit, id: uid() });
        save();
        edit = null;
        draw();
        toast(`${icon('check', 18)} حُفظت المجموعة`);
      });
    },
    { title: 'المجموعات' }
  );
}
