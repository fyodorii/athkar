// Two everyday tools: the Saudi VAT calculator (15%) and a stopwatch with a countdown timer.

import { num } from '../dates.js';
import { icon } from '../icons.js';
import { chime, unlockAudio } from '../timers.js';
import { haptic, pageHeader } from '../ui.js';

const RATE = 0.15;
const money = (v) => num(v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// «حاسبة ضريبة القيمة المضافة»: add 15% to a price, or take it out of a price that includes it.
export function renderVat(view) {
  let mode = 'add';
  let value = '';
  const draw = () => {
    const a = Number(String(value).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/,/g, '')) || 0;
    const net = mode === 'add' ? a : a / (1 + RATE);
    const vat = net * RATE;
    const total = net + vat;
    view.innerHTML = `
      ${pageHeader('حاسبة الضريبة', { back: '#/tools', sub: 'ضريبة القيمة المضافة في السعودية ١٥٪' })}
      <section class="card vt">
        <div class="seg-tabs">
          <button class="${mode === 'add' ? 'on' : ''}" data-mode="add">إضافة الضريبة (× ١٫١٥)</button>
          <button class="${mode === 'out' ? 'on' : ''}" data-mode="out">استخراجها (÷ ١٫١٥)</button>
        </div>
        <label class="field"><span>${mode === 'add' ? 'المبلغ قبل الضريبة (ر.س)' : 'المبلغ شامل الضريبة (ر.س)'}</span>
          <input data-amount inputmode="decimal" placeholder="0.00" value="${value}" dir="ltr"></label>
        <div class="vt-out">
          <div><small>قبل الضريبة</small><b data-o="net">${money(net)}</b></div>
          <div class="vat"><small>الضريبة ١٥٪</small><b data-o="vat">${money(vat)}</b></div>
          <div class="tot"><small>الإجمالي</small><b data-o="total">${money(total)}</b></div>
        </div>
      </section>
      <section class="card vt-table">
        <h3>${icon('grid', 18)} جدول سريع</h3>
        <table><thead><tr><th>المبلغ</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>
          ${[100, 500, 1000, 5000, 10000].map((n) => `<tr><td>${money(n)}</td><td class="vat">${money(n * RATE)}</td><td class="tot">${money(n * (1 + RATE))}</td></tr>`).join('')}
        </tbody></table>
      </section>`;
  };
  const update = () => {
    const a = Number(value.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/,/g, '')) || 0;
    const net = mode === 'add' ? a : a / (1 + RATE);
    const out = { net, vat: net * RATE, total: net * (1 + RATE) };
    for (const k in out) view.querySelector(`[data-o="${k}"]`).textContent = money(out[k]);
  };
  draw();
  view.oninput = (e) => {
    if (!e.target.matches('[data-amount]')) return;
    value = e.target.value;
    update();
  };
  view.onclick = (e) => {
    const m = e.target.closest('[data-mode]');
    if (!m) return;
    mode = m.dataset.mode;
    draw();
  };
  return { destroy: () => ((view.oninput = null), (view.onclick = null)) };
}

// «ساعة إيقاف ومؤقت»: a stopwatch with laps, and a countdown with a sound at its end.
const pad = (n) => String(n).padStart(2, '0');
const fmt = (ms, cs = true) => {
  const t = Math.max(0, ms);
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return num(`${h ? `${pad(h)}:` : ''}${pad(m)}:${pad(s)}${cs ? `.${pad(Math.floor((t % 1000) / 10))}` : ''}`);
};
const sw = { start: 0, acc: 0, laps: [] }; // kept while the app is open
const cd = { end: 0, left: 5 * 60000, total: 5 * 60000 };
let tab = 'watch';

// A tap felt and heard on every button; the last seconds of the timer tick, its end rings.
const cue = (n = 1, ms = 15) => {
  haptic(ms, true, true);
  chime(Array.from({ length: n }, (_, i) => i * 0.16), false);
};

export function renderStopwatch(view) {
  let raf = 0;
  let lastSec = -1;
  const running = () => (tab === 'watch' ? !!sw.start : !!cd.end);
  const elapsed = () => sw.acc + (sw.start ? Date.now() - sw.start : 0);
  const left = () => (cd.end ? cd.end - Date.now() : cd.left);
  const draw = () => {
    const r = running();
    view.innerHTML = `
      ${pageHeader('مؤقت وعداد', { back: '#/tools' })}
      <section class="card stw">
        <div class="seg-tabs">
          <button class="${tab === 'watch' ? 'on' : ''}" data-stab="watch">العداد</button>
          <button class="${tab === 'timer' ? 'on' : ''}" data-stab="timer">المؤقت</button>
        </div>
        <div class="stw-face" data-face>${tab === 'watch' ? fmt(elapsed()) : fmt(left(), false)}</div>
        ${tab === 'timer' && !r ? `<div class="stw-set">
            <label class="field"><span>ساعات</span><input type="number" min="0" max="23" inputmode="numeric" data-hr value="${Math.floor(cd.left / 3600000)}"></label>
            <label class="field"><span>دقائق</span><input type="number" min="0" max="59" inputmode="numeric" data-min value="${Math.floor((cd.left % 3600000) / 60000)}"></label>
            <label class="field"><span>ثوانٍ</span><input type="number" min="0" max="59" inputmode="numeric" data-sec value="${Math.floor((cd.left % 60000) / 1000)}"></label>
          </div>` : ''}
        <div class="stw-btns">
          <button class="btn primary" data-go>${icon(r ? 'pause' : 'play', 18)} ${r ? 'إيقاف' : 'ابدأ'}</button>
          ${tab === 'watch' && r ? `<button class="btn ghost" data-lap>${icon('plus', 18)} لفة</button>` : ''}
          <button class="btn ghost" data-reset>${icon('reset', 18)} إعادة</button>
        </div>
        ${tab === 'watch' && sw.laps.length ? `<ol class="stw-laps">${sw.laps.map((l, i) => `<li><span>لفة ${num(i + 1)}</span><b>${fmt(l)}</b></li>`).reverse().join('')}</ol>` : ''}
      </section>`;
  };
  const tick = () => {
    const f = view.querySelector('[data-face]');
    if (!f) return;
    if (tab === 'watch') f.textContent = fmt(elapsed());
    else {
      const l = left();
      f.textContent = fmt(l, false);
      const sec = Math.ceil(l / 1000);
      if (cd.end && sec <= 3 && sec > 0 && sec !== lastSec) cue(1, 20);
      lastSec = sec;
      if (cd.end && l <= 0) {
        cd.end = 0;
        cd.left = cd.total;
        chime([0, 0.35, 0.7, 1.05, 1.6, 1.95, 2.3, 2.65]);
        haptic(150, true, true);
        setTimeout(() => haptic(150, true, true), 900);
        setTimeout(() => haptic(150, true, true), 1800);
        draw();
      }
    }
    raf = requestAnimationFrame(tick);
  };
  draw();
  tick();
  const readSet = () => {
    const h = Number(view.querySelector('[data-hr]')?.value || 0);
    const m = Number(view.querySelector('[data-min]')?.value || 0);
    const s = Number(view.querySelector('[data-sec]')?.value || 0);
    cd.left = cd.total = Math.max(1, Math.min(23, h) * 3600 + Math.min(59, m) * 60 + Math.min(59, s)) * 1000;
  };
  view.onclick = (e) => {
    const t = e.target.closest("[data-stab]");
    if (t) {
      tab = t.dataset.stab;
      return draw();
    }
    if (e.target.closest('[data-go]')) {
      unlockAudio();
      cue(running() ? 2 : 1);
      if (tab === 'watch') {
        if (sw.start) {
          sw.acc += Date.now() - sw.start;
          sw.start = 0;
        } else sw.start = Date.now();
      } else if (cd.end) {
        cd.left = cd.end - Date.now();
        cd.end = 0;
      } else {
        if (cd.left === cd.total) readSet();
        cd.end = Date.now() + cd.left;
      }
      return draw();
    }
    if (e.target.closest('[data-lap]')) {
      cue(1, 25);
      const total = elapsed();
      sw.laps.push(total - sw.laps.reduce((a, b) => a + b, 0));
      return draw();
    }
    if (e.target.closest('[data-reset]')) {
      unlockAudio();
      cue(3, 30);
      if (tab === 'watch') Object.assign(sw, { start: 0, acc: 0, laps: [] });
      else Object.assign(cd, { end: 0, left: cd.total });
      return draw();
    }
  };
  view.onchange = (e) => {
    if (e.target.matches('[data-hr], [data-min], [data-sec]')) readSet();
  };
  return { destroy: () => {
    cancelAnimationFrame(raf);
    view.onclick = view.onchange = null;
  } };
}
