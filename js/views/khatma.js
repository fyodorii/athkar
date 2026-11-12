// «ختماتي»: khatmas made with a plan — a range of the mushaf (by juz, pages or surahs), the
// days it is read over, the weekdays of reading, the day's wird and a reminder — each with
// where its reading has reached.

import { gregText, hijri, HIJRI_MONTHS, num, WEEKDAYS } from '../dates.js';
import { icon } from '../icons.js';
import { ALL_WEEK, juzOf, KHATMA_COLORS, khatmaInfo } from '../khatma.js';
import { askPermission } from '../notify.js';
import { dayKey } from '../prayer.js';
import { JUZ, PAGES, SURAH_END, SURAHS } from '../quran-data.js';
import { save, state, uid } from '../store.js';
import { hoursAt, today } from '../today.js';
import { confirmSheet, esc, haptic, openSheet, pageHeader, ring, toast, toggle } from '../ui.js';

export { juzOf };

const dateOf = (ms) => {
  const d = new Date(ms);
  return gregText({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
};
const pagesWord = (n) => (n === 1 ? 'صفحة واحدة' : n === 2 ? 'صفحتان' : n <= 10 ? `${num(n)} صفحات` : `${num(n)} صفحة`);
// A day's wird in words: whole juz where it comes out even, pages otherwise.
const wirdWord = (i) => (!i.juzPer ? pagesWord(i.per) : i.juzPer === 1 ? `${num(1)} جزء` : i.juzPer === 2 ? 'جزءان' : `${num(i.juzPer)} أجزاء`);
const weekWord = (week) => (week.length === 7 ? 'كل يوم' : week.map((d) => WEEKDAYS[d].replace('ال', '')).join('، '));

export function render(view) {
  const find = (id) => state.khatmas.find((k) => k.id === id);

  const card = (k) => {
    const i = khatmaInfo(k);
    const whole = i.from === 1 && i.to === PAGES;
    const range = whole ? 'المصحف كاملاً' : `من صفحة ${num(i.from)} إلى ${num(i.to)}`;
    return `<section class="card kh" data-k="${k.id}" style="--kc:${i.color}">
      <div class="kh-top">
        <span class="kh-ring">${ring(i.read / i.total, 58, 5)}<b>${num(Math.round((i.read / i.total) * 100))}%</b></span>
        <span class="kh-text">
          <small>${icon('bookmarkOn', 14)} ${esc(k.name)}</small>
          <b>${i.done ? 'أتممت الختمة، تقبّل الله منك' : `ورد اليوم: ${i.pos === i.wirdTo ? `صفحة ${num(i.pos)}` : `من ${num(i.pos)} إلى ${num(i.wirdTo)}`}`}</b>
          <small>${i.done ? range : `الجزء ${num(juzOf(i.pos))} • قرأت ${num(i.read)} من ${num(i.total)} • بقي ${num(i.left)} ${i.left <= 10 && i.left > 2 ? 'أوراد' : 'ورداً'}`}</small>
        </span>
        <button class="icon-btn ghost sm" data-more aria-label="خيارات">${icon('more', 20)}</button>
      </div>
      <div class="kh-bar"><i style="width:${(i.read / i.total) * 100}%"></i></div>
      <p class="kh-plan">${range} • ${wirdWord(i)} ${weekWord(i.week)}${k.remind ? ` • ${icon('bell', 13)} ${num(k.remind)}` : ''}</p>
      ${
        i.done
          ? `<button class="btn primary wide" data-again>${icon('reset', 20)} ابدأها من جديد</button>`
          : `<div class="kh-btns"><button class="btn primary" data-wird>${icon('check', 20)} أتممت ورد اليوم</button><button class="btn ghost" data-mark>${icon('bookmark', 20)} وين وصلت</button></div>`
      }
    </section>`;
  };

  const draw = () => {
    view.innerHTML = `
      ${pageHeader('ختماتي', { back: '#/home' })}
      ${state.khatmas.map(card).join('') || `<div class="empty"><div class="empty-art">${icon('quran', 44)}</div><b>لا ختمات</b><p>أنشئ ختمة بنطاقها ومدتها، وسجّل كل يوم وردك.</p></div>`}
      <button class="btn ghost wide" data-new>${icon('plus', 20)} إنشاء ختمة</button>
      ${
        state.khatmaLog.length
          ? `<section class="group kh-log"><h4>سجلّ الختمات</h4>
          ${[...state.khatmaLog]
            .reverse()
            .map((h) => `<div class="row"><span class="row-icon">${icon(h.done ?? h.pages >= PAGES ? 'check' : 'quran', 20)}</span><span class="row-label">${esc(h.name || 'ختمة')}<small>${h.start ? `${dateOf(h.start)} – ` : ''}${dateOf(h.end)}</small></span><span class="row-value">${h.done ?? h.pages >= PAGES ? 'تامة' : `${num(h.pages)} صفحة`}</span></div>`)
            .join('')}</section>`
          : ''
      }
      <p class="hint center">ما تسجّله من الصفحات يُضاف إلى ورد التلاوة في متابعة اليوم.</p>`;
  };

  // Reading up to `page`: moves the place, and counts the pages in today's wird.
  const reach = (k, page) => {
    const i = khatmaInfo(k);
    const added = Math.max(0, page - i.pos + 1);
    if (!k.startedAt) k.startedAt = Date.now();
    k.pos = page + 1;
    k.read = Math.max(k.read || 0, page);
    if (added) {
      const day = (state.worship[dayKey(today().day)] ??= {});
      day.quran = Math.min(999, (day.quran || 0) + added);
    }
    save();
    draw();
    haptic(30);
    toast(khatmaInfo(k).done ? `${icon('check', 18)} أتممت الختمة، تقبّل الله منك` : `${icon('check', 18)} سُجّلت صفحة ${num(page)}${added ? ` • ${num(added)} في ورد اليوم` : ''}`);
  };

  // The last page read, picked by hand.
  const mark = (k) => {
    const i = khatmaInfo(k);
    let page = i.pos;
    const clamp = (p) => Math.min(i.to, Math.max(i.from, p));
    openSheet(
      `<p class="sheet-sub">آخر صفحة قريتها في «${esc(k.name)}»</p>
       <div class="kh-pick">
         <button class="icon-btn" data-d="-1" aria-label="أقل">${icon('minus', 22)}</button>
         <b data-page></b>
         <button class="icon-btn" data-d="1" aria-label="أكثر">${icon('plus', 22)}</button>
       </div>
       <input class="kh-range" type="range" min="${i.from}" max="${i.to}" step="1" value="${page}" data-range>
       <div class="sheet-actions"><button class="btn primary" data-ok>سجّل</button></div>`,
      (el, close) => {
        const show = () => {
          el.querySelector('[data-page]').textContent = `صفحة ${num(page)} • الجزء ${num(juzOf(page))}`;
          el.querySelector('[data-range]').value = page;
        };
        show();
        el.addEventListener('click', (e) => {
          const d = e.target.closest('[data-d]');
          if (d) {
            page = clamp(page + Number(d.dataset.d));
            haptic();
            return show();
          }
          if (!e.target.closest('[data-ok]')) return;
          close();
          reach(k, page);
        });
        el.addEventListener('input', (e) => {
          if (!e.target.matches('[data-range]')) return;
          page = Number(e.target.value);
          show();
        });
      },
      { title: 'وين وصلت؟' }
    );
  };

  // Ends a khatma into the log (if anything was read) and starts it over.
  const restart = (k) => {
    const i = khatmaInfo(k);
    if (i.read > 0) state.khatmaLog.push({ name: k.name, start: k.startedAt, end: Date.now(), pages: i.read, done: i.done });
    Object.assign(k, { pos: i.from, read: i.from - 1, startedAt: 0 });
    save();
    draw();
  };

  // Making a khatma, or changing one: its mark, name, range, days, weekdays and reminder.
  const edit = (k) => {
    const h = hijri(today().day, state.settings.hijriAdjust);
    const f = k
      ? { color: k.color || 'blue', name: k.name, mode: 'page', from: khatmaInfo(k).from, to: khatmaInfo(k).to, span: khatmaInfo(k).span, week: [...khatmaInfo(k).week], remind: k.remind || '', remindOn: !!k.remind }
      : { color: 'teal', name: `ختمتي - ${num(h.day)} ${HIJRI_MONTHS[h.month - 1]}`, mode: 'juz', from: 1, to: PAGES, span: 30, week: [...ALL_WEEK], remind: '18:30', remindOn: false };
    // The range in each mode's own units, kept in step with the pages.
    const juzRange = () => [juzOf(f.from), juzOf(f.to)];
    const suraOf = (p, end) => {
      let s = 0;
      if (end) while (s < 113 && SURAH_END[s] < p) s++;
      else while (s < 113 && SURAHS[s + 1][1] <= p) s++;
      return s + 1;
    };
    openSheet(
      `<form class="form kh-form" data-form></form>`,
      (el, close) => {
        const form = el.querySelector('form');
        const drawForm = () => {
          const total = f.to - f.from + 1;
          const plan = khatmaInfo({ from: f.from, to: f.to, span: f.span });
          const [ja, jb] = juzRange();
          form.innerHTML = `
            <div class="kh-colors" data-colors>
              ${Object.entries(KHATMA_COLORS).map(([id, c]) => `<button type="button" class="${f.color === id ? 'on' : ''}" data-c="${id}" style="--kc:${c}" aria-label="${id}">${icon(f.color === id ? 'bookmarkOn' : 'bookmark', 30)}</button>`).join('')}
            </div>
            <label class="field"><input name="name" maxlength="40" required value="${esc(f.name)}" aria-label="اسم الختمة"></label>
            <div class="field"><span>${icon('quran', 18)} نطاق الختمة</span>
              <div class="seg-mini wide" data-mode>
                ${[['juz', 'بالأجزاء'], ['page', 'بالصفحات'], ['sura', 'بالسور']].map(([m, l]) => `<button type="button" class="${f.mode === m ? 'on' : ''}" data-m="${m}">${l}</button>`).join('')}
              </div>
              ${
                f.mode === 'juz'
                  ? `<label class="kh-slide"><b>من: الجزء ${num(ja)}</b><input type="range" min="1" max="30" value="${ja}" data-juz="from"></label>
                     <label class="kh-slide"><b>إلى: الجزء ${num(jb)}</b><input type="range" min="1" max="30" value="${jb}" data-juz="to"></label>`
                  : f.mode === 'page'
                    ? `<div class="kh-two"><label>من صفحة<input type="number" inputmode="numeric" min="1" max="${PAGES}" value="${f.from}" data-page="from"></label>
                       <label>إلى صفحة<input type="number" inputmode="numeric" min="1" max="${PAGES}" value="${f.to}" data-page="to"></label></div>`
                    : `<div class="kh-two"><label>من سورة<select data-sura="from">${SURAHS.map((s, i) => `<option value="${i + 1}" ${suraOf(f.from) === i + 1 ? 'selected' : ''}>${num(i + 1)}. ${s[0]}</option>`).join('')}</select></label>
                       <label>إلى سورة<select data-sura="to">${SURAHS.map((s, i) => `<option value="${i + 1}" ${suraOf(f.to, true) === i + 1 ? 'selected' : ''}>${num(i + 1)}. ${s[0]}</option>`).join('')}</select></label></div>`
              }
              <small class="kh-sum">${pagesWord(total)}: من صفحة ${num(f.from)} إلى ${num(f.to)}</small>
            </div>
            <div class="row"><span class="row-icon">${icon('rows', 20)}</span><span class="row-label">المدة (الأيام)</span>
              <div class="stepper" data-span><button type="button" data-d="-1">−</button><b>${num(f.span)}</b><button type="button" data-d="1">+</button></div></div>
            <div class="row"><span class="row-icon">${icon('calendar', 20)}</span><span class="row-label">أيام القراءة<small>${weekWord(f.week)}</small></span></div>
            <div class="chips kh-week" data-week>${ALL_WEEK.map((d) => `<button type="button" class="chip-opt ${f.week.includes(d) ? 'on' : ''}" data-w="${d}">${WEEKDAYS[d].replace('ال', '')}</button>`).join('')}</div>
            <div class="row"><span class="row-icon">${icon('reset', 20)}</span><span class="row-label">كمية الوِرد (الجلسة)</span><span class="row-value kh-per">${wirdWord(plan)}</span></div>
            <div class="row"><span class="row-icon">${icon('bell', 20)}</span><span class="row-label">وقت التذكير</span>
              <input type="time" value="${f.remind}" data-remind ${f.remindOn ? '' : 'disabled'}>${toggle('remindOn', f.remindOn)}</div>
            <div class="sheet-actions"><button class="btn primary" type="submit">${k ? 'حفظ' : 'إنشاء'}</button></div>`;
        };
        const setRange = (from, to) => {
          f.from = Math.max(1, Math.min(PAGES, from));
          f.to = Math.max(f.from, Math.min(PAGES, to));
        };
        drawForm();
        form.addEventListener('click', (e) => {
          const c = e.target.closest('[data-c]');
          const m = e.target.closest('[data-m]');
          const sp = e.target.closest('[data-span] [data-d]');
          const w = e.target.closest('[data-w]');
          if (c) f.color = c.dataset.c;
          else if (m) {
            f.mode = m.dataset.m;
            // The range snaps to whole juz or whole surahs when counted in them.
            if (f.mode === 'juz') setRange(JUZ[juzOf(f.from) - 1], (JUZ[juzOf(f.to)] || PAGES + 1) - 1);
            if (f.mode === 'sura') setRange(SURAHS[suraOf(f.from) - 1][1], SURAH_END[suraOf(f.to, true) - 1]);
          } else if (sp) f.span = Math.max(1, Math.min(730, f.span + Number(sp.dataset.d)));
          else if (w) {
            const d = Number(w.dataset.w);
            f.week = f.week.includes(d) ? f.week.filter((x) => x !== d) : [...f.week, d].sort();
            if (!f.week.length) f.week = [d];
          } else return;
          drawForm();
        });
        form.addEventListener('input', (e) => {
          const t = e.target;
          if (t.name === 'name') f.name = t.value;
          else if (t.matches('[data-remind]')) f.remind = t.value;
          else if (t.dataset.juz) {
            let [a, b] = juzRange();
            if (t.dataset.juz === 'from') a = Number(t.value), (b = Math.max(a, b));
            else b = Number(t.value), (a = Math.min(a, b));
            setRange(JUZ[a - 1], (JUZ[b] || PAGES + 1) - 1);
            // As in the mushaf: a juz a day.
            f.span = b - a + 1;
            drawForm();
            form.querySelector(`[data-juz=${t.dataset.juz}]`).focus();
          }
        });
        form.addEventListener('change', (e) => {
          const t = e.target;
          if (t.name === 'remindOn') {
            f.remindOn = t.checked;
            if (f.remindOn) askPermission();
          } else if (t.dataset.page) {
            const v = Math.round(Number(t.value) || 1);
            t.dataset.page === 'from' ? setRange(v, Math.max(v, f.to)) : setRange(Math.min(f.from, v), v);
          } else if (t.dataset.sura) {
            let [a, b] = [suraOf(f.from), suraOf(f.to, true)];
            if (t.dataset.sura === 'from') a = Number(t.value), (b = Math.max(a, b));
            else b = Number(t.value), (a = Math.min(a, b));
            setRange(SURAHS[a - 1][1], SURAH_END[b - 1]);
          } else return;
          drawForm();
        });
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const name = f.name.trim();
          if (!name) return;
          const data = { name, color: f.color, from: f.from, to: f.to, span: f.span, week: f.week, remind: f.remindOn && /^\d\d:\d\d$/.test(f.remind) ? f.remind : '' };
          if (k) {
            Object.assign(k, data);
            // A changed range keeps the place where it still falls inside it.
            k.pos = Math.max(f.from, Math.min(f.to + 1, k.pos || f.from));
            k.read = Math.max(f.from - 1, Math.min(f.to, k.read || 0));
          } else state.khatmas.push((k = { id: uid(), ...data, pos: f.from, read: f.from - 1, startedAt: 0 }));
          // A reminder whose time has passed today starts tomorrow, not at once.
          const c = hoursAt();
          if (data.remind && data.remind <= `${String(c.h).padStart(2, '0')}:${String(c.m).padStart(2, '0')}`) state.notifyLog[`${today().key}:kh-${k.id}-${data.remind}`] = Date.now();
          save();
          close();
          draw();
          toast(`${icon('check', 18)} ${k ? 'حُفظت الختمة' : 'أُنشئت الختمة'}`);
        });
      },
      { title: k ? 'تعديل الختمة' : 'إنشاء ختمة' }
    );
  };

  const menu = (k) => {
    openSheet(
      `<div class="menu">
         <button data-a="edit">${icon('edit', 20)} تعديل الختمة<small>الاسم والنطاق والمدة والتذكير</small></button>
         <button data-a="juz">${icon('reset', 20)} ابدأ من أول الجزء<small>إذا انقطع خيطك – وتقدّمك ما ينقص</small></button>
         <button data-a="again">${icon('reset', 20)} ابدأها من جديد<small>والحالية تُحفظ في السجل</small></button>
         <button class="danger" data-a="del">${icon('trash', 20)} حذف الختمة</button>
       </div>`,
      (el, close) =>
        el.addEventListener('click', async (e) => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (!a) return;
          close();
          const i = khatmaInfo(k);
          if (a === 'edit') return edit(k);
          if (a === 'juz') {
            k.pos = Math.max(i.from, JUZ[juzOf(i.pos) - 1]);
            save();
            draw();
            return toast(`${icon('check', 18)} تبدأ من صفحة ${num(k.pos)}، الجزء ${num(juzOf(k.pos))}`);
          }
          if (a === 'again') {
            if (i.read > 0 && !i.done && !(await confirmSheet('تبدأ هذه الختمة من أولها؟ ما قرأته يُحفظ في السجل.', { ok: 'ابدأ من جديد', danger: false }))) return;
            return restart(k);
          }
          if (a === 'del' && (await confirmSheet(`حذف «${k.name}»؟`))) {
            state.khatmas = state.khatmas.filter((x) => x !== k);
            save();
            draw();
          }
        }),
      { title: k.name }
    );
  };

  draw();
  view.onclick = (e) => {
    if (e.target.closest('[data-new]')) return edit(null);
    const k = find(e.target.closest('[data-k]')?.dataset.k);
    if (!k) return;
    if (e.target.closest('[data-wird]')) return reach(k, khatmaInfo(k).wirdTo);
    if (e.target.closest('[data-mark]')) return mark(k);
    if (e.target.closest('[data-again]')) return restart(k);
    if (e.target.closest('[data-more]')) menu(k);
  };
  return { destroy: () => (view.onclick = null) };
}
