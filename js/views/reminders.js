// «تذكيراتي»: what the user wants to be reminded of, each at its time, every day.

import { clockText } from '../dates.js';
import { icon } from '../icons.js';
import { askPermission } from '../notify.js';
import { save, state, uid } from '../store.js';
import { hoursAt, today } from '../today.js';
import { esc, pageHeader, toast, toggle } from '../ui.js';

export function render(view) {
  let draft = { text: '', time: '21:30' };
  const hours = (time) => Number(time.slice(0, 2)) + Number(time.slice(3)) / 60;
  const draw = () => {
    const list = [...state.reminders].sort((a, b) => a.time.localeCompare(b.time));
    view.innerHTML = `
      ${pageHeader('تذكيراتي', { back: '#/home', actions: `<a class="icon-btn" href="#/settings/notify" aria-label="التنبيهات">${icon('gear', 20)}</a>` })}
      <p class="hint">اكتب ما تريد أن يذكّرك به التطبيق، واختر وقته، فيصلك كل يوم.</p>
      <form class="card form" data-form>
        <label class="field"><span>التذكير</span><input name="text" maxlength="120" required placeholder="مثل: اقرأ سورة الملك قبل النوم" value="${esc(draft.text)}"></label>
        <label class="field"><span>الوقت</span><input name="time" type="time" required value="${draft.time}"></label>
        <button class="btn primary wide" type="submit">أضف التذكير</button>
      </form>
      ${list
        .map(
          (r) => `<div class="card rem ${r.on ? '' : 'off'}">
            <span class="rem-text"><b>${esc(r.text)}</b><small>كل يوم · ${clockText(hours(r.time), state.settings.clock24)}</small></span>
            ${toggle(`on:${r.id}`, r.on)}
            <button class="icon-btn ghost sm" data-del="${r.id}" aria-label="حذف">${icon('close', 18)}</button>
          </div>`
        )
        .join('')}
      <p class="hint center">يظهر التذكير ما دام التطبيق مفتوحاً أو حيّاً في الخلفية، وما فات في آخر ٢٠ دقيقة يظهر عند فتحه.</p>`;
  };
  draw();
  view.onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const text = f.text.value.trim();
    if (!text || !/^\d\d:\d\d$/.test(f.time.value)) return;
    const r = { id: uid(), text, time: f.time.value, on: true };
    state.reminders.push(r);
    // A time already past today starts tomorrow, not at once.
    const c = hoursAt();
    if (r.time <= `${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}`) state.notifyLog[`${today().key}:mine-${r.id}-${r.time}`] = Date.now();
    save();
    draft = { text: '', time: f.time.value };
    draw();
    toast(`${icon('check', 18)} أُضيف التذكير`);
    await askPermission();
  };
  view.oninput = (e) => {
    if (e.target.name === 'text' || e.target.name === 'time') draft[e.target.name] = e.target.value;
  };
  view.onchange = (e) => {
    if (!e.target.name?.startsWith('on:')) return;
    const r = state.reminders.find((x) => x.id === e.target.name.slice(3));
    if (r) r.on = e.target.checked;
    save();
    draw();
  };
  view.onclick = (e) => {
    const d = e.target.closest('[data-del]');
    if (!d) return;
    state.reminders = state.reminders.filter((x) => x.id !== d.dataset.del);
    save();
    draw();
  };
  return { destroy: () => (view.onsubmit = view.oninput = view.onchange = view.onclick = null) };
}
