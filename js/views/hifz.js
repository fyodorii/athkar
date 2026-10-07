// «ورد الحفظ»: the memorization plan of two faces a day, with today's tasks to tick,
// yesterday's repetition, the linking and the revision, and the plan's steps.

import { num } from '../dates.js';
import { advanceIfDone, dayTasks, facesDone, hifzDay, HIFZ_DAYS, HIFZ_STEPS, isChecked, partDone, surahsIn, toggleTask } from '../hifz.js';
import { icon } from '../icons.js';
import { PAGES } from '../quran-data.js';
import { save, state } from '../store.js';
import { today } from '../today.js';
import { confirmSheet, esc, haptic, openSheet, pageHeader, ring, segmented, toast } from '../ui.js';
import { QURAN_TABS } from './quran.js';

const range = (a, b) => (a === b ? num(a) : `${num(a)}–${num(b)}`);
const TASK_ICONS = { listen: 'play', tafsir: 'book', record: 'quote', repeat: 'reset', yesterday: 'calendar', link: 'quran', review: 'bookmark' };

export function renderHifz(view) {
  const h = state.hifz;

  const draw = () => {
    const t = today();
    if (h.on && advanceIfDone(t.key)) save();
    view.innerHTML = `
      ${pageHeader('القرآن الكريم', { sub: 'ختمتك، وحفظك، والرقية، والإذاعة' })}
      ${segmented(QURAN_TABS, '#/hifz')}
      ${h.on ? body() : intro()}
      ${stepsCard()}`;
  };

  const intro = () => `
    <section class="card khatma-intro">
      <div class="khatma-art">${icon('quran', 40)}</div>
      <h2>منهاج الحفظ — وجهان يومياً</h2>
      <p>${num(300)} يوم لحفظ المصحف كاملاً بوجهين جديدين كل يوم، ثم ${num(20)} يوماً للتثبيت. ومعه كل يوم: تكرار الأمس، والربط، والمراجعة التي تُختم كل ستة أيام.</p>
    </section>
    <div class="group">
      <button class="btn primary wide" data-begin="1">${icon('check', 20)} ابدأ من أول المصحف (اليوم ١)</button>
      <button class="btn ghost wide" data-pick-day>${icon('calendar', 20)} بدأت من قبل — اختر يومك في الخطة</button>
    </div>`;

  const body = () => {
    const d = h.day;
    const e = hifzDay(d);
    const tasks = dayTasks(d, num);
    const allDone = partDone(d);
    const faces = facesDone();
    const pct = d / HIFZ_DAYS;
    const surahs = e.from ? surahsIn(e.from, e.to) : [];
    const card = (cls, ic, title, main, badge, sub) => `
      <div class="hz-card ${cls}"><div class="hz-head">${icon(ic, 16)} ${title}</div><b>${main}</b>${badge ? `<span class="hz-badge">${badge}</span>` : ''}<small>${sub}</small></div>`;
    return `
      <section class="card khatma-progress">
        <div class="kp-ring">${ring(pct, 120, 10)}<span><b>${num(d)}</b><small>من ${num(HIFZ_DAYS)} يوماً</small></span></div>
        <div class="kp-info">
          <small>${e.from ? 'مرحلة الحفظ' : 'مرحلة التثبيت والمراجعة'}${e.review ? ` • الجولة ${num(e.review.round)}` : ''}</small>
          <b>${e.from ? `سورة ${esc(surahs.join('، '))}` : 'لا حفظ جديد — تثبيت'}</b>
          <span>${num(faces)} وجهاً محفوظاً من ${num(PAGES)}</span>
          <div class="hz-nav">
            <button class="icon-btn ghost sm flip" data-day-step="-1" aria-label="اليوم السابق" ${d <= 1 ? 'disabled' : ''}>${icon('chevron', 18)}</button>
            <button class="link" data-pick-day>${icon('edit', 14)} اليوم ${num(d)}</button>
            <button class="icon-btn ghost sm" data-day-step="1" aria-label="اليوم التالي" ${d >= HIFZ_DAYS ? 'disabled' : ''}>${icon('chevron', 18)}</button>
          </div>
        </div>
      </section>

      <div class="hz-grid">
        ${e.from ? card('new', 'stars', 'الحفظ الجديد', `الوجه ${range(e.from, e.to)}`, 'جديد', 'سماع • تفسير • تسجيل • تكرار') : ''}
        ${e.yesterday ? card('yest', 'reset', 'تكرار الأمس', `الوجه ${range(e.yesterday.from, e.yesterday.to)}`, `×${num(5)}`, 'تثبيتاً لمحفوظ أمس') : ''}
        ${e.link ? card('link', 'quran', 'الربط', range(e.link.from, e.link.to), `×${num(1)}`, `${num(e.link.to - e.link.from + 1)} وجهاً — الأفضل في صلاة`) : ''}
        ${e.review ? card('rev', 'bookmark', 'المراجعة', range(e.review.from, e.review.to), `الجولة ${num(e.review.round)}`, 'شريحة اليوم — تُختم كل ٦ أيام') : ''}
      </div>
      ${e.from ? `<a class="btn ghost wide" href="https://quran.com/ar/page/${e.from}" target="_blank" rel="noopener">${icon('book', 18)} افتح الوجه ${num(e.from)} في المصحف</a>` : ''}

      <div class="group">
        <h4>مهام اليوم ${num(d)}</h4>
        ${tasks
          .map((x) => {
            const on = isChecked(d, x.id);
            return `<button class="track-row" data-task="${x.id}">
              <span class="row-icon">${icon(TASK_ICONS[x.id], 18)}</span>
              <span class="row-label">${esc(x.label)}<small>${esc(x.detail)}</small></span>
              <span class="tick-box ${on ? 'p1' : ''}">${on ? icon('check', 18) : ''}</span></button>`;
          })
          .join('')}
      </div>
      ${
        allDone
          ? `<section class="finish show">${icon('check', 28)}<b>أتممت ورد اليوم ${num(d)}</b><span>تقبّل الله منك. ينتقل الورد إلى اليوم التالي غداً تلقائياً.</span>
              ${d < HIFZ_DAYS ? `<button class="btn ghost on-dark" data-day-step="1">${icon('chevron', 18)} انتقل الآن إلى اليوم ${num(d + 1)}</button>` : ''}</section>`
          : ''
      }
      ${upcoming(d)}
      <button class="btn ghost wide" data-stop-plan>${icon('reset', 18)} إيقاف الخطة ومسح التقدّم</button>`;
  };

  // The next few days of the plan at a glance.
  const upcoming = (d) => {
    const days = Array.from({ length: 6 }, (_, i) => d + 1 + i).filter((x) => x <= HIFZ_DAYS);
    if (!days.length) return '';
    return `<section class="card">
      <div class="card-head"><h2>${icon('calendar', 18)} الأيام القادمة</h2></div>
      <div class="hz-table">
        <div class="hz-tr head"><span>اليوم</span><span>الحفظ</span><span>الربط</span><span>المراجعة</span></div>
        ${days
          .map((x) => {
            const e = hifzDay(x);
            return `<div class="hz-tr"><span>${num(x)}</span><span>${e.from ? range(e.from, e.to) : '—'}</span><span>${e.link ? range(e.link.from, e.link.to) : '—'}</span><span>${e.review ? range(e.review.from, e.review.to) : '—'}</span></div>`;
          })
          .join('')}
      </div>
    </section>`;
  };

  const stepsCard = () => `
    <details class="card hz-steps">
      <summary>${icon('info', 18)} خطوات الحفظ وطريقة الخطة</summary>
      <p class="hz-ayah"><span class="hafs">وَلَقَدۡ يَسَّرۡنَا ٱلۡقُرۡءَانَ لِلذِّكۡرِ فَهَلۡ مِن مُّدَّكِرٖ ١٧</span><small>القمر</small></p>
      <ol class="hz-step-list">
        ${HIFZ_STEPS.map(([title, text]) => (title === '!' ? `<li class="note"><p>${text}</p></li>` : `<li><b>${esc(title)}</b><p>${text}</p></li>`)).join('')}
      </ol>
      <p><b>اليوم الثاني فما بعده:</b> تكرّر وجهي الأمس خمس مرات «تكرار الأمس»، ثم تحفظ وجهي اليوم بالطريقة نفسها.</p>
      <p><b>الربط:</b> من اليوم الثالث تقرأ ما حفظته قبل الأمس مرة واحدة، والأفضل في صلاة.</p>
      <p><b>المراجعة:</b> إذا بلغ الربط ستين وجهاً أُسقط أقدم اثني عشر وجهاً منه إلى «المراجعة» التي تُختم كل ستة أيام، فلا يقل الربط عن خمسين وجهاً ولا يزيد على ستين.</p>
    </details>`;

  draw();

  // `jump`: a new starting point (the furthest day becomes this one); the arrows only browse.
  const setDay = (d, jump = false) => {
    h.day = Math.max(1, Math.min(HIFZ_DAYS, d));
    h.max = jump ? h.day : Math.max(h.max || 1, h.day);
    h.on = true;
    save();
    draw();
  };

  view.onclick = async (e) => {
    const b = e.target.closest('[data-begin]');
    if (b) return setDay(Number(b.dataset.begin), true);
    const step = e.target.closest('[data-day-step]');
    if (step) return setDay(h.day + Number(step.dataset.dayStep));
    if (e.target.closest('[data-pick-day]')) return pickDay((d) => setDay(d, true));
    const task = e.target.closest('[data-task]');
    if (task) {
      const before = partDone(h.day);
      toggleTask(h.day, task.dataset.task, today().key);
      save();
      haptic();
      if (!before && partDone(h.day)) {
        haptic(40);
        toast(`${icon('check', 18)} أتممت ورد اليوم ${num(h.day)}`);
      }
      return draw();
    }
    if (e.target.closest('[data-stop-plan]')) {
      if (await confirmSheet('إيقاف خطة الحفظ ومسح ما علّمته من مهام؟', { ok: 'إيقاف ومسح' })) {
        Object.assign(h, { on: false, day: 1, checks: {} });
        save();
        draw();
      }
    }
  };
  return {
    tick() {
      // A finished day moves on after midnight while the page stays open.
      if (h.on && advanceIfDone(today().key)) {
        save();
        draw();
      }
    },
    destroy() {
      view.onclick = null;
    },
  };
}

// Choose the plan day directly, or by the face (page) reached in memorization.
function pickDay(onPick) {
  openSheet(
    `<form class="form">
       <label class="field"><span>يومك في الخطة (١–${num(HIFZ_DAYS)})</span><input name="day" type="number" inputmode="numeric" min="1" max="${HIFZ_DAYS}" value="${state.hifz.day}"></label>
       <p class="hint center">أو</p>
       <label class="field"><span>آخر وجه حفظته (١–${num(PAGES)})</span><input name="face" type="number" inputmode="numeric" min="0" max="${PAGES}" placeholder="مثال: ٤٠"></label>
       <div class="sheet-actions"><button class="btn primary" type="submit">حفظ</button><button class="btn ghost" type="button" data-close>إلغاء</button></div>
     </form>`,
    (el, close) => {
      const form = el.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const face = Number(form.face.value);
        // After face F, start on the day that memorizes face F+1.
        let day = Number(form.day.value) || 1;
        if (face > 0) {
          day = 1;
          while (day < HIFZ_DAYS && (hifzDay(day).to ?? PAGES + 1) <= face) day++;
        }
        close();
        onPick(day);
      });
    },
    { title: 'اختر يومك في خطة الحفظ' }
  );
}
