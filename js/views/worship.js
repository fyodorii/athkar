// «متابعة العبادات»: the five prayers, adhkar, Quran, voluntary prayers and good deeds of each
// day, with the week at a glance and statistics.

import { CATEGORY_BY_ID } from '../adhkar-data.js';
import { clock, hijri, num, WEEKDAYS } from '../dates.js';
import { icon, PRAYER_ICONS } from '../icons.js';
import { addDays, dayKey, PRAYER_NAMES } from '../prayer.js';
import { save, state, uid } from '../store.js';
import { PRAYERS, today } from '../today.js';
import { $, confirmSheet, esc, haptic, openSheet, pageHeader, ring, toast } from '../ui.js';

// type: check, or count (with a daily goal, or an open count with goal 0 that is done from
// the first one). `opens` is the time of the day before which the item cannot be ticked today.
const GROUPS = [
  {
    id: 'prayers',
    title: 'الصلوات',
    items: PRAYERS.map((k) => ({ id: `p-${k}`, name: PRAYER_NAMES[k], type: 'check', prayer: k, opens: k })),
  },
  {
    id: 'adhkar',
    title: 'الأذكار',
    items: [
      { id: 'morning', name: 'أذكار الصباح', type: 'check', auto: 'morning', icon: 'sunrise', opens: 'fajr', href: '#/adhkar/morning' },
      { id: 'evening', name: 'أذكار المساء', type: 'check', auto: 'evening', icon: 'sunset', opens: 'asr', href: '#/adhkar/evening' },
      { id: 'sleep', name: 'أذكار النوم', type: 'check', auto: 'sleep', icon: 'moon', opens: 'isha', href: '#/adhkar/sleep' },
      { id: 'istighfar', name: 'الاستغفار', type: 'count', goal: 0, step: 1, unit: 'مرة', open: true, icon: 'beads' },
    ],
  },
  {
    id: 'quran',
    title: 'القرآن الكريم',
    items: [
      { id: 'quran', name: 'قراءة القرآن', sub: 'ورد يومي من القرآن الكريم', type: 'count', goal: 'quranGoal', step: 1, unit: 'صفحة', icon: 'quran' },
      { id: 'mulk', name: 'سورة الملك', sub: 'قبل النوم', type: 'check', icon: 'book' },
    ],
  },
  {
    id: 'daily',
    title: 'عبادات يومية',
    items: [
      { id: 'duha', name: 'صلاة الضحى', sub: 'من ٢ إلى ٨ ركعات بعد ارتفاع الشمس', type: 'check', icon: 'sun', opens: 'duha' },
      { id: 'witr', name: 'صلاة الوتر', sub: 'بعد العشاء إلى الفجر', type: 'check', icon: 'moonStar', opens: 'isha' },
      { id: 'qiyam', name: 'قيام الليل', sub: 'وأفضله الثلث الأخير', type: 'check', icon: 'stars' },
    ],
  },
  {
    id: 'rawatib',
    title: 'سنن رواتب',
    link: ['#/rawatib', 'الجدول'],
    items: [
      { id: 'fajrSunnah', name: 'سنة الفجر', sub: 'ركعتان قبل صلاة الفجر', type: 'check', icon: 'kaaba', opens: 'fajr' },
      { id: 'sDhuhrB', name: 'سنة الظهر القبلية', sub: '٤ ركعات قبل صلاة الظهر', type: 'check', icon: 'kaaba', opens: 'dhuhr' },
      { id: 'sDhuhrA', name: 'سنة الظهر البعدية', sub: 'ركعتان بعد صلاة الظهر', type: 'check', icon: 'kaaba', opens: 'dhuhr' },
      { id: 'sMaghrib', name: 'سنة المغرب', sub: 'ركعتان بعد صلاة المغرب', type: 'check', icon: 'kaaba', opens: 'maghrib' },
      { id: 'sIsha', name: 'سنة العشاء', sub: 'ركعتان بعد صلاة العشاء', type: 'check', icon: 'kaaba', opens: 'isha' },
    ],
  },
  {
    id: 'deeds',
    title: 'أعمال صالحة',
    items: [
      { id: 'sadaqa', name: 'الصدقة', type: 'check', icon: 'gift' },
      { id: 'fast', name: 'الصيام', type: 'check', icon: 'leaf' },
      { id: 'parents', name: 'بر الوالدين وصلة الرحم', type: 'check', icon: 'heart' },
      { id: 'learn', name: 'طلب العلم', type: 'check', icon: 'book' },
    ],
  },
  {
    id: 'habits',
    title: 'عاداتي اليومية',
    items: [
      { id: 'gym', name: 'التمارين / النادي', type: 'check', icon: 'mountain' },
      { id: 'walk', name: 'المشي ٣٠ دقيقة', type: 'check', icon: 'stars' },
      { id: 'reading', name: 'القراءة ٣٠ دقيقة', type: 'check', icon: 'book' },
      { id: 'puzzles', name: 'الألغاز والتمارين الذهنية', type: 'check', icon: 'grid' },
      { id: 'qailulah', name: 'القيلولة', type: 'check', icon: 'moon' },
    ],
  },
];

const goalOf = (item) => (item.goal === 'quranGoal' ? state.settings.quranGoal || 5 : item.goal);

const record = (key) => (state.worship[key] ??= {});

// Morning, evening and sleep adhkar count as done once finished in their counter today.
function autoShare(item, key) {
  if (!item.auto || state.progress.day !== key) return 0;
  const c = state.progress.counts;
  const items = CATEGORY_BY_ID[item.auto].items;
  return items.filter((x) => (c[x.id] || 0) >= x.count).length / items.length;
}
const autoDone = (item, key) => autoShare(item, key) >= 1;

const value = (item, key) => {
  const v = state.worship[key]?.[item.id] || 0;
  return item.type === 'check' && !v && autoDone(item, key) ? 1 : v;
};

const isDone = (item, key) => {
  const v = value(item, key);
  return item.type === 'count' && goalOf(item) ? v >= goalOf(item) : v > 0;
};

const customItems = () => state.worshipCustom.map((c) => ({ id: c.id, name: c.name, type: 'check', custom: true, icon: 'stars' }));

function allItems() {
  return [...GROUPS.flatMap((g) => g.items), ...customItems()];
}

export function dayScore(key) {
  const items = allItems();
  const done = items.filter((x) => isDone(x, key)).length;
  return { done, total: items.length, fraction: items.length ? done / items.length : 0 };
}

const keyDay = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return { y, m, d };
};
const weekdayOf = (d) => WEEKDAYS[new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay()];
const pad = (n) => String(n).padStart(2, '0');

let selected = null; // dayKey shown in the tracker
let tab = 'track'; // track | stats
let statDays = 7;

export function render(view) {
  const t = today();
  if (!selected || selected > t.key) selected = t.key;

  // Today, what belongs to a later time of the day waits for it.
  const locked = (x) => selected === t.key && x.opens && Date.now() < t.times[x.opens].at;

  const dayCard = () => {
    const sel = keyDay(selected);
    const h = hijri(sel, state.settings.hijriAdjust);
    const week = Array.from({ length: 7 }, (_, i) => addDays(t.day, i - 6));
    const score = dayScore(selected);
    return `<section class="w-day">
      <div class="w-day-top">
        <div>
          <b>${weekdayOf(sel)}</b>
          <small>${icon('calendar', 15)} <span dir="ltr">${num(`${h.year}-${pad(h.month)}-${pad(h.day)}`)}</span> · <span dir="ltr">${num(`${sel.y}-${pad(sel.m)}-${pad(sel.d)}`)}</span></small>
        </div>
        <span class="w-day-ring">${ring(score.fraction, 64, 5)}<b>${num(Math.round(score.fraction * 100))}%</b></span>
      </div>
      <div class="w-week">
        ${week
          .map((d) => {
            const k = dayKey(d);
            return `<button class="${k === selected ? 'on' : ''}" data-day="${k}">
              <small>${weekdayOf(d).replace('ال', '')}</small>
              <span>${ring(dayScore(k).fraction, 26, 3)}</span>
              <b>${num(d.d)}</b>
            </button>`;
          })
          .join('')}
      </div>
    </section>`;
  };

  const head = (g, items) => {
    const done = items.filter((x) => isDone(x, selected)).length;
    return `<div class="w-head"><h2>${esc(g.title)}</h2>${g.link ? `<a class="link" href="${g.link[0]}">${g.link[1]}</a>` : ''}
      <span>${done === items.length && items.length ? icon('check', 18) : num(`${done}/${items.length}`)}</span></div>`;
  };

  const prayerCards = (g) => `${head(g, g.items)}
    <div class="w-prayers">
      ${g.items
        .map((x) => {
          const pt = (selected === t.key ? t.times : null)?.[x.prayer];
          const c = pt ? clock(pt.hours, state.settings.clock24) : null;
          const done = isDone(x, selected);
          const lock = locked(x);
          const now = selected === t.key && t.lastPrayer.key === x.prayer && t.lastPrayer.at === pt?.at;
          return `<button class="w-prayer ${done ? 'done' : ''} ${lock ? 'locked' : ''} ${now ? 'now' : ''}" data-check="${x.id}">
            <b>${x.name}</b>${icon(done ? 'check' : PRAYER_ICONS[x.prayer], 24)}<span>${c ? c.time : done ? 'صلّيت' : '—'}</span></button>`;
        })
        .join('')}
    </div>`;

  const itemRow = (x) => {
    const v = value(x, selected);
    const done = isDone(x, selected);
    const lock = locked(x) && !done;
    const ic = `<span class="w-ic ${done ? 'done' : ''}">${icon(x.icon || 'check', 24)}${done ? `<i>${icon('check', 11)}</i>` : ''}</span>`;
    if (x.open) {
      return `<div class="w-item">${ic}
        <span class="w-text"><b>${esc(x.name)}</b><small>عدد مفتوح — ${timesText(v)} • <a href="#" data-enter="${x.id}">إدخال العدد</a></small></span>
        <div class="stepper ${done ? 'done' : ''}" data-count="${x.id}" data-step="${x.step}"><button data-d="-1">−</button><b data-enter="${x.id}">${num(v)}</b><button data-d="1">+</button></div></div>`;
    }
    if (x.type === 'count') {
      const goal = goalOf(x);
      return `<div class="w-item">${ic}
        <span class="w-text"><b>${esc(x.name)}</b><small>${num(v)} / ${num(goal)} ${x.unit}${x.id === 'quran' ? ' — <a href="#" data-goal>الهدف</a> • <a href="#/khatma">ختمتي</a>' : ''}</small></span>
        <div class="stepper ${done ? 'done' : ''}" data-count="${x.id}" data-step="${x.step}"><button data-d="-1">−</button><b>${num(v)}</b><button data-d="1">+</button></div></div>`;
    }
    const share = x.auto ? Math.max(done ? 1 : 0, autoShare(x, selected)) : done ? 1 : 0;
    const end = lock
      ? `<span class="w-lock">${icon('lock', 16)}</span>`
      : x.auto
        ? `<span class="w-ring ${done ? 'done' : ''}">${ring(share, 44, 4)}<b>${num(Math.round(share * 100))}</b></span>`
        : x.custom
          ? `<span class="icon-btn ghost sm" data-del="${x.id}" role="button" aria-label="حذف">${icon('trash', 17)}</span><span class="tick-box ${done ? 'p1' : ''}">${done ? icon('check', 18) : ''}</span>`
          : `<span class="tick-box ${done ? 'p1' : ''}">${done ? icon('check', 18) : ''}</span>`;
    return `<button class="w-item ${lock ? 'locked' : ''} ${done ? 'done' : ''}" data-check="${x.id}">${ic}
      <span class="w-text"><b>${esc(x.name)}</b>${x.href && !done ? `<small><a href="${x.href}">اقرأها الآن</a></small>` : x.sub ? `<small>${esc(x.sub)}</small>` : ''}</span>${end}</button>`;
  };

  const section = (g, items = g.items, extra = '') =>
    g.id === 'prayers' ? prayerCards(g) : `${head(g, items)}<div class="w-list">${items.map(itemRow).join('')}${extra}</div>`;

  const track = () => `
    ${dayCard()}
    ${GROUPS.map((g) => section(g)).join('')}
    ${section({ id: 'custom', title: 'متابعاتي الخاصة' }, customItems(), `<button class="btn ghost wide" data-add-habit>${icon('plus', 18)} أضف عبادة تتابعها</button>`)}
    <section class="card diary">
      <div class="card-head"><h2>${icon('edit', 18)} يومياتي</h2><small class="muted" data-diary-saved></small></div>
      <textarea data-diary rows="5" placeholder="اكتب خواطرك اليوم، ما تعلمته، وما تحمد الله عليه…">${esc(state.diary[selected] || '')}</textarea>
    </section>
    <p class="hint center">اضغط على العبادة لتسجيلها. سجلّك محفوظ على جهازك فقط.</p>`;

  const stats = () => {
    const days = Array.from({ length: statDays }, (_, i) => addDays(t.day, i - statDays + 1));
    const keys = days.map(dayKey);
    const scores = keys.map((k) => dayScore(k).fraction);
    const avg = scores.reduce((a, b) => a + b, 0) / statDays;
    let streak = 0;
    for (let i = 0; i < 400; i++) {
      const k = dayKey(addDays(t.day, -i));
      if (dayScore(k).fraction >= 0.5) streak++;
      else if (i) break; // today may still be under way
    }
    const prayed = keys.reduce((n, k) => n + GROUPS[0].items.filter((x) => isDone(x, k)).length, 0);
    const pages = keys.reduce((n, k) => n + (state.worship[k]?.quran || 0), 0);
    const istighfar = keys.reduce((n, k) => n + (state.worship[k]?.istighfar || 0), 0);
    const share = (items) => (items.length ? keys.reduce((n, k) => n + items.filter((x) => isDone(x, k)).length, 0) / (items.length * statDays) : 0);
    const groups = [...GROUPS.map((g) => [g.title, share(g.items)]), ...(state.worshipCustom.length ? [['متابعاتي الخاصة', share(customItems())]] : [])];
    const best = allItems()
      .map((x) => [x.name, share([x])])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .filter((x) => x[1] > 0);
    const pct = (f) => `${num(Math.round(f * 100))}%`;
    return `
      <div class="chips centered" data-range>
        ${[7, 30, 90].map((n) => `<button class="chip-opt ${statDays === n ? 'on' : ''}" data-n="${n}">${num(n)} ${n === 7 ? 'أيام' : 'يوماً'}</button>`).join('')}
      </div>
      <section class="w-tiles">
        <div class="card"><small>متوسط الإنجاز</small><b>${pct(avg)}</b></div>
        <div class="card"><small>أيام متتالية</small><b>${num(streak)}</b><small>بنصف المتابعة أو أكثر</small></div>
        <div class="card"><small>الصلوات المسجّلة</small><b>${num(prayed)}<i>/${num(statDays * 5)}</i></b></div>
        <div class="card"><small>صفحات القرآن</small><b>${num(pages)}</b></div>
        <div class="card"><small>الاستغفار</small><b>${num(istighfar)}</b></div>
        <div class="card"><small>أيام مكتملة</small><b>${num(scores.filter((f) => f >= 1).length)}</b></div>
      </section>
      <section class="card">
        <div class="card-head"><h2>${icon('rows', 18)} الإنجاز اليومي</h2><small class="muted">آخر ${num(statDays)} ${statDays === 7 ? 'أيام' : 'يوماً'}</small></div>
        <div class="w-chart n${statDays}">
          ${days.map((d, i) => `<span title="${pct(scores[i])}"><i style="height:${Math.max(3, scores[i] * 100)}%"></i>${statDays === 7 ? `<small>${weekdayOf(d).replace('ال', '')}</small>` : ''}</span>`).join('')}
        </div>
      </section>
      <section class="card">
        <div class="card-head"><h2>${icon('widget', 18)} حسب القسم</h2></div>
        ${groups.map(([name, f]) => `<div class="w-meter"><span>${esc(name)}</span><b>${pct(f)}</b><i><em style="width:${f * 100}%"></em></i></div>`).join('')}
      </section>
      ${
        best.length
          ? `<section class="card"><div class="card-head"><h2>${icon('stars', 18)} أكثر ما تحافظ عليه</h2></div>
          ${best.map(([name, f]) => `<div class="w-meter"><span>${esc(name)}</span><b>${pct(f)}</b><i><em style="width:${f * 100}%"></em></i></div>`).join('')}</section>`
          : '<p class="hint center">سجّل عباداتك أياماً لتظهر إحصائياتك هنا.</p>'
      }`;
  };

  const draw = () => {
    view.innerHTML = `
      ${pageHeader('متابعة العبادات', {
        actions: `<a class="icon-btn" href="#/settings/notify" aria-label="التنبيهات">${icon('bell', 20)}</a><a class="icon-btn" href="#/settings" aria-label="الإعدادات">${icon('gear', 20)}</a>`,
      })}
      <div class="w-tabs" role="tablist">
        <button class="${tab === 'track' ? 'on' : ''}" data-seg="track" role="tab">المتابعة</button>
        <button class="${tab === 'stats' ? 'on' : ''}" data-seg="stats" role="tab">الإحصائيات</button>
      </div>
      ${tab === 'track' ? track() : stats()}`;
  };

  draw();

  view.onclick = async (e) => {
    const tb = e.target.closest('[data-seg]');
    if (tb) {
      tab = tb.dataset.seg;
      return draw();
    }
    const rg = e.target.closest('[data-range] [data-n]');
    if (rg) {
      statDays = Number(rg.dataset.n);
      return draw();
    }
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
    const en = e.target.closest('[data-enter]');
    if (en) {
      e.preventDefault();
      return enterCount(selected, en.dataset.enter, draw);
    }
    if (e.target.closest('[data-goal]')) {
      e.preventDefault();
      return quranGoal(draw);
    }
    if (e.target.closest('a[href]')) return; // a link inside a row
    const c = e.target.closest('[data-check]');
    if (c) {
      const item = allItems().find((x) => x.id === c.dataset.check);
      const r = record(selected);
      if (!r[item.id] && autoDone(item, selected)) return toast('سُجّلت تلقائياً لأنك أتممتها في عدّاد الأذكار');
      if (!r[item.id] && locked(item)) return toast(`${icon('lock', 18)} لم يدخل وقتها بعد`);
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
      const max = allItems().find((x) => x.id === id)?.open ? OPEN_MAX : 999;
      r[id] = Math.max(0, Math.min(max, (r[id] || 0) + Number(s.dataset.d) * Number(box.dataset.step)));
      save();
      haptic();
      return draw();
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

const OPEN_MAX = 1000000;
const timesText = (v) => (v === 0 ? 'لم تبدأ' : v === 1 ? 'مرة واحدة' : v === 2 ? 'مرتان' : v <= 10 ? `${num(v)} مرات` : `${num(v)} مرة`);

// Types the day's count of an open-count item (istighfar), or adds to it in big steps.
function enterCount(key, id, redraw) {
  const r = record(key);
  const adds = [10, 33, 100, 1000];
  openSheet(
    `<form class="form">
       <label class="field"><span>العدد</span><input name="n" type="number" inputmode="numeric" min="0" max="${OPEN_MAX}" value="${r[id] || 0}"></label>
       <div class="chips centered">${adds.map((n) => `<button type="button" class="chip-opt" data-add="${n}">+${num(n)}</button>`).join('')}</div>
       <div class="sheet-actions"><button class="btn primary" type="submit">حفظ</button><button class="btn ghost" type="button" data-close>إلغاء</button></div>
     </form>`,
    (el, close) => {
      const form = el.querySelector('form');
      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-add]');
        if (b) form.n.value = (Number(form.n.value) || 0) + Number(b.dataset.add);
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        r[id] = Math.max(0, Math.min(OPEN_MAX, Math.round(Number(form.n.value) || 0)));
        save();
        close();
        redraw();
      });
    },
    { title: 'الاستغفار — عدد مفتوح' }
  );
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
