// Worship tracker: a daily checklist of prayers, voluntary prayers, Quran, adhkar and
// good deeds, with the last week at a glance and a streak for the five prayers.

import { hijriText, num, WEEKDAYS } from '../dates.js';
import { icon } from '../icons.js';
import { addDays, dayKey } from '../prayer.js';
import { save, state, uid } from '../store.js';
import { today } from '../today.js';
import { $, confirmSheet, esc, haptic, openSheet, pageHeader, ring, toast } from '../ui.js';

const FARD = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const FARD_NAMES = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };

// type: prayer (0 none / 1 prayed / 2 in congregation), check, or count (with a daily goal).
const GROUPS = [
  { title: 'الصلوات المفروضة', icon: 'mosque', items: FARD.map((id) => ({ id, name: FARD_NAMES[id], type: 'prayer' })) },
  {
    title: 'النوافل',
    icon: 'moonStar',
    items: [
      { id: 'fajrSunnah', name: 'ركعتا الفجر', type: 'check' },
      { id: 'rawatib', name: 'السنن الرواتب', type: 'count', goal: 12, step: 2, unit: 'ركعة' },
      { id: 'duha', name: 'صلاة الضحى', type: 'check' },
      { id: 'witr', name: 'صلاة الوتر', type: 'check' },
      { id: 'qiyam', name: 'قيام الليل', type: 'check' },
    ],
  },
  {
    title: 'القرآن',
    icon: 'book',
    items: [
      { id: 'quran', name: 'ورد القرآن', type: 'count', goal: 'quranGoal', step: 1, unit: 'صفحة' },
      { id: 'hifz', name: 'ورد الحفظ', type: 'check' },
      { id: 'review', name: 'ورد المراجعة', type: 'check' },
      { id: 'baqarah', name: 'سورة البقرة', type: 'check' },
      { id: 'mulk', name: 'سورة الملك', type: 'check' },
    ],
  },
  {
    title: 'الأذكار',
    icon: 'beads',
    items: [
      { id: 'morning', name: 'أذكار الصباح', type: 'check' },
      { id: 'evening', name: 'أذكار المساء', type: 'check' },
      { id: 'sleep', name: 'أذكار النوم', type: 'check' },
      { id: 'istighfar', name: 'الاستغفار مائة مرة', type: 'check' },
    ],
  },
  {
    title: 'أعمال صالحة',
    icon: 'heart',
    items: [
      { id: 'sadaqa', name: 'الصدقة', type: 'check' },
      { id: 'fast', name: 'الصيام', type: 'check' },
      { id: 'parents', name: 'بر الوالدين وصلة الرحم', type: 'check' },
      { id: 'learn', name: 'طلب العلم', type: 'check' },
    ],
  },
  {
    title: 'عاداتي اليومية',
    icon: 'sun',
    items: [
      { id: 'gym', name: 'التمارين / النادي', type: 'check' },
      { id: 'walk', name: 'المشي ٣٠ دقيقة', type: 'check' },
      { id: 'reading', name: 'القراءة ٣٠ دقيقة', type: 'check' },
      { id: 'puzzles', name: 'الألغاز والتمارين الذهنية', type: 'check' },
    ],
  },
];

const goalOf = (item) => (item.goal === 'quranGoal' ? state.settings.quranGoal || 5 : item.goal);

const record = (key) => (state.worship[key] ??= {});

const value = (item, key) => {
  return state.worship[key]?.[item.id] || 0;
};

const isDone = (item, key) => {
  const v = value(item, key);
  return item.type === 'count' ? v >= goalOf(item) : v > 0;
};

function allItems() {
  return [...GROUPS.flatMap((g) => g.items), ...state.worshipCustom.map((c) => ({ id: c.id, name: c.name, type: 'check' }))];
}

export function dayScore(key) {
  const items = allItems();
  const done = items.filter((x) => isDone(x, key)).length;
  return { done, total: items.length, fraction: items.length ? done / items.length : 0 };
}

// Days in a row (ending today, or yesterday if today is not finished yet) with all five prayers.
export function prayerStreak() {
  const t = today();
  const full = (key) => FARD.every((p) => (state.worship[key]?.[p] || 0) > 0);
  let day = t.day;
  if (!full(t.key)) day = addDays(day, -1);
  let n = 0;
  while (full(dayKey(day)) && n < 3660) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

// Cycles a prayer: not yet → prayed → in congregation → not yet.
export function cyclePrayer(key, id) {
  const r = record(key);
  r[id] = ((r[id] || 0) + 1) % 3;
  save();
  haptic();
  return r[id];
}

export const PRAYER_STATE = ['لم تُسجَّل', 'صليتها', 'في جماعة'];
export const prayerIcon = (v) => (v === 2 ? icon('mosque', 18) : v === 1 ? icon('check', 18) : '');

let selected = null; // dayKey shown in the tracker

export function render(view) {
  const t = today();
  if (!selected || selected > t.key) selected = t.key;

  const draw = () => {
    const keyDay = (k) => {
      const [y, m, d] = k.split('-').map(Number);
      return { y, m, d };
    };
    const sel = keyDay(selected);
    const week = Array.from({ length: 7 }, (_, i) => addDays(t.day, i - 6));
    const score = dayScore(selected);
    const streak = prayerStreak();
    const weekKeys = week.map(dayKey);
    const jamaah = weekKeys.reduce((s, k) => s + FARD.filter((p) => state.worship[k]?.[p] === 2).length, 0);
    const pages = weekKeys.reduce((s, k) => s + (state.worship[k]?.quran || 0), 0);
    const isToday = selected === t.key;

    view.innerHTML = `
      ${pageHeader('عباداتي', { sub: `${isToday ? 'اليوم' : WEEKDAYS[new Date(Date.UTC(sel.y, sel.m - 1, sel.d)).getUTCDay()]} • ${hijriText(sel, state.settings.hijriAdjust)}` })}
      <div class="week">
        ${week
          .map((d) => {
            const k = dayKey(d);
            const sc = dayScore(k);
            const wd = WEEKDAYS[new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay()].replace('ال', '');
            return `<button class="week-day ${k === selected ? 'on' : ''} ${k === t.key ? 'today' : ''}" data-day="${k}">
              <small>${wd}</small>
              <span class="week-ring">${ring(sc.fraction, 38, 4)}<b>${num(d.d)}</b></span>
            </button>`;
          })
          .join('')}
      </div>

      <section class="card score">
        <div class="score-ring">${ring(score.fraction, 92, 8)}<span><b>${num(Math.round(score.fraction * 100))}٪</b><small>${num(score.done)} من ${num(score.total)}</small></span></div>
        <div class="score-stats">
          <div><b>${num(streak)}</b><span>${streak === 1 ? 'يوم' : 'أيام'} متتالية على الصلوات الخمس</span></div>
          <div><b>${num(jamaah)}</b><span>صلاة في جماعة هذا الأسبوع</span></div>
          <div><b>${num(pages)}</b><span>صفحة من القرآن هذا الأسبوع</span></div>
        </div>
      </section>

      ${GROUPS.map((g) => group(g.title, g.icon, g.items)).join('')}
      ${group(
        'عباداتي الخاصة',
        'stars',
        state.worshipCustom.map((c) => ({ id: c.id, name: c.name, type: 'check', custom: true })),
        `<button class="btn ghost wide" data-add-habit>${icon('plus', 18)} أضف عبادة تتابعها</button>`
      )}
      <section class="card diary">
        <div class="card-head"><h2>${icon('edit', 18)} يومياتي</h2><small class="muted" data-diary-saved></small></div>
        <textarea data-diary rows="5" placeholder="اكتب خواطرك اليوم، ما تعلمته، وما تحمد الله عليه…">${esc(state.diary[selected] || '')}</textarea>
      </section>
      <p class="hint center">اضغط على الصلاة مرة لتسجيلها، ومرة ثانية إن صليتها في جماعة. سجلّك محفوظ على جهازك فقط.</p>`;
  };

  const group = (title, ic, items, extra = '') => `
    <section class="group track">
      <h4>${icon(ic, 16)} ${esc(title)}</h4>
      ${items.map((x) => trackRow(x)).join('')}
      ${extra}
    </section>`;

  const trackRow = (x) => {
    const v = value(x, selected);
    const done = isDone(x, selected);
    if (x.type === 'prayer') {
      return `<button class="track-row" data-prayer="${x.id}">
        <span class="row-label">${esc(x.name)}<small>${PRAYER_STATE[v]}</small></span>
        <span class="tick-box p${v}">${prayerIcon(v)}</span></button>`;
    }
    if (x.type === 'count') {
      const goal = goalOf(x);
      return `<div class="track-row">
        <span class="row-label">${esc(x.name)}<small>${num(v)} / ${num(goal)} ${x.unit}${x.id === 'quran' ? ' — <a href="#" data-goal>تغيير الهدف</a>' : ''}</small></span>
        <div class="stepper ${done ? 'done' : ''}" data-count="${x.id}" data-step="${x.step}"><button data-d="-1">−</button><b>${num(v)}</b><button data-d="1">+</button></div></div>`;
    }
    return `<button class="track-row" data-check="${x.id}">
      <span class="row-label">${esc(x.name)}</span>
      ${x.custom ? `<span class="icon-btn ghost sm" data-del="${x.id}" role="button" aria-label="حذف">${icon('trash', 17)}</span>` : ''}
      <span class="tick-box ${done ? 'p1' : ''}">${done ? icon('check', 18) : ''}</span></button>`;
  };

  draw();

  view.onclick = async (e) => {
    const day = e.target.closest('[data-day]');
    if (day) {
      selected = day.dataset.day;
      return draw();
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      if (await confirmSheet('حذف هذه العبادة من المتابعة؟')) {
        state.worshipCustom = state.worshipCustom.filter((c) => c.id !== del.dataset.del);
        save();
        draw();
      }
      return;
    }
    const p = e.target.closest('[data-prayer]');
    if (p) {
      cyclePrayer(selected, p.dataset.prayer);
      return draw();
    }
    const c = e.target.closest('[data-check]');
    if (c) {
      const item = allItems().find((x) => x.id === c.dataset.check);
      const r = record(selected);
      r[item.id] = r[item.id] ? 0 : 1;
      save();
      haptic();
      return draw();
    }
    const s = e.target.closest('[data-count] [data-d]');
    if (s) {
      const box = s.closest('[data-count]');
      const r = record(selected);
      const id = box.dataset.count;
      r[id] = Math.max(0, Math.min(999, (r[id] || 0) + Number(s.dataset.d) * Number(box.dataset.step)));
      save();
      haptic();
      return draw();
    }
    if (e.target.closest('[data-goal]')) {
      e.preventDefault();
      return quranGoal(draw);
    }
    if (e.target.closest('[data-add-habit]')) addHabit(draw);
  };
  let typing;
  view.oninput = (e) => {
    if (!e.target.matches('[data-diary]')) return;
    const text = e.target.value;
    clearTimeout(typing);
    typing = setTimeout(() => {
      if (text.trim()) state.diary[selected] = text;
      else delete state.diary[selected];
      save();
      const el = $('[data-diary-saved]', view);
      if (el) el.textContent = 'حُفظ';
    }, 400);
  };
  return {
    destroy() {
      view.onclick = view.oninput = null;
    },
  };
}

function quranGoal(redraw) {
  const goals = [1, 2, 5, 10, 20];
  openSheet(
    `<div class="chips centered">${goals.map((g) => `<button class="chip-opt ${state.settings.quranGoal === g ? 'on' : ''}" data-g="${g}">${num(g)} ${g === 1 ? 'صفحة' : g === 2 ? 'صفحتان' : g === 20 ? 'صفحة (جزء)' : 'صفحات'}</button>`).join('')}</div>
     <p class="hint center">ختمة كل شهر تقريباً = ٢٠ صفحة في اليوم.</p>`,
    (el, close) =>
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-g]');
        if (!b) return;
        state.settings.quranGoal = Number(b.dataset.g);
        save();
        close();
        redraw();
      }),
    { title: 'هدفك اليومي من القرآن' }
  );
}

function addHabit(redraw) {
  openSheet(
    `<form class="form">
       <label class="field"><span>اسم العبادة</span><input name="name" maxlength="40" required placeholder="مثال: سورة الملك، صلاة التراويح، زيارة مريض"></label>
       <div class="sheet-actions"><button class="btn primary" type="submit">إضافة</button><button class="btn ghost" type="button" data-close>إلغاء</button></div>
     </form>`,
    (el, close) => {
      const form = el.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.name.value.trim();
        if (!name) return;
        state.worshipCustom.push({ id: 'c' + uid(), name });
        save();
        close();
        redraw();
      });
      setTimeout(() => form.name.focus(), 300);
    },
    { title: 'عبادة جديدة' }
  );
}
