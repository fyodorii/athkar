// «أدعيتي»: the user's own supplications.

import { num } from '../dates.js';
import { icon } from '../icons.js';
import { save, state, uid } from '../store.js';
import { $, confirmSheet, copyText, esc, openSheet, pageHeader, shareText, toast } from '../ui.js';
import { editCustom } from './adhkar.js';

// The list and its words.
const KINDS = {
  dua: { key: 'notebook', href: '#/notebook', sub: 'دفتر أدعيتك الخاصة', one: 'الدعاء', add: 'دعاء جديد', search: 'أدعيتك', empty: ['hand', 'دفتر أدعيتك', 'اكتب أدعيتك التي تحب أن تدعو بها، لنفسك ولوالديك ولمن تحب.'], hint: 'اكتب دعاءك هنا…' },
};

let query = '';

const norm = (s) => s.replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const matches = (text) => !query || norm(text).includes(norm(query));

export function render(view) {
  const kind = 'dua';
  const K = KINDS[kind];
  const list = () => state[K.key];

  const draw = () => {
    view.innerHTML = `
      ${pageHeader('أدعيتي', { sub: K.sub, actions: `<button class="icon-btn primary" data-add aria-label="${K.add}">${icon('plus', 22)}</button>` })}
      <label class="search">${icon('search', 18)}<input type="search" placeholder="ابحث في ${K.search}" value="${esc(query)}" data-q></label>
      <div data-list></div>`;
    drawList();
  };

  const drawList = () => {
    const items = list()
      .filter((n) => matches(n.title + ' ' + n.text))
      .sort((a, b) => b.pinned - a.pinned || b.updated - a.updated);
    $('[data-list]', view).innerHTML = items.length
      ? `<section class="notes">${items.map(noteCard).join('')}</section>`
      : list().length
        ? empty('search', 'لا نتائج', 'جرّب كلمة أخرى.')
        : `${empty(...K.empty)}<div class="center"><button class="btn primary" data-add>${icon('plus', 20)} ${K.add}</button></div>`;
  };

  draw();

  const onInput = (e) => {
    if (!e.target.matches('[data-q]')) return;
    query = e.target.value.trim();
    drawList();
  };
  const onClick = (e) => {
    if (e.target.closest('[data-add]')) return editNote(kind, null, draw);
    const card = e.target.closest('[data-note]');
    if (card) openNote(kind, list().find((n) => n.id === card.dataset.note), drawList);
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
    ${n.image ? `<img class="note-img" src="${n.image}" alt="" loading="lazy">` : ''}
    <p class="note-text">${esc(n.text)}</p>
    <div class="note-meta"><span></span><time>${dateLabel(n.updated)}</time></div>
  </article>`;
}

function dateLabel(ms) {
  const d = new Date(ms);
  return num(`${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`);
}

function openNote(kind, n, redraw) {
  const K = KINDS[kind];
  openSheet(
    `<article class="note-full">
       ${n.title ? `<h2>${esc(n.title)}</h2>` : ''}
       ${n.image ? `<img class="note-img" src="${n.image}" alt="">` : ''}
       <p class="note-full-text">${esc(n.text)}</p>
     </article>
     <div class="menu">
       <button data-a="copy">${icon('copy', 20)} نسخ</button>
       <button data-a="share">${icon('share', 20)} مشاركة</button>
       ${kind === 'dua' ? `<button data-a="dhikr">${icon('beads', 20)} اجعله ذكراً بعدّاد في أذكاري</button>` : ''}
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
        if (a === 'edit') editNote(kind, n, redraw);
        if (a === 'delete' && (await confirmSheet(`حذف ${kind === 'dua' ? 'هذا الدعاء' : 'هذه الملاحظة'}؟`))) {
          state[K.key] = state[K.key].filter((x) => x.id !== n.id);
          save();
          redraw();
        }
      });
    },
    { title: 'دعائي' }
  );
}

// A picture small enough to keep with the app's data: at most 900 pixels a side, as JPEG.
function shrink(file) {
  return new Promise((ok, fail) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      [c.width, c.height] = [Math.round(img.width * k), Math.round(img.height * k)];
      const x = c.getContext('2d');
      x.fillStyle = '#fff';
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      fail(new Error('image'));
    };
    img.src = url;
  });
}

function editNote(kind, n, redraw) {
  const K = KINDS[kind];
  const v = n || { title: '', text: '', pinned: false };
  let image = v.image || '';
  openSheet(
    `<form class="form">
       <label class="field"><span>العنوان (اختياري)</span><input name="title" maxlength="80" value="${esc(v.title)}"></label>
       <label class="field"><span>${K.one}</span><textarea name="text" rows="7" required placeholder="${K.hint}">${esc(v.text)}</textarea></label>
       <div class="note-pic" data-pic></div>
       <div class="sheet-actions">
         <button class="btn primary" type="submit">${n ? 'حفظ' : 'إضافة'}</button>
         <button class="btn ghost" type="button" data-close>إلغاء</button>
       </div>
     </form>`,
    (el, close) => {
      const form = el.querySelector('form');
      const pic = el.querySelector('[data-pic]');
      const drawPic = () => {
        pic.innerHTML = image
          ? `<img class="note-img" src="${image}" alt=""><button class="btn ghost" type="button" data-nopic>${icon('trash', 18)} إزالة الصورة</button>`
          : `<label class="btn ghost wide">${icon('plus', 18)} إضافة صورة<input type="file" accept="image/*" hidden data-file></label>`;
      };
      drawPic();
      pic.addEventListener('click', (e) => {
        if (!e.target.closest('[data-nopic]')) return;
        image = '';
        drawPic();
      });
      pic.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          image = await shrink(file);
          drawPic();
        } catch (err) {
          toast('تعذر قراءة الصورة');
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = form.text.value.trim();
        if (!text) return;
        const data = { title: form.title.value.trim(), text, image, updated: Date.now() };
        if (n) Object.assign(n, data);
        else state[K.key].unshift({ id: uid(), pinned: false, created: Date.now(), ...data });
        save();
        close();
        toast(`${icon('check', 18)} ${n ? 'حُفظ التعديل' : 'أُضيفت'}`);
        redraw();
      });
      if (!n) setTimeout(() => form.text.focus(), 300);
    },
    { title: n ? `تعديل ${K.one}` : K.add }
  );
}
