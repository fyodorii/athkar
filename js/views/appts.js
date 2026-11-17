// «مواعيدي»: the user's appointments, each with the time left until it (or since it passed).

import { clockText, GREG_MONTHS, hijriText, num, weekday } from '../dates.js';
import { icon } from '../icons.js';
import { askPermission } from '../notify.js';
import { save, state, uid } from '../store.js';
import { confirmSheet, esc, openSheet, pageHeader, toast } from '../ui.js';

const DAY = 86400000;

// The moment of an appointment on this device's clock (a day without a time: its start).
export const apptAt = (a) => {
  const [y, m, d] = a.date.split('-').map(Number);
  const [h, mi] = a.time ? a.time.split(':').map(Number) : [0, 0];
  return new Date(y, m - 1, d, h, mi).getTime();
};

const plural = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${num(n)} ${few}` : `${num(n)} ${many}`);
const days = (n) => plural(n, 'يوم', 'يومين', 'أيام', 'يوماً');
const hours = (n) => plural(n, 'ساعة', 'ساعتين', 'ساعات', 'ساعة');
const mins = (n) => plural(n, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة');

function leftText(a, now) {
  const at = apptAt(a);
  const ms = at - now;
  if (!a.time) {
    const t = new Date(now);
    const today0 = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    const n = Math.round((at - today0) / DAY);
    if (n === 0) return ['اليوم', 'today'];
    if (n === 1) return ['غداً', 'soon'];
    return n > 0 ? [`بعد ${days(n)}`, n <= 7 ? 'soon' : ''] : [`مضى ${days(-n)}`, 'past'];
  }
  const abs = Math.abs(ms);
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const parts = d ? [days(d), h ? hours(h) : ''] : h ? [hours(h), m ? mins(m) : ''] : [m ? mins(m) : 'أقل من دقيقة'];
  const txt = parts.filter(Boolean).join(' و');
  if (ms >= 0) return [`باقي ${txt}`, ms < DAY ? 'today' : ms < 7 * DAY ? 'soon' : ''];
  return [abs < 3600000 ? 'الآن' : `مضى ${txt}`, abs < 3600000 ? 'today' : 'past'];
}

const dateLine = (a) => {
  const [y, m, d] = a.date.split('-').map(Number);
  const day = { y, m, d };
  const [h, mi] = a.time ? a.time.split(':').map(Number) : [];
  return `${weekday(day)}، ${num(d)} ${GREG_MONTHS[m - 1]} ${num(y)} · ${hijriText(day, state.settings.hijriAdjust)}${a.time ? ` · ${clockText(h + mi / 60, state.settings.clock24)}` : ''}`;
};

function editSheet(a, done) {
  const t = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const draft = a || { title: '', date: `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`, time: '' };
  openSheet(
    `<form class="form ap-form" data-ap>
       <label class="field"><span>الموعد</span><input name="title" maxlength="80" required placeholder="مثل: موعد المستشفى" value="${esc(draft.title)}"></label>
       <label class="field"><span>التاريخ</span><input name="date" type="date" required value="${draft.date}"></label>
       <label class="field"><span>الوقت (اختياري)</span><input name="time" type="time" value="${draft.time || ''}"></label>
       <label class="field"><span>ملاحظة (اختياري)</span><input name="note" maxlength="120" value="${esc(draft.note || '')}"></label>
       <div class="sheet-actions">
         <button class="btn primary" type="submit">${a ? 'حفظ' : 'أضف الموعد'}</button>
         ${a ? `<button class="btn danger" type="button" data-del>${icon('trash', 18)} حذف</button>` : '<button class="btn ghost" type="button" data-close>إلغاء</button>'}
       </div>
     </form>`,
    (el, close) => {
      const f = el.querySelector('[data-ap]');
      if (!a) setTimeout(() => f.title.focus(), 300);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = f.title.value.trim();
        if (!title || !/^\d{4}-\d\d-\d\d$/.test(f.date.value)) return;
        const time = /^\d\d:\d\d$/.test(f.time.value) ? f.time.value : '';
        const x = { id: a?.id || uid(), title, date: f.date.value, time, note: f.note.value.trim() };
        const i = state.appointments.findIndex((y) => y.id === x.id);
        if (i >= 0) state.appointments[i] = x;
        else state.appointments.push(x);
        save();
        close();
        done();
        if (!a) {
          toast(`${icon('check', 18)} أُضيف الموعد`);
          await askPermission();
        }
      });
      el.querySelector('[data-del]')?.addEventListener('click', async () => {
        close();
        if (!(await confirmSheet(`حذف «${a.title}»؟`))) return;
        state.appointments = state.appointments.filter((y) => y.id !== a.id);
        save();
        done();
      });
    },
    { title: a ? 'تعديل الموعد' : 'موعد جديد' }
  );
}

export function render(view) {
  const draw = () => {
    const now = Date.now();
    const list = [...state.appointments].sort((a, b) => apptAt(a) - apptAt(b));
    const soon = list.filter((a) => leftText(a, now)[1] !== 'past');
    const past = list.filter((a) => leftText(a, now)[1] === 'past').reverse();
    const card = (a) => {
      const [txt, kind] = leftText(a, now);
      return `<button class="card ap ${kind}" data-ap-id="${a.id}">
        <span class="ap-ic">${icon('calendar', 20)}</span>
        <span class="ap-text"><b>${esc(a.title)}</b><small>${dateLine(a)}</small>${a.note ? `<small>${esc(a.note)}</small>` : ''}</span>
        <em class="ap-left" data-left="${a.id}">${txt}</em>
      </button>`;
    };
    view.innerHTML = `
      ${pageHeader('مواعيدي', { back: '#/home' })}
      ${list.length
        ? `${soon.map(card).join('')}${past.length ? `<h3 class="pt-h">مواعيد مضت</h3>${past.map(card).join('')}` : ''}`
        : `<div class="ap-empty"><span>${icon('calendar', 40)}</span><p>أضف مواعيدك وسنعدّ لك الوقت المتبقي</p></div>`}
      <button class="ap-add" data-add>${icon('plus', 22)} موعد جديد</button>`;
  };
  draw();
  view.onclick = (e) => {
    if (e.target.closest('[data-add]')) return editSheet(null, draw);
    const b = e.target.closest('[data-ap-id]');
    if (b) editSheet(state.appointments.find((a) => a.id === b.dataset.apId), draw);
  };
  const id = setInterval(() => {
    if (document.hidden || document.body.classList.contains('sheet-open')) return;
    const now = Date.now();
    for (const el of view.querySelectorAll('[data-left]')) {
      const a = state.appointments.find((x) => x.id === el.dataset.left);
      if (a) el.textContent = leftText(a, now)[0];
    }
  }, 15000);
  return { destroy: () => {
    clearInterval(id);
    view.onclick = null;
  } };
}
