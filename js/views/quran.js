// Quran: the khatma tracker, the ruqyah (Uthmani script) and the live Quran radio.

import { GREG_MONTHS, hijriText, num, WEEKDAYS } from '../dates.js';
import { icon } from '../icons.js';
import { AHZAB, dailyPages, endDay, hizbIndex, paceDiff, PLANS, readTo, startPlan, todayPortion } from '../khatma.js';
import { addDays, dayKey } from '../prayer.js';
import { JUZ, PAGES, pageInfo, SURAHS } from '../quran-data.js';
import { onRadio, play, radioStatus, STATIONS, stationById, stop, toggle } from '../radio.js';
import { BASMALA, RUQYAH_DUAS, RUQYAH_VERSES } from '../ruqyah-data.js';
import { syncSchedule } from '../push.js';
import { isSaved, save, state, toggleSaved, uid } from '../store.js';
import { today } from '../today.js';
import { $, confirmSheet, copyText, esc, haptic, openSheet, pageHeader, ring, segmented, shareText, toast } from '../ui.js';

export const QURAN_TABS = [
  ['#/quran', 'الختمة'],
  ['#/hifz', 'الحفظ'],
  ['#/ruqyah', 'الرقية'],
  ['#/radio', 'الإذاعة'],
];
const TABS = QURAN_TABS;

const dayLabel = (d) => `${WEEKDAYS[new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay()]} ${num(d.d)} ${GREG_MONTHS[d.m - 1]}`;
const pagesWord = (n) => (n === 1 ? 'صفحة' : n === 2 ? 'صفحتان' : n <= 10 ? 'صفحات' : 'صفحة');

// ---- Khatma ----

export function renderKhatma(view) {
  const k = state.khatma;

  const draw = () => {
    const t = today();
    const started = !!k.start;
    view.innerHTML = `
      ${pageHeader('القرآن الكريم', { sub: 'ختمتك، وحفظك، والرقية، والإذاعة' })}
      ${segmented(TABS, '#/quran')}
      ${started ? khatmaBody(t) : khatmaStart()}`;
  };

  const khatmaStart = () => `
    <section class="card khatma-intro">
      <div class="khatma-art">${icon('book', 40)}</div>
      <h2>ابدأ ختمتك</h2>
      <p>اختر في كم يوم تريد أن تختم، وأين وصلت الآن، ويحسب لك التطبيق وردك اليومي ويذكّرك به.</p>
    </section>
    <div class="group">
      <h4>كيف تريد الختمة؟</h4>
      ${planChips()}
      <h4>أين وصلت؟</h4>
      <button class="row" data-pos><span class="row-icon">${icon('bookmark', 20)}</span><span class="row-label">${k.page ? `بعد صفحة ${num(k.page)} — ${pageInfo(k.page).surahName}` : 'من البداية (سورة الفاتحة)'}</span><span class="row-value">تغيير</span></button>
      <button class="btn primary wide" data-start>${icon('check', 20)} ابدأ الختمة</button>
    </div>`;

  const khatmaBody = (t) => {
    const p = todayPortion(k, t.day);
    const info = pageInfo(Math.max(1, k.page));
    // A hizb ends on the page where the next surah starts: name the surah just finished.
    const endedHizb = k.mode === 'sahaba' && AHZAB.find((h) => h.to === k.page && h.to < PAGES);
    if (endedHizb) info.surahName = SURAHS[endedHizb.last - 1][0];
    const pct = k.page / PAGES;
    const pace = paceDiff(k, t.day);
    const end = endDay(k);
    const finished = k.page >= PAGES;
    const week = Array.from({ length: 7 }, (_, i) => addDays(t.day, i - 6));
    const max = Math.max(1, ...week.map((d) => k.log[dayKey(d)] || 0));
    return `
      <section class="card khatma-progress">
        <div class="kp-ring">${ring(pct, 120, 10)}<span><b>${num(Math.floor(pct * 100))}٪</b><small>${num(k.page)} / ${num(PAGES)}</small></span></div>
        <div class="kp-info">
          <small>آخر ما قرأت</small>
          <b>${k.page ? `سورة ${esc(info.surahName)}` : 'لم تبدأ بعد'}</b>
          <span>${k.page ? `صفحة ${num(k.page)} • الجزء ${num(info.juz)}` : 'ابدأ من سورة الفاتحة'}</span>
          <button class="link" data-pos>${icon('edit', 14)} تعديل موضعي</button>
        </div>
      </section>

      ${
        finished
          ? `<section class="finish show">${icon('check', 28)}<b>أتممت الختمة</b><span>تقبّل الله منك. عدد ختماتك: ${num(k.done || 1)}</span>
              <button class="btn ghost on-dark" data-new>${icon('reset', 18)} ابدأ ختمة جديدة</button></section>`
          : `<section class="card wird ${p.done ? 'done' : ''}">
              <div class="card-head"><h2>${icon('book', 18)} ${p.hizb ? `حزب اليوم — الحزب ${num(p.hizb.n)}` : 'وردك اليوم'}</h2><span class="pill ${p.done ? '' : 'soft'}">${p.done ? 'تم بحمد الله' : `${num(p.size)} ${pagesWord(p.size)}`}</span></div>
              <div class="wird-range">
                <div><small>من</small><b>${p.hizb ? `سورة ${esc(SURAHS[p.hizb.first - 1][0])}` : `صفحة ${num(p.from)}`}</b><span>${p.hizb ? `صفحة ${num(p.from)}` : esc(p.fromInfo.surahName)}</span></div>
                <i>${icon('chevron', 22)}</i>
                <div><small>إلى آخر</small><b>${p.hizb ? `سورة ${esc(SURAHS[p.hizb.last - 1][0])}` : `صفحة ${num(p.to)}`}</b><span>${p.hizb ? `صفحة ${num(p.to)}` : esc(p.toInfo.surahName)}</span></div>
              </div>
              <div class="bar light"><i style="width:${Math.min(100, (p.read / p.size) * 100)}%"></i></div>
              <p class="hint">قرأت اليوم ${num(p.read)} من ${num(p.size)} • ${pace > 0 ? `متقدّم عن خطتك ${num(pace)} ${pagesWord(pace)}` : pace < 0 ? `متأخر عن خطتك ${num(-pace)} ${pagesWord(-pace)}` : 'على خطتك تماماً'}</p>
              <div class="wird-actions">
                <button class="btn primary" data-wird ${p.done ? 'disabled' : ''}>${icon('check', 20)} ${p.hizb ? 'قرأت الحزب' : 'قرأت وردي'}</button>
                <button class="btn ghost" data-plus="1">+١ صفحة</button>
                <button class="btn ghost" data-plus="20">+جزء</button>
              </div>
            </section>`
      }

      <section class="card">
        <div class="card-head"><h2>${icon('calendar', 18)} خطتك</h2><span class="link">${sahaba() ? 'تحزيب الصحابة' : esc(PLANS.find((x) => x[0] === k.days)?.[1] || `${num(k.days)} يوماً`)}</span></div>
        ${sahaba() ? ahzabList(t) : ''}
        <p class="hint">تختم بإذن الله يوم ${dayLabel(end)} (${hijriText(end, state.settings.hijriAdjust)})، ${sahaba() ? 'بحزب كل يوم' : `بمعدل ${num(dailyPages(k, t.day))} ${pagesWord(dailyPages(k, t.day))} يومياً`}. الختمات المكتملة: ${num(k.done || 0)}.</p>
        <div class="week-bars">
          ${week
            .map((d) => {
              const n = k.log[dayKey(d)] || 0;
              return `<div><span style="height:${Math.round((n / max) * 100)}%"></span><small>${WEEKDAYS[new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay()].replace('ال', '').slice(0, 3)}</small><b>${n ? num(n) : ''}</b></div>`;
            })
            .join('')}
        </div>
      </section>

      <div class="group">
        <h4>كيف تريد الختمة؟ (يُعاد حساب الورد من موضعك الآن)</h4>
        ${planChips()}
        <div class="row"><span class="row-icon">${icon('bell', 20)}</span><span class="row-label">تذكير بالورد يومياً<small>${state.settings.notify.enabled ? 'من إعدادات الإشعارات' : 'فعّل الإشعارات أولاً'}</small></span>
          <a class="link" href="#/settings/notify">${state.settings.notify.khatma ? num(state.settings.notify.khatmaTime) : 'إعداد'}</a></div>
        <button class="row danger-row" data-new><span class="row-icon">${icon('reset', 20)}</span><span class="row-label">بدء ختمة جديدة من الفاتحة</span></button>
      </div>`;
  };

  const sahaba = () => k.mode === 'sahaba';
  // The seven ahzab with the day each falls on and whether it is read.
  const ahzabList = (t) => {
    const cur = hizbIndex(k, t.day);
    const start = (() => {
      const [y, m, d] = k.start.split('-').map(Number);
      return { y, m, d };
    })();
    return `<ol class="ahzab">${AHZAB.map((h, i) => {
      const day = addDays(start, i);
      const done = k.page >= h.to;
      return `<li class="${done ? 'done' : ''} ${i === cur ? 'today' : ''}">
        <span class="ahzab-n">${done ? icon('check', 16) : num(h.n)}</span>
        <div><b>${esc(h.name)}</b><small>${WEEKDAYS[new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()]} • ص ${num(h.from)}–${num(h.to)}</small></div>
        ${i === cur ? '<em>اليوم</em>' : ''}
      </li>`;
    }).join('')}</ol>
    <p class="hint">«فمي بشوق»: كان الصحابة يحزّبون القرآن سبعة أحزاب، ثلاث سور، وخمساً، وسبعاً، وتسعاً، وإحدى عشرة، وثلاث عشرة، وحزب المفصّل من «ق» إلى آخره. رواه أبو داود وابن ماجه عن أوس بن حذيفة.</p>`;
  };

  const planChips = () => `
    <div class="chips"><button class="chip-opt sahaba ${sahaba() ? 'on' : ''}" data-plan="sahaba">${icon('stars', 14)} تحزيب الصحابة (أسبوع)</button>
      ${PLANS.map(([d, l]) => `<button class="chip-opt ${!sahaba() && k.days === d ? 'on' : ''}" data-plan="${d}">${l}</button>`).join('')}
      <button class="chip-opt" data-plan-custom>${icon('edit', 14)} مدة أخرى</button></div>`;

  draw();

  view.onclick = async (e) => {
    const t = today();
    const plan = e.target.closest('[data-plan]');
    if (plan) {
      const mode = plan.dataset.plan === 'sahaba' ? 'sahaba' : 'pages';
      const days = mode === 'sahaba' ? 7 : Number(plan.dataset.plan);
      if (k.start) startPlan(days, k.page, t.day, mode);
      else Object.assign(k, { days, mode });
      save();
      syncSchedule();
      return draw();
    }
    if (e.target.closest('[data-plan-custom]')) return customPlan(draw);
    if (e.target.closest('[data-start]')) {
      startPlan(k.days, k.page, t.day, k.mode);
      save();
      syncSchedule();
      toast(`${icon('check', 18)} بدأت ختمتك، وفقك الله`);
      return draw();
    }
    if (e.target.closest('[data-pos]')) return pickPosition(draw);
    if (e.target.closest('[data-wird]')) {
      const p = todayPortion(k, t.day);
      return advance(p.to, draw);
    }
    const plus = e.target.closest('[data-plus]');
    if (plus) return advance(k.page + Number(plus.dataset.plus), draw);
    if (e.target.closest('[data-new]') && (await confirmSheet('بدء ختمة جديدة من سورة الفاتحة؟', { ok: 'ابدأ', danger: false }))) {
      startPlan(k.days, 0, t.day);
      save();
      syncSchedule();
      draw();
    }
  };
  return { destroy: () => (view.onclick = null) };
}

function advance(page, redraw) {
  const t = today();
  const finished = readTo(page, t.day);
  save();
  haptic(20);
  syncSchedule();
  if (finished) toast(`${icon('check', 18)} مبارك! أتممت ختمة القرآن الكريم`);
  else toast(`${icon('check', 18)} وصلت إلى صفحة ${num(state.khatma.page)}`);
  redraw();
}

function customPlan(redraw) {
  openSheet(
    `<form class="form">
       <label class="field"><span>أختم خلال (أيام)</span><input name="days" type="number" inputmode="numeric" min="1" max="1000" value="${state.khatma.days}"></label>
       <label class="field"><span>أو أقرأ كل يوم (صفحات)</span><input name="pages" type="number" inputmode="numeric" min="1" max="604" placeholder="مثال: ٤"></label>
       <div class="sheet-actions"><button class="btn primary" type="submit">اعتماد الخطة</button><button class="btn ghost" type="button" data-close>إلغاء</button></div>
     </form>`,
    (el, close) => {
      const form = el.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const k = state.khatma;
        const pages = parseInt(form.pages.value, 10);
        let days = parseInt(form.days.value, 10);
        if (pages > 0) days = Math.ceil((PAGES - k.page) / pages);
        if (!(days > 0)) return;
        days = Math.min(1000, days);
        if (k.start) startPlan(days, k.page, today().day);
        else k.days = days;
        save();
        syncSchedule();
        close();
        redraw();
      });
    },
    { title: 'مدة الختمة' }
  );
}

function pickPosition(redraw) {
  const k = state.khatma;
  openSheet(
    `<form class="form">
       <label class="field"><span>آخر صفحة قرأتها (١–٦٠٤)</span><input name="page" type="number" inputmode="numeric" min="0" max="${PAGES}" value="${k.page || ''}" placeholder="مثال: ٢٩٣"></label>
       <label class="field"><span>أو اختر السورة التي وصلت إليها</span>
         <select name="surah"><option value="">—</option>${SURAHS.map((s, i) => `<option value="${s[1] - 1}">${num(i + 1)}. ${esc(s[0])} (ص ${num(s[1])})</option>`).join('')}</select></label>
       <label class="field"><span>أو الجزء الذي بدأته</span>
         <select name="juz"><option value="">—</option>${JUZ.map((p, i) => `<option value="${p - 1}">الجزء ${num(i + 1)} (ص ${num(p)})</option>`).join('')}</select></label>
       <p class="hint">اختيار سورة أو جزء يعني أنك قرأت ما قبلها، ووردك يبدأ منها.</p>
       <div class="sheet-actions"><button class="btn primary" type="submit">حفظ موضعي</button><button class="btn ghost" type="button" data-close>إلغاء</button></div>
     </form>`,
    (el, close) => {
      const form = el.querySelector('form');
      form.surah.addEventListener('change', () => (form.page.value = form.surah.value));
      form.juz.addEventListener('change', () => (form.page.value = form.juz.value));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const page = Math.max(0, Math.min(PAGES, parseInt(form.page.value, 10) || 0));
        // A correction, not reading: today's portion starts afresh from here.
        k.page = page;
        if (k.start) delete k.log[dayKey(today().day)];
        save();
        syncSchedule();
        close();
        redraw();
      });
    },
    { title: 'أين وصلت في الختمة؟' }
  );
}

// ---- Ruqyah ----

export function renderRuqyah(view) {
  const scale = () => state.settings.quranScale || 1;
  view.innerHTML = `
    ${pageHeader('القرآن الكريم', {
      sub: 'آيات الرقية برسم المصحف',
      actions: `<button class="icon-btn ghost" data-zoom="-1" aria-label="تصغير الخط">${icon('minus', 22)}</button><button class="icon-btn ghost" data-zoom="1" aria-label="تكبير الخط">${icon('plus', 22)}</button>`,
    })}
    ${segmented(TABS, '#/ruqyah')}
    <div class="banner info">${icon('info', 22)}<div><b>الرقية الشرعية</b><span>اقرأ الآيات بنية الشفاء، وانفث على نفسك أو على المريض، أو على ماء ثم يُشرب منه. والقرآن شفاء لما في الصدور.</span></div></div>
    <section class="ruqyah-list" style="--qscale:${scale()}">
      ${RUQYAH_VERSES.map((v) => ruqCard(v)).join('')}
    </section>
    <h3 class="section-title">${icon('heart', 18)} من رقية النبي ﷺ</h3>
    <section class="dhikr-list" style="--scale:${state.settings.textScale}">
      ${RUQYAH_DUAS.map((d) => duaCard(d)).join('')}
    </section>`;

  view.onclick = (e) => {
    const z = e.target.closest('[data-zoom]');
    if (z) {
      state.settings.quranScale = Math.max(0.8, Math.min(1.8, Math.round((scale() + Number(z.dataset.zoom) * 0.1) * 10) / 10));
      save();
      $('.ruqyah-list', view).style.setProperty('--qscale', scale());
      return;
    }
    const card = e.target.closest('[data-ruq]');
    if (!card) return;
    const id = card.dataset.ruq;
    const v = RUQYAH_VERSES.find((x) => x.id === id);
    const d = RUQYAH_DUAS.find((x) => x.id === id);
    const item = v
      ? { id: `ruq-${v.id}`, title: v.title, text: (v.basmala ? BASMALA + '\n' : '') + v.text, ref: v.ref, quran: true, count: 1 }
      : { id: `ruq-${d.id}`, title: '', text: d.text, ref: d.ref, count: d.count };
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'copy') return copyText(item.text + (v ? ` ﴿${v.ref}﴾` : ''));
    if (a === 'share') return shareText(item.text + (v ? ` ﴿${v.ref}﴾` : ''));
    if (a === 'save') {
      const on = toggleSaved(item);
      e.target.closest('[data-act]').innerHTML = icon(on ? 'bookmarkOn' : 'bookmark', 20);
      return toast(on ? `${icon('bookmarkOn', 18)} حُفظ في دفتري` : 'أُزيل من دفتري');
    }
    if (a === 'mine') {
      if (state.custom.some((c) => c.text === item.text)) return toast('موجود في أذكاري');
      state.custom.push({ id: uid(), text: item.text, target: item.count, ref: v ? v.ref : item.ref, quran: !!v, reminder: '', today: 0, total: 0, created: Date.now() });
      save();
      toast(`${icon('check', 18)} أُضيف إلى أذكاري`);
    }
  };
  return { destroy: () => (view.onclick = null) };
}

const actions = (id) => `
  <div class="dhikr-actions">
    <button class="icon-btn ghost sm" data-act="mine" aria-label="أضف إلى أذكاري">${icon('beads', 20)}</button>
    <button class="icon-btn ghost sm" data-act="save" aria-label="حفظ في دفتري">${icon(isSaved(`ruq-${id}`) ? 'bookmarkOn' : 'bookmark', 20)}</button>
    <button class="icon-btn ghost sm" data-act="copy" aria-label="نسخ">${icon('copy', 20)}</button>
    <button class="icon-btn ghost sm" data-act="share" aria-label="مشاركة">${icon('share', 20)}</button>
  </div>`;

function ruqCard(v) {
  return `<article class="ruq" data-ruq="${v.id}">
    <header><h3>${esc(v.title)}</h3><span>${esc(v.ref)}</span></header>
    ${v.basmala ? `<p class="hafs basmala">${esc(BASMALA)}</p>` : ''}
    <p class="hafs">${esc(v.text)}</p>
    ${v.note ? `<p class="ruq-note">${esc(v.note)}</p>` : ''}
    <footer>${actions(v.id)}</footer>
  </article>`;
}

function duaCard(d) {
  return `<article class="dhikr" data-ruq="${d.id}">
    <div class="dhikr-text">${esc(d.text)}</div>
    <footer><div class="dhikr-meta"><span class="ref">${esc(d.ref)}${d.count > 1 ? ` • ${num(d.count)} مرات` : ''}</span>${actions(d.id)}</div></footer>
  </article>`;
}

// ---- Radio ----

// The two live Saudi stations share the big player; a switch picks which one it shows.
const LIVE = ['saudi', 'nidaa'];

export function renderRadio(view) {
  let hero = LIVE.includes(state.radio.station) ? state.radio.station : 'saudi';
  const draw = () => {
    const { status, station } = radioStatus();
    if (LIVE.includes(station?.id)) hero = station.id;
    const main = stationById(hero);
    const live = station && (status === 'playing' || status === 'loading');
    const heroOn = station?.id === hero;
    view.innerHTML = `
      ${pageHeader('القرآن الكريم', { sub: 'إذاعة القرآن الكريم ونداء الإسلام والبث المباشر' })}
      ${segmented(TABS, '#/radio')}
      <section class="radio-hero ${heroOn && live ? 'live' : ''}">
        <div class="radio-switch">${LIVE.map((id) => `<button class="${id === hero ? 'on' : ''}" data-hero="${id}">${esc(stationById(id).name.replace('إذاعة ', ''))}</button>`).join('')}</div>
        <div class="radio-art">${icon('radio', 46)}<span class="wave"><i></i><i></i><i></i><i></i></span></div>
        <b>${esc(main.name)}</b>
        <span>${esc(main.sub)}</span>
        <button class="radio-play" data-play="${hero}" aria-label="تشغيل">${icon(heroOn && live ? 'pause' : 'play', 34)}</button>
        <small class="radio-status">${statusText(heroOn ? status : 'stopped')}</small>
      </section>
      <div class="group list">
        <h4>محطات أخرى</h4>
        ${STATIONS.filter((s) => !LIVE.includes(s.id))
          .map((s) => {
            const on = station?.id === s.id;
            return `<button class="row station ${on ? 'on' : ''}" data-play="${s.id}">
              <span class="row-icon">${icon(on && live ? 'pause' : 'play', 18)}</span>
              <span class="row-label">${esc(s.name)}<small>${on ? statusText(status) : esc(s.sub)}</small></span></button>`;
          })
          .join('')}
        <button class="row station ${station?.id === 'custom' ? 'on' : ''}" data-custom>
          <span class="row-icon">${icon('plus', 18)}</span>
          <span class="row-label">رابط بث آخر<small>${state.radio.custom ? esc(state.radio.custom) : 'أضف رابط إذاعة تفضّلها'}</small></span></button>
      </div>
      ${station ? `<button class="btn ghost wide" data-stop>${icon('close', 18)} إيقاف البث</button>` : ''}
      <p class="hint center">يستمر البث وأنت تتنقل في التطبيق، وتظهر أزرار التحكم في شاشة القفل. يحتاج اتصالاً بالإنترنت.</p>`;
  };
  draw();
  const off = onRadio(draw);

  view.onclick = (e) => {
    const h = e.target.closest('[data-hero]');
    if (h) {
      const { status, station } = radioStatus();
      // Switching while one live station plays moves the playback to the other.
      if (LIVE.includes(station?.id) && station.id !== h.dataset.hero && (status === 'playing' || status === 'loading')) return play(h.dataset.hero);
      hero = h.dataset.hero;
      return draw();
    }
    const p = e.target.closest('[data-play]');
    if (p) {
      const { status, station } = radioStatus();
      if (station?.id === p.dataset.play && status !== 'error') toggle();
      else play(p.dataset.play);
      return;
    }
    if (e.target.closest('[data-stop]')) return stop();
    if (e.target.closest('[data-custom]')) {
      openSheet(
        `<form class="form"><label class="field"><span>رابط البث (https)</span><input name="url" type="url" dir="ltr" value="${esc(state.radio.custom)}" placeholder="https://…"></label>
         <div class="sheet-actions"><button class="btn primary" type="submit">تشغيل</button><button class="btn ghost" type="button" data-close>إلغاء</button></div></form>`,
        (el, close) => {
          const form = el.querySelector('form');
          form.addEventListener('submit', (ev) => {
            ev.preventDefault();
            const url = form.url.value.trim();
            if (!/^https:\/\//.test(url)) return toast('أدخل رابطاً يبدأ بـ https://');
            state.radio.custom = url;
            save();
            close();
            play('custom');
          });
        },
        { title: 'إذاعة أخرى' }
      );
    }
  };
  return {
    destroy() {
      off();
      view.onclick = null;
    },
  };
}

export function statusText(status) {
  return (
    {
      loading: 'جارٍ الاتصال بالبث…',
      playing: 'يُبث الآن',
      paused: 'متوقف مؤقتاً',
      error: 'تعذر تشغيل البث، تأكد من الإنترنت أو جرّب محطة أخرى',
    }[status] || 'اضغط للاستماع'
  );
}
