// My notebook: the user's own supplications, and every dhikr bookmarked from the library.

import { CATEGORY_BY_ID, findItem } from '../adhkar-data.js';
import { num } from '../dates.js';
import { icon } from '../icons.js';
import { save, state, toggleSaved, uid } from '../store.js';
import { $, $$, confirmSheet, copyText, esc, openSheet, pageHeader, segmented, shareText, toast } from '../ui.js';
import { editCustom } from './adhkar.js';

export const TAGS = ['عام', 'المغفرة', 'الوالدين', 'الذرية', 'الرزق', 'الشفاء', 'الهداية', 'الآخرة', 'ذكر'];

const TABS = [
  ['#/notebook', 'أدعيتي'],
  ['#/notebook/saved', 'المحفوظات'],
];

let query = '';
let tagFilter = '';

const norm = (s) => s.replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const matches = (text) => !query || norm(text).includes(norm(query));

export function render(view, tab) {
  const saved = tab === 'saved';

  const draw = () => {
    const header = pageHeader('دفتري', {
      sub: 'أدعيتك الخاصة وما حفظته من الأذكار',
      actions: saved ? '' : `<button class="icon-btn primary" data-add aria-label="دعاء جديد">${icon('plus', 22)}</button>`,
    });
    view.innerHTML = `
      ${header}
      ${segmented(TABS, saved ? '#/notebook/saved' : '#/notebook')}
      <label class="search">${icon('search', 18)}<input type="search" placeholder="ابحث في ${saved ? 'المحفوظات' : 'أدعيتك'}" value="${esc(query)}" data-q></label>
      <div data-list></div>`;
    drawList();
  };

  const drawList = () => {
    const box = $('[data-list]', view);
    if (saved) {
      const items = state.saved.map((s) => findItem(s.id)).filter(Boolean).filter((x) => matches(x.text + (x.title || '')));
      box.innerHTML = items.length
        ? `<section class="notes">${items.map(savedCard).join('')}</section>`
        : empty('bookmark', state.saved.length ? 'لا نتائج' : 'لا محفوظات بعد', 'اضغط على علامة الحفظ تحت أي ذكر في قسم الأذكار ليظهر هنا.');
      return;
    }
    const usedTags = [...new Set(state.notebook.map((n) => n.tag).filter(Boolean))];
    const items = state.notebook
      .filter((n) => (!tagFilter || n.tag === tagFilter) && matches(n.title + ' ' + n.text))
      .sort((a, b) => (b.pinned - a.pinned) || b.updated - a.updated);
    box.innerHTML = `
      ${usedTags.length > 1 ? `<div class="chips scroll" data-tags>
        <button class="chip-opt ${!tagFilter ? 'on' : ''}" data-tag="">الكل</button>
        ${usedTags.map((t) => `<button class="chip-opt ${tagFilter === t ? 'on' : ''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
      </div>` : ''}
      ${
        items.length
          ? `<section class="notes">${items.map(noteCard).join('')}</section>`
          : state.notebook.length
            ? empty('search', 'لا نتائج', 'جرّب كلمة أخرى.')
            : `${empty('book', 'دفترك الخاص', 'اكتب أدعيتك التي تحب أن تدعو بها، لنفسك ولوالديك ولمن تحب، ورتّبها بالتصنيفات.')}
               <div class="center"><button class="btn primary" data-add>${icon('plus', 20)} أضف دعاءً</button></div>`
      }`;
  };

  draw();

  const onInput = (e) => {
    if (!e.target.matches('[data-q]')) return;
    query = e.target.value.trim();
    drawList();
  };

  const onClick = async (e) => {
    if (e.target.closest('[data-add]')) return editNote(null, draw);
    const tag = e.target.closest('[data-tag]');
    if (tag) {
      tagFilter = tag.dataset.tag;
      return drawList();
    }
    const card = e.target.closest('[data-note]');
    if (card) return openNote(state.notebook.find((n) => n.id === card.dataset.note), drawList);
    const sv = e.target.closest('[data-saved]');
    if (sv) {
      const item = findItem(sv.dataset.saved);
      const a = e.target.closest('[data-act]')?.dataset.act;
      const full = (item.before ? item.before + '\n' : '') + item.text;
      if (a === 'copy') return copyText(full);
      if (a === 'share') return shareText(full);
      if (a === 'remove') {
        toggleSaved(item.id);
        toast('أُزيل من المحفوظات');
        return drawList();
      }
      if (a === 'open') location.hash = `#/adhkar/${item.id.replace(/-\d+$/, '')}`;
    }
  };

  view.addEventListener('input', onInput);
  view.addEventListener('click', onClick);
  return {
    destroy() {
      view.removeEventListener('input', onInput);
      view.removeEventListener('click', onClick);
    },
  };
}

function empty(ic, title, text) {
  return `<div class="empty"><div class="empty-art">${icon(ic, 44)}</div><b>${esc(title)}</b><p>${esc(text)}</p></div>`;
}

function noteCard(n) {
  return `<article class="note" data-note="${n.id}">
    ${n.pinned ? `<span class="note-pin">${icon('pin', 14)}</span>` : ''}
    ${n.title ? `<h3>${esc(n.title)}</h3>` : ''}
    <p class="note-text">${esc(n.text)}</p>
    <div class="note-meta">${n.tag ? `<span class="pill soft">${esc(n.tag)}</span>` : ''}<time>${dateLabel(n.updated)}</time></div>
  </article>`;
}

function savedCard(x) {
  const cat = CATEGORY_BY_ID[x.id.replace(/-\d+$/, '')];
  return `<article class="note saved ${x.quran ? 'quran' : ''}" data-saved="${x.id}">
    <div class="saved-cat tone-${cat.tone}">${icon(cat.icon, 14)} ${esc(cat.title)}</div>
    ${x.title ? `<h3>${esc(x.title)}</h3>` : ''}
    <p class="note-text">${esc(x.text)}</p>
    <div class="note-meta">
      ${x.ref ? `<span class="ref">${esc(x.ref)}</span>` : ''}
      <div class="dhikr-actions">
        <button class="icon-btn ghost sm" data-act="open" aria-label="فتح في الأذكار">${icon('chevron', 20)}</button>
        <button class="icon-btn ghost sm" data-act="copy" aria-label="نسخ">${icon('copy', 20)}</button>
        <button class="icon-btn ghost sm" data-act="share" aria-label="مشاركة">${icon('share', 20)}</button>
        <button class="icon-btn ghost sm" data-act="remove" aria-label="إزالة">${icon('bookmarkOn', 20)}</button>
      </div>
    </div>
  </article>`;
}

function dateLabel(ms) {
  const d = new Date(ms);
  return num(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`);
}

function openNote(n, redraw) {
  openSheet(
    `<article class="note-full">
       ${n.title ? `<h2>${esc(n.title)}</h2>` : ''}
       <p class="note-full-text">${esc(n.text)}</p>
       ${n.tag ? `<span class="pill soft">${esc(n.tag)}</span>` : ''}
     </article>
     <div class="menu">
       <button data-a="copy">${icon('copy', 20)} نسخ</button>
       <button data-a="share">${icon('share', 20)} مشاركة</button>
       <button data-a="dhikr">${icon('beads', 20)} اجعله ذكراً بعدّاد في أذكاري</button>
       <button data-a="pin">${icon('pin', 20)} ${n.pinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}</button>
       <button data-a="edit">${icon('edit', 20)} تعديل</button>
       <button data-a="delete" class="danger">${icon('trash', 20)} حذف</button>
     </div>`,
    (el, close) => {
      el.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (!a) return;
        if (a === 'copy') return copyText(n.text);
        if (a === 'share') return shareText(n.text);
        close();
        if (a === 'dhikr') editCustom(null, () => (location.hash = '#/mine'), { text: n.text });
        if (a === 'pin') {
          n.pinned = !n.pinned;
          save();
          redraw();
        }
        if (a === 'edit') editNote(n, redraw);
        if (a === 'delete' && (await confirmSheet('حذف هذا الدعاء من دفترك؟'))) {
          state.notebook = state.notebook.filter((x) => x.id !== n.id);
          save();
          redraw();
        }
      });
    },
    { title: 'دعائي' }
  );
}

function editNote(n, redraw) {
  const v = n || { title: '', text: '', tag: 'عام', pinned: false };
  openSheet(
    `<form class="form">
       <label class="field"><span>العنوان (اختياري)</span><input name="title" maxlength="80" value="${esc(v.title)}" placeholder="مثال: دعاء للوالدين"></label>
       <label class="field"><span>الدعاء</span><textarea name="text" rows="7" required placeholder="اكتب دعاءك هنا…">${esc(v.text)}</textarea></label>
       <div class="field"><span>التصنيف</span>
         <div class="chips" data-tags>${TAGS.map((t) => `<button type="button" class="chip-opt ${v.tag === t ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
         <input name="tag" maxlength="30" value="${esc(v.tag)}" placeholder="أو اكتب تصنيفاً">
       </div>
       <div class="sheet-actions">
         <button class="btn primary" type="submit">${n ? 'حفظ' : 'إضافة إلى دفتري'}</button>
         <button class="btn ghost" type="button" data-close>إلغاء</button>
       </div>
     </form>`,
    (el, close) => {
      const form = el.querySelector('form');
      el.querySelector('[data-tags]').addEventListener('click', (e) => {
        const b = e.target.closest('[data-t]');
        if (!b) return;
        $$('.chip-opt', el).forEach((x) => x.classList.toggle('on', x === b));
        form.tag.value = b.dataset.t;
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = form.text.value.trim();
        if (!text) return;
        const data = { title: form.title.value.trim(), text, tag: form.tag.value.trim(), updated: Date.now() };
        if (n) Object.assign(n, data);
        else state.notebook.unshift({ id: uid(), pinned: false, created: Date.now(), ...data });
        save();
        close();
        toast(`${icon('check', 18)} ${n ? 'حُفظ التعديل' : 'أُضيف الدعاء إلى دفترك'}`);
        redraw();
      });
      if (!n) setTimeout(() => form.text.focus(), 300);
    },
    { title: n ? 'تعديل الدعاء' : 'دعاء جديد' }
  );
}
