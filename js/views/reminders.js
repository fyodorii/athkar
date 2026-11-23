// «تذكيراتي»: what the user wants to be reminded of, each at its time, every day.

import { clockText } from '../dates.js';
import { icon } from '../icons.js';
import { askPermission } from '../notify.js';
import { save, state, uid } from '../store.js';
import { SURAHS } from '../quran-data.js';
import { hoursAt, today } from '../today.js';
import { esc, pageHeader, toast, toggle } from '../ui.js';

export function render(view) {
  let draft = { text: '', time: '21:30' };
  let sdraft = { surah: 67, time: '21:00' };
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
      <section class="card sur ${state.surahRem.on ? '' : 'off'}">
        <div class="sur-head">
          <span class="sur-ic">${icon('quran', 20)}</span><b>تذكير بتلاوة سورة</b>
          <button class="icon-btn ghost" data-sur-on aria-label="${state.surahRem.on ? 'إيقاف تذكير السور' : 'تشغيل تذكير السور'}">${icon(state.surahRem.on ? 'bell' : 'bellOff', 22)}</button>
        </div>
        ${[...state.surahRem.list]
          .sort((a, b) => a.time.localeCompare(b.time))
          .map(
            (r) => `<div class="sur-row">
              <span class="sur-chip">${icon('quran', 15)} ${esc(SURAHS[r.surah - 1]?.[0] || '')}</span>
              <span class="sur-chip">${icon('clock', 15)} ${clockText(hours(r.time), state.settings.clock24)}</span>
              <button class="icon-btn ghost sm" data-sur-del="${r.id}" aria-label="حذف">${icon('close', 18)}</button>
            </div>`
          )
          .join('')}
        <form class="sur-add" data-sur-form>
          <select name="surah" aria-label="السورة">${SURAHS.map(([name], i) => `<option value="${i + 1}" ${sdraft.surah === i + 1 ? 'selected' : ''}>${name}</option>`).join('')}</select>
          <input name="stime" type="time" required value="${sdraft.time}" aria-label="الوقت">
          <button class="btn primary" type="submit">${icon('plus', 18)} أضف</button>
        </form>
      </section>
      ${list
        .map(
          (r) => `<div class="card rem ${r.on ? '' : 'off'}">
            <span class="rem-text"><b>${esc(r.text)}</b><small>كل يوم · ${clockText(hours(r.time), state.settings.clock24)}</small></span>
            ${toggle(`on:${r.id}`, r.on)}
            <button class="icon-btn ghost sm" data-del="${r.id}" aria-label="حذف">${icon('close', 18)}</button>
          </div>`
        )
        .join('')}
      <p class="hint center">يظهر التذكير ما دام التطبيق مفتوحاً أو حيّاً في الخلفية، وما فات في آخر ١٠ دقائق يظهر عند فتحه.</p>`;
  };
  draw();
  view.onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const c0 = hoursAt();
    const nowClock = `${String(c0.h).padStart(2, '0')}:${String(c0.m).padStart(2, '0')}`;
    if (f.matches('[data-sur-form]')) {
      if (!/^\d\d:\d\d$/.test(f.stime.value)) return;
      const r = { id: uid(), surah: Number(f.surah.value), time: f.stime.value };
      state.surahRem.list.push(r);
      state.surahRem.on = true;
      if (r.time <= nowClock) state.notifyLog[`${today().key}:surah-${r.id}-${r.time}`] = Date.now(); // past today: from tomorrow
      save();
      sdraft = { surah: r.surah, time: r.time };
      draw();
      toast(`${icon('check', 18)} أُضيف تذكير سورة ${SURAHS[r.surah - 1][0]}`);
      await askPermission();
      return;
    }
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
    if (e.target.name === 'stime') sdraft.time = e.target.value;
  };
  view.onchange = (e) => {
    if (e.target.name === 'surah') sdraft.surah = Number(e.target.value);
    if (!e.target.name?.startsWith('on:')) return;
    const r = state.reminders.find((x) => x.id === e.target.name.slice(3));
    if (r) r.on = e.target.checked;
    save();
    draw();
  };
  view.onclick = (e) => {
    const sd = e.target.closest('[data-sur-del]');
    if (sd || e.target.closest('[data-sur-on]')) {
      if (sd) state.surahRem.list = state.surahRem.list.filter((x) => x.id !== sd.dataset.surDel);
      else state.surahRem.on = !state.surahRem.on;
      save();
      return draw();
    }
    const d = e.target.closest('[data-del]');
    if (!d) return;
    state.reminders = state.reminders.filter((x) => x.id !== d.dataset.del);
    save();
    draw();
  };
  return { destroy: () => (view.onsubmit = view.oninput = view.onchange = view.onclick = null) };
}
