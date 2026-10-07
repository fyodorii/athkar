// Tools: the qailulah (midday nap) calculator, the Japanese interval walk and the
// ten-minute rule, each with a timer that keeps going across the app (timers.js).

import { clockText, num } from '../dates.js';
import { icon } from '../icons.js';
import {
  pauseFocus,
  pauseWalk,
  resetFocus,
  resetWalk,
  resumeFocus,
  startFocus,
  startNap,
  startWalk,
  stopNap,
  WALK,
  walkState,
} from '../timers.js';
import { QAILULAH_BEFORE, QAILULAH_BRIDGE, QAILULAH_GRADES, QAILULAH_MIDDAY, QAILULAH_SCIENCE } from '../qailulah-data.js';
import { save, state } from '../store.js';
import { today } from '../today.js';
import { $, esc, pageHeader, ring } from '../ui.js';

const tools = () => state.tools;
const mmss = (sec) => num(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

function duration(min) {
  const m = Math.round(min);
  const h = Math.floor(m / 60);
  const r = m % 60;
  const part = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${num(n)} ${few}` : `${num(n)} ${many}`);
  const out = [];
  if (h) out.push(part(h, 'ساعة', 'ساعتان', 'ساعات', 'ساعة'));
  if (r || !h) out.push(part(r, 'دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'));
  return out.join(' و');
}

// ---- Hub ----

const TOOLS = [
  ['#/qailulah', 'القيلولة', 'حاسبة وقتها من شمس موقعك، بنصوص الفقهاء، ومؤقّت', 'moon', 'teal'],
  ['#/walk', 'المشي الياباني', '٥ جولات: ٣ دقائق سريع و٣ بطيء = ٣٠ دقيقة', 'stars', 'amber'],
  ['#/focus', 'قاعدة العشر دقائق', 'اكتب ما تسوّفه، والتزم به عشر دقائق فقط', 'clock', 'rose'],
  ['#/qibla', 'اتجاه القبلة', 'بوصلة القبلة والمسافة إلى مكة', 'compass', 'emerald'],
];

export function renderTools(view) {
  view.innerHTML = `
    ${pageHeader('الأدوات', { back: '#/home' })}
    <section class="cat-grid">
      ${TOOLS.map(
        ([href, title, sub, ic, tone]) => `<a class="cat tone-${tone}" href="${href}">
          <div class="cat-icon">${icon(ic, 26)}</div>
          <div class="cat-text"><b>${title}</b><span>${sub}</span></div>${icon('chevron', 18, 'muted')}</a>`
      ).join('')}
    </section>`;
}

// ---- Qailulah ----

// Today's nap windows from the prayer times: the sixth seasonal hour before the zawal
// (the Hanbali text), and after the Dhuhr prayer until Asr (the common practice).
function napDay() {
  const info = today();
  const t = info.times;
  const s = state.settings;
  const zawal = { at: t.dhuhr.at - (s.offsets.dhuhr || 0) * 60000, hours: t.dhuhr.hours - (s.offsets.dhuhr || 0) / 60 };
  const dayLen = (t.maghrib.at - t.sunrise.at) / 60000;
  const hour = dayLen / 12;
  const a0 = { at: zawal.at - hour * 60000, hours: zawal.hours - hour / 60 };
  return { t, zawal, a0, dayLen, hour };
}

export function renderQailulah(view) {
  const h24 = state.settings.clock24;
  const T = (x) => `<span class="t">${clockText(x.hours, h24)}</span>`;
  const at = (ms, ref) => ({ at: ms, hours: ref.hours + (ms - ref.at) / 3600000 });

  const status = (d) => {
    const n = Date.now();
    const { t, zawal, a0 } = d;
    if (n < t.sunrise.at) return ['idle', `قبل الشروق. تبدأ نافذة ما قبل الزوال الساعة ${T(a0)}.`];
    if (n < a0.at) return ['idle', `تبدأ نافذة ما قبل الزوال بعد ${duration((a0.at - n) / 60000)}، الساعة ${T(a0)}.`];
    if (n < zawal.at) return ['sun', `أنت الآن في نافذة ما قبل الزوال. يبقى على الزوال ${duration((zawal.at - n) / 60000)}.`];
    if (n < t.asr.at) return ['shade', `مضى الزوال. أنت في نافذة ما بعد الظهر، ويبقى على العصر ${duration((t.asr.at - n) / 60000)}.`];
    if (n < t.maghrib.at) return ['idle', 'دخل وقت العصر؛ وقد كره الإمام أحمد النوم بعده.'];
    return ['idle', 'غربت الشمس. نافذتا الغد تظهران بعد منتصف الليل.'];
  };

  const draw = () => {
    const d = napDay();
    const { t, zawal, a0 } = d;
    const nap = tools().nap || 20;
    const aLatest = at(zawal.at - (5 + nap) * 60000, zawal);
    const bLatest = at(t.asr.at - (15 + nap) * 60000, t.asr);
    const [pill, text] = status(d);
    const running = tools().napEnd > Date.now();
    const quote = (q) => `<figure class="q"><blockquote>${esc(q.text)}</blockquote><figcaption>${esc(q.src)}</figcaption></figure>`;
    view.innerHTML = `
      ${pageHeader('القيلولة', { back: '#/tools', sub: 'من شمس موقعك، بنصوص الفقهاء وأدلتهم' })}
      <section class="card nap-dial">
        ${napArc(d)}
        <div class="nap-status"><span class="pill ${pill}">الآن</span><span>${text}</span></div>
        <div class="nap-times">
          <div><small>الشروق</small><b>${T(t.sunrise)}</b></div>
          <div class="z"><small>الزوال</small><b>${T(zawal)}</b></div>
          <div><small>العصر</small><b>${T(t.asr)}</b></div>
          <div><small>الغروب</small><b>${T(t.maghrib)}</b></div>
        </div>
        <p class="hint">طول النهار ${duration(d.dayLen)} • الساعة الزمانية ${duration(d.hour)}</p>
      </section>

      <div class="chips centered" data-nap>
        ${[10, 20, 30].map((m) => `<button class="chip-opt ${nap === m ? 'on' : ''}" data-m="${m}">${num(m)} دقيقة</button>`).join('')}
      </div>
      <section class="nap-windows">
        <article class="card nap-win a">
          <small><i></i>نصّ الحنابلة وبعض الشافعية</small>
          <h3>قبل الزوال</h3>
          <b class="nap-range">${T(a0)} – ${T(zawal)}</b>
          <p class="hint">الساعة الزمانية السادسة من النهار، وتنتهي بالزوال.</p>
          <p class="nap-act">${
            aLatest.at >= a0.at
              ? `لقيلولة ${num(nap)} دقيقة: استلقِ قبل ${T(aLatest)} لتستيقظ قبل الزوال بخمس دقائق، كما قال ابن الجوزي: «ويجتهد في الانتباه قبل الزوال».`
              : `الساعة الزمانية اليوم أقصر من ${num(nap)} دقيقة مع هامش الاستيقاظ؛ اختر مدة أقصر.`
          }</p>
        </article>
        <article class="card nap-win b">
          <small><i></i>العمل الشائع، ورجّحته فتوى للشبكة الإسلامية</small>
          <h3>بعد صلاة الظهر</h3>
          <b class="nap-range">${T(zawal)} – ${T(t.asr)}</b>
          <p class="hint">تبدأ بعد أداء صلاة الظهر، وحدّها العصر. توافق هبوط اليقظة المعتاد بعد الظهر.</p>
          <p class="nap-act">لقيلولة ${num(nap)} دقيقة: استلقِ بعد صلاتك وقبل ${T(bLatest)} لتستيقظ قبل العصر بربع ساعة.</p>
        </article>
      </section>
      <p class="hint">${esc(QAILULAH_BRIDGE.replace('النافذتين: ', 'النافذتين: «').replace(' (فيض', '» (فيض'))}</p>

      <section class="card nap-timer">
        ${
          running
            ? `<div><small>يبقى على التنبيه</small><b class="nap-left" data-left>${mmss(Math.ceil((tools().napEnd - Date.now()) / 1000))}</b></div>
               <button class="btn ghost" data-stop>إيقاف</button>`
            : `<div><b>مؤقّت القيلولة</b><small>ينبّهك بصوت بعد ${num(nap)} دقيقة ويُسجّلها في «عباداتي». منبّه الجوال أوثق إذا قُفلت الشاشة.</small></div>
               <button class="btn primary" data-start>${icon('moon', 18)} ابدأ قيلولة ${num(nap)} دقيقة</button>`
        }
      </section>

      <h3 class="section-title">${icon('book', 18)} النصوص والأدلة</h3>
      <p class="hint">النصوص منقولة بحروفها من مصادرها، مع الجزء والصفحة في المطبوع.</p>
      <section class="card quotes"><h4><i class="sw a"></i>القيلولة قبل الزوال</h4>${QAILULAH_BEFORE.map(quote).join('')}</section>
      <section class="card quotes"><h4><i class="sw b"></i>نصف النهار، قبل الزوال أو بعده</h4>${QAILULAH_MIDDAY.map(quote).join('')}</section>
      <section class="card quotes"><h4>درجة ما يُستشهد به</h4>
        ${QAILULAH_GRADES.map(
          (g) => `<div class="grade"><p class="grade-text">${esc(g.text)}</p><p class="hint"><span class="pill ${g.tone === 'ok' ? '' : 'warn'}">${esc(g.grade)}</span> ${esc(g.why)}</p></div>`
        ).join('')}
      </section>

      <h3 class="section-title">${icon('info', 18)} ما يقوله علم النوم</h3>
      <section class="nap-science">
        ${QAILULAH_SCIENCE.map((x) => `<article class="card"><small>${esc(x.k)}</small><b>${esc(x.h)}</b><p>${esc(x.p)}</p><small class="muted">${esc(x.src)}</small></article>`).join('')}
      </section>
      <p class="hint center">جعلُ «الساعة السادسة» نافذةً لما قبل الزوال تقريبٌ من الحاسبة؛ النصوص تقول «قبل الزوال» و«نصف النهار» ولا تحدد مدة. والزوال هنا لحظة توسّط الشمس لموقعك، والساعة الزمانية جزء من اثني عشر من النهار.</p>
      <p class="hint center hafs-line">﴿أَصۡحَٰبُ ٱلۡجَنَّةِ يَوۡمَئِذٍ خَيۡرٞ مُّسۡتَقَرّٗا وَأَحۡسَنُ مَقِيلٗا﴾ الفرقان: ٢٤</p>`;
  };
  draw();

  view.onclick = (e) => {
    const m = e.target.closest('[data-nap] [data-m]');
    if (m) {
      tools().nap = Number(m.dataset.m);
      save();
      return draw();
    }
    if (e.target.closest('[data-start]')) {
      startNap(tools().nap || 20);
      return draw();
    }
    if (e.target.closest('[data-stop]')) {
      stopNap();
      draw();
    }
  };
  return {
    tick() {
      const el = $('[data-left]', view);
      if (tools().napEnd > Date.now()) {
        if (el) el.textContent = mmss(Math.ceil((tools().napEnd - Date.now()) / 1000));
      } else if (el) draw();
    },
    destroy: () => (view.onclick = null),
  };
}

// The day as a sun arc from sunrise to sunset in twelve seasonal hours, with the two
// nap windows and the sun's place now.
function napArc(d) {
  const { t, zawal, a0, hour } = d;
  const rise = t.sunrise.at;
  const span = t.maghrib.at - rise;
  const cx = 210;
  const cy = 200;
  const R = 165;
  // Sunrise (east) on the right, sunset on the left, the sun climbing anticlockwise.
  const pos = (ms, r = R) => {
    const a = (Math.PI * (ms - rise)) / span;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const f = (n) => n.toFixed(1);
  const arc = (m1, m2, r = R) => {
    const [x1, y1] = pos(Math.max(rise, m1), r);
    const [x2, y2] = pos(Math.min(t.maghrib.at, m2), r);
    return `M${f(x1)} ${f(y1)} A${r} ${r} 0 0 0 ${f(x2)} ${f(y2)}`;
  };
  let g = `<line class="horizon" x1="${cx - R - 20}" y1="${cy}" x2="${cx + R + 20}" y2="${cy}"/>`;
  g += `<path class="track" d="${arc(rise, t.maghrib.at)}"/>`;
  g += `<path class="band-b" d="${arc(zawal.at, t.asr.at)}"/>`;
  g += `<path class="band-a" d="${arc(a0.at, zawal.at)}"/>`;
  for (let i = 0; i <= 12; i++) {
    const ms = rise + i * hour * 60000;
    const [x1, y1] = pos(ms, R - 9);
    const [x2, y2] = pos(ms, R + 9);
    g += `<line class="tick ${i === 6 ? 'major' : ''}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
    if (i > 0) {
      const [lx, ly] = pos(rise + (i - 0.5) * hour * 60000, R - 24);
      g += `<text class="hnum" x="${f(lx)}" y="${f(ly + 4)}" text-anchor="middle">${num(i)}</text>`;
    }
  }
  const [zx, zy] = pos(zawal.at, R + 14);
  g += `<line class="meridian" x1="${cx}" y1="${cy}" x2="${f(zx)}" y2="${f(zy)}"/>`;
  g += `<text class="lbl" x="${f(zx)}" y="${f(zy - 6)}" text-anchor="middle">الزوال</text>`;
  g += `<text class="lbl-s" x="${cx + R}" y="${cy + 22}" text-anchor="middle">الشروق</text>`;
  g += `<text class="lbl-s" x="${cx - R}" y="${cy + 22}" text-anchor="middle">الغروب</text>`;
  g += `<text class="lbl-s" x="${cx}" y="${cy - 40}" text-anchor="middle">الساعات الزمانية</text>`;
  const n = Date.now();
  if (n > rise && n < t.maghrib.at) {
    const [sx, sy] = pos(n);
    g += `<circle class="halo" cx="${f(sx)}" cy="${f(sy)}" r="16"/><circle class="sunpt" cx="${f(sx)}" cy="${f(sy)}" r="8"/>`;
  }
  return `<svg class="nap-svg" viewBox="0 0 420 228" aria-hidden="true">${g}</svg>`;
}

// ---- Japanese interval walk ----

export function renderWalk(view) {
  const draw = () => {
    const w = tools().walk;
    const s = walkState(w);
    const running = w && !w.paused && !w.finished;
    const pct = Math.round((s.elapsed / s.total) * 100);
    view.innerHTML = `
      ${pageHeader('المشي الياباني', { back: '#/tools', sub: `${num(WALK.rounds)} جولات × ${num(6)} دقائق = ${num(30)} دقيقة` })}
      <section class="walk ${s.done && w ? 'done' : s.fast ? 'fast' : 'slow'}">
        <span class="walk-phase" data-phase>${s.done && w ? '🏁 انتهى التمرين!' : s.fast ? 'مشي سريع ⚡' : 'مشي بطيء 🧘'}</span>
        <div class="walk-ring"><span data-ring>${ring(1 - s.left / s.phaseLen, 220, 12)}</span><b data-left>${mmss(s.left)}</b></div>
        <p class="walk-round">الجولة <b data-round>${num(s.round)}</b> من ${num(WALK.rounds)}</p>
        <div class="walk-dots" data-dots>${dots(s)}</div>
        <div class="bar light"><i data-total style="width:${pct}%"></i></div>
        <small class="muted" data-pct>${num(pct)}٪ مكتمل</small>
        <div class="walk-actions">
          ${
            s.done && w
              ? `<button class="btn primary" data-reset>${icon('reset', 18)} تمرين جديد</button>`
              : running
                ? `<button class="btn ghost" data-pause>إيقاف مؤقت</button>`
                : `<button class="btn primary" data-start>${icon('play', 18)} ${w ? 'متابعة' : 'ابدأ'}</button>`
          }
          ${w && !(s.done && w) ? `<button class="btn ghost" data-reset aria-label="إعادة">${icon('reset', 18)}</button>` : ''}
        </div>
        <p class="hint center">ثلاث دقائق مشياً سريعاً تتسارع فيه الأنفاس، ثم ثلاث دقائق مشياً هادئاً، خمس مرات. ينبّهك بصوت عند تغيّر المرحلة، ويُسجَّل «المشي ٣٠ دقيقة» في عباداتي عند إتمامه.</p>
      </section>`;
  };
  const dots = (s) =>
    Array.from({ length: WALK.rounds }, (_, i) => `<i class="${i + 1 < s.round || s.done ? 'on' : i + 1 === s.round ? 'now' : ''}"></i>`).join('');
  draw();
  let phase = '';
  view.onclick = (e) => {
    if (e.target.closest('[data-start]')) startWalk();
    else if (e.target.closest('[data-pause]')) pauseWalk();
    else if (e.target.closest('[data-reset]')) resetWalk();
    else return;
    draw();
  };
  return {
    tick() {
      const w = tools().walk;
      const s = walkState(w);
      const now = `${s.round}${s.fast}${s.done}${!!w?.paused}${!!w}`;
      if (now !== phase) {
        phase = now;
        return draw();
      }
      $('[data-left]', view).textContent = mmss(s.left);
      $('[data-ring]', view).innerHTML = ring(1 - s.left / s.phaseLen, 220, 12);
      const pct = Math.round((s.elapsed / s.total) * 100);
      $('[data-total]', view).style.width = `${pct}%`;
      $('[data-pct]', view).textContent = `${num(pct)}٪ مكتمل`;
    },
    destroy: () => (view.onclick = null),
  };
}

// ---- Ten-minute rule ----

export function renderFocus(view) {
  const draw = () => {
    const f = tools().focus;
    const total = (f.minutes || 10) * 60;
    const left = f.end ? Math.max(0, Math.ceil(((f.paused ? Date.now() + f.left : f.end) - Date.now()) / 1000)) : total;
    view.innerHTML = `
      ${pageHeader('قاعدة العشر دقائق', { back: '#/tools', sub: 'ابدأ المهمة التي تؤجّلها عشر دقائق فقط' })}
      <section class="focus">
        <label class="field"><span>ما المهمة التي تسوّفها؟</span><input data-task maxlength="80" value="${esc(f.task || '')}" placeholder="مثال: مراجعة الحفظ، ترتيب المكتب…"></label>
        <div class="chips centered" data-mins>
          ${[5, 10, 15, 20].map((m) => `<button class="chip-opt ${f.minutes === m ? 'on' : ''}" data-m="${m}" ${f.end ? 'disabled' : ''}>${num(m)} د</button>`).join('')}
        </div>
        <div class="focus-ring"><span data-ring>${ring(1 - left / total, 220, 14)}</span><b data-left>${mmss(left)}</b></div>
        <div class="walk-actions">
          ${
            f.end && !f.paused
              ? `<button class="btn ghost" data-pause>إيقاف مؤقت</button>`
              : `<button class="btn primary" data-start>${icon('play', 18)} ${f.paused ? 'متابعة' : 'ابدأ'}</button>`
          }
          ${f.end ? `<button class="btn ghost" data-reset aria-label="إعادة">${icon('reset', 18)}</button>` : ''}
        </div>
        <div class="stats">
          <div><small>مهام منجزة</small><b>${num(f.count || 0)}</b></div>
          <div><small>دقائق تركيز</small><b>${num(f.total || 0)}</b></div>
        </div>
        <p class="hint center">أصعب ما في العمل أوله. التزم بعشر دقائق فقط، فإذا انتهت فإما أن تكمل وقد زال الثقل، وإما أن تستريح وقد أنجزت شيئاً.</p>
      </section>`;
  };
  draw();
  view.oninput = (e) => {
    if (!e.target.matches('[data-task]')) return;
    tools().focus.task = e.target.value;
    save();
  };
  view.onclick = (e) => {
    const f = tools().focus;
    const m = e.target.closest('[data-mins] [data-m]');
    if (m && !f.end) {
      f.minutes = Number(m.dataset.m);
      save();
    } else if (e.target.closest('[data-start]')) {
      if (f.paused) resumeFocus();
      else startFocus(f.minutes || 10, f.task || '');
    } else if (e.target.closest('[data-pause]')) pauseFocus();
    else if (e.target.closest('[data-reset]')) resetFocus();
    else return;
    draw();
  };
  let wasRunning = !!tools().focus.end;
  return {
    tick() {
      const f = tools().focus;
      if (!!f.end !== wasRunning) {
        wasRunning = !!f.end;
        return draw();
      }
      if (!f.end || f.paused) return;
      const total = (f.minutes || 10) * 60;
      const left = Math.max(0, Math.ceil((f.end - Date.now()) / 1000));
      $('[data-left]', view).textContent = mmss(left);
      $('[data-ring]', view).innerHTML = ring(1 - left / total, 220, 14);
    },
    destroy: () => (view.onclick = view.oninput = null),
  };
}
