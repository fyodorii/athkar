// «الديون»: what I owe and what I am owed, with due dates and a reminder three days ahead.

import { gregText, num } from '../dates.js';
import { icon } from '../icons.js';
import { dayKey } from '../prayer.js';
import { daysBetween } from '../occasions.js';
import { save, state, uid } from '../store.js';
import { today } from '../today.js';
import { confirmSheet, esc, openSheet, pageHeader, toast, toggle } from '../ui.js';

const money = (n) => num(Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const keyDay = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return { y, m, d };
};

export function render(view) {
  const draw = () => {
    const now = today().day;
    const open = state.debts.filter((d) => !d.paid).sort((a, b) => (a.due || '9').localeCompare(b.due || '9') || b.date.localeCompare(a.date));
    const paid = state.debts.filter((d) => d.paid).sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0));
    const sum = (dir) => open.filter((d) => d.dir === dir).reduce((n, d) => n + d.amount, 0);
    const row = (d) => {
      let due = '';
      if (d.due && !d.paid) {
        const left = daysBetween(now, keyDay(d.due));
        due = `<span class="pill ${left < 0 ? 'warn' : left <= 3 ? 'sun' : 'soft'}">${left < 0 ? `متأخر ${num(-left)} يوماً` : left === 0 ? 'يحلّ اليوم' : `بعد ${num(left)} يوماً`}</span>`;
      }
      return `<button class="db-row ${d.dir} ${d.paid ? 'paid' : ''}" data-id="${d.id}">
        <span class="db-ic">${icon(d.paid ? 'check' : d.dir === 'owe' ? 'arrowDown' : 'arrowUp', 20)}</span>
        <span class="db-text"><b>${esc(d.person)}</b><small>${d.dir === 'owe' ? 'عليّ' : 'لي'} • ${gregText(keyDay(d.date))}${d.remind && d.due && !d.paid ? ` • ${icon('bell', 12)}` : ''}</small>${d.note ? `<small>${esc(d.note)}</small>` : ''}</span>
        <span class="db-amt"><b>${money(d.amount)} <i>ريال</i></b>${due}</span>
      </button>`;
    };
    view.innerHTML = `
      ${pageHeader('الديون', { back: '#/tools' })}
      <section class="db-sum">
        <div class="owe"><small>عليّ</small><b>${money(sum('owe'))} <i>ريال</i></b></div>
        <div class="lent"><small>لي</small><b>${money(sum('lent'))} <i>ريال</i></b></div>
      </section>
      ${
        state.debts.length
          ? `${open.length ? `<div class="db-list">${open.map(row).join('')}</div>` : '<p class="hint center">لا ديون قائمة، والحمد لله.</p>'}
             ${paid.length ? `<h3 class="section-title small">المسدَّدة</h3><div class="db-list">${paid.map(row).join('')}</div>` : ''}`
          : `<div class="empty"><div class="empty-art">${icon('wallet', 40)}</div><b>لا ديون مسجلة</b><p>أضف ديناً بزر + بالأسفل</p></div>`
      }
      <p class="hint center">«يا أيها الذين آمنوا إذا تداينتم بدين إلى أجل مسمى فاكتبوه»</p>
      <button class="fab" data-add aria-label="دين جديد">${icon('plus', 26)}</button>`;
  };

  const form = (debt) => {
    const d = debt || { dir: 'owe', person: '', amount: '', date: dayKey(today().day), due: '', remind: false, note: '' };
    openSheet(
      `<form class="form">
         <div class="seg-mini wide" data-dir>
           <button type="button" class="${d.dir === 'owe' ? 'on' : ''}" data-v="owe">عليّ (تسلفت)</button>
           <button type="button" class="${d.dir === 'lent' ? 'on' : ''}" data-v="lent">لي (أقرضت)</button>
         </div>
         <label class="field"><span>الشخص</span><input name="person" maxlength="40" required value="${esc(d.person)}"></label>
         <label class="field"><span>المبلغ (ريال)</span><input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required value="${d.amount}"></label>
         <label class="field"><span>${icon('calendar', 16)} تاريخ الدين</span><input name="date" type="date" required value="${d.date}"></label>
         <label class="field"><span>${icon('calendar', 16)} تاريخ الاستحقاق (اختياري)</span><input name="due" type="date" value="${d.due || ''}"></label>
         <div class="row"><span class="row-label">تذكير قبل الاستحقاق بـ${num(3)} أيام<small>تنبيه قبله بثلاثة أيام وفي يومه</small></span>${toggle('remind', d.remind)}</div>
         <label class="field"><span>ملاحظة (اختياري)</span><input name="note" maxlength="120" value="${esc(d.note || '')}"></label>
         <div class="sheet-actions"><button class="btn primary" type="submit">${icon('save', 20)} حفظ الدين</button></div>
       </form>`,
      (el, close) => {
        const f = el.querySelector('form');
        let dir = d.dir;
        f.addEventListener('click', (e) => {
          const b = e.target.closest('[data-dir] [data-v]');
          if (!b) return;
          dir = b.dataset.v;
          for (const x of f.querySelectorAll('[data-dir] button')) x.classList.toggle('on', x === b);
        });
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          const amount = Math.round(Number(f.amount.value) * 100) / 100;
          const person = f.person.value.trim();
          if (!person || !(amount > 0)) return;
          const data = { dir, person, amount, date: f.date.value, due: f.due.value, remind: f.remind.checked && !!f.due.value, note: f.note.value.trim() };
          if (debt) Object.assign(debt, data);
          else state.debts.push({ id: uid(), paid: false, paidAt: 0, ...data });
          save();
          close();
          draw();
          if (data.remind && !state.settings.notify.on) toast('فعّل التنبيهات من الإعدادات ليصلك التذكير');
        });
      },
      { title: debt ? 'تعديل الدين' : 'دين جديد' }
    );
  };

  const menu = (d) => {
    openSheet(
      `<div class="menu">
         <button data-a="paid">${icon('check', 20)} ${d.paid ? 'إعادته ديناً قائماً' : d.dir === 'owe' ? 'سدّدته' : 'استوفيته'}</button>
         <button data-a="edit">${icon('edit', 20)} تعديل</button>
         <button class="danger" data-a="del">${icon('trash', 20)} حذف</button>
       </div>`,
      (el, close) =>
        el.addEventListener('click', async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (!a) return;
          close();
          if (a === 'edit') return form(d);
          if (a === 'paid') Object.assign(d, { paid: !d.paid, paidAt: d.paid ? 0 : Date.now() });
          if (a === 'del') {
            if (!(await confirmSheet('حذف هذا الدين؟'))) return;
            state.debts = state.debts.filter((x) => x !== d);
          }
          save();
          draw();
        }),
      { title: `${d.person} — ${money(d.amount)} ريال` }
    );
  };

  draw();
  view.onclick = (e) => {
    if (e.target.closest('[data-add]')) return form();
    const r = e.target.closest('[data-id]');
    if (r) menu(state.debts.find((d) => d.id === r.dataset.id));
  };
  return { destroy: () => (view.onclick = null) };
}
