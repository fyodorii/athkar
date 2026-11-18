// «تمارين التنفّس»: ٥-٣-٧ (in 5 seconds, the belly rising; hold 3; out slowly 7) and ٤-٧-٨ (in 4
// through the nose; hold 7; out 8 through the mouth); five rounds, before sleep or in a moment of worry. A circle grows and shrinks with the breath.

import { num } from '../dates.js';
import { icon } from '../icons.js';
import { chime, unlockAudio } from '../timers.js';
import { haptic, pageHeader, toggle } from '../ui.js';

const MODES = {
  537: { name: '٥-٣-٧', sub: 'شهيق ٥ ثوانٍ، حبس ٣، زفير ٧', phases: [
    ['in', 'شهيق', 'من الأنف، والبطن يبرز', 5],
    ['hold', 'احبس', 'أمسك النفس بهدوء', 3],
    ['out', 'زفير', 'ببطء من الفم', 7],
  ] },
  478: { name: '٤-٧-٨', sub: 'شهيق ٤ ثوانٍ، حبس ٧، زفير ٨', phases: [
    ['in', 'شهيق', 'من الأنف مع إغلاق الفم', 4],
    ['hold', 'احبس', 'احبس نفَسك', 7],
    ['out', 'زفير', 'أخرج الهواء من الفم بهدوء', 8],
  ] },
};
const ROUNDS = 5;
const MODE_KEY = 'adhkar-app:breath';
let mode = '537';
try {
  if (MODES[localStorage.getItem(MODE_KEY)]) mode = localStorage.getItem(MODE_KEY);
} catch (e) {
  /* nothing kept */
}
let PHASES = MODES[mode].phases;
let CYCLE = PHASES.reduce((a, p) => a + p[3], 0);
const setMode = (m) => {
  mode = m;
  PHASES = MODES[m].phases;
  CYCLE = PHASES.reduce((a, p) => a + p[3], 0);
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch (e) {
    /* nothing kept */
  }
};

export function render(view) {
  let start = 0; // when the exercise began (0 = not running)
  let sound = true;
  try {
    sound = localStorage.getItem('adhkar-app:breath-sound') !== '0';
  } catch (e) {
    /* nothing kept */
  }
  let raf = 0;
  const draw = () => {
    view.innerHTML = `
      ${pageHeader('تمارين التنفّس', { back: '#/home', sub: MODES[mode].sub })}
      <section class="br">
        <div class="segmented br-modes">${Object.entries(MODES).map(([k, m]) => `<button class="${k === mode ? 'on' : ''}" data-mode="${k}">تنفّس ${m.name}</button>`).join('')}</div>
        <div class="br-stage"><span class="br-ring"></span><span class="br-ball" data-ball></span>
          <div class="br-text"><b data-word>${start ? '' : 'جاهز؟'}</b><strong data-sec></strong><small data-how>${start ? '' : `${num(ROUNDS)} دورات`}</small></div></div>
        <p class="br-round" data-round>${start ? '' : '&nbsp;'}</p>
        <button class="btn ${start ? 'ghost' : 'primary'} wide" data-go>${start ? 'إيقاف' : `${icon('play', 18)} ابدأ`}</button>
        <label class="card br-opt"><span>${icon('sound', 20)} صوت عند كل مرحلة<small>مع الاهتزاز: نقرة للشهيق، نقرتان للحبس، ثلاث للزفير</small></span>${toggle('br-sound', sound)}</label>
        <ol class="card br-steps">${PHASES.map(([, w, how, s]) => `<li><b>${w} ${num(s)} ثوانٍ</b><small>${how}</small></li>`).join('')}</ol>
        <p class="hint">جرّبه ${num(ROUNDS)} دورات قبل النوم أو في أثناء القلق. تمرين للاسترخاء، ولا يغني عن استشارة الطبيب ولا عن علاج الضغط.</p>
      </section>`;
  };
  const frame = () => {
    const t = (Date.now() - start) / 1000;
    const round = Math.floor(t / CYCLE);
    const ball = view.querySelector('[data-ball]');
    if (!ball) return;
    if (round >= ROUNDS) {
      stop();
      view.querySelector('[data-word]').textContent = 'أحسنت';
      view.querySelector('[data-how]').textContent = 'تمّت الدورات الخمس';
      haptic(30, true);
      return;
    }
    let x = t - round * CYCLE;
    let i = 0;
    while (x >= PHASES[i][3]) x -= PHASES[i++][3];
    const [key, word, how, len] = PHASES[i];
    const f = x / len;
    const scale = key === 'in' ? 0.45 + 0.55 * f : key === 'hold' ? 1 : 1 - 0.55 * f;
    ball.style.transform = `scale(${scale})`;
    ball.dataset.phase = key;
    const w = view.querySelector('[data-word]');
    if (ball.dataset.cue !== `${round}${key}`) {
      ball.dataset.cue = `${round}${key}`;
      w.textContent = word;
      view.querySelector('[data-how]').textContent = how;
      cue(key);
    }
    view.querySelector('[data-sec]').textContent = num(Math.ceil(len - x));
    view.querySelector('[data-round]').textContent = `الدورة ${num(round + 1)} من ${num(ROUNDS)}`;
    raf = requestAnimationFrame(frame);
  };
  // Each phase felt and heard: one tick to breathe in, two to hold, three to breathe out.
  const cue = (key) => {
    const n = key === 'in' ? 1 : key === 'hold' ? 2 : 3;
    haptic(n === 1 ? 20 : n === 2 ? 40 : 120, true, true);
    if (sound) chime(Array.from({ length: n }, (_, i) => i * 0.18), false);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    start = 0;
    const b = view.querySelector('[data-go]');
    if (b) {
      b.className = 'btn primary wide';
      b.innerHTML = `${icon('play', 18)} ابدأ من جديد`;
    }
  };
  draw();
  view.onchange = (e) => {
    if (e.target.name !== 'br-sound') return;
    sound = e.target.checked;
    try {
      localStorage.setItem('adhkar-app:breath-sound', sound ? '1' : '0');
    } catch (err) {
      /* nothing kept */
    }
    if (sound) unlockAudio();
  };
  view.onclick = (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) {
      stop();
      setMode(m.dataset.mode);
      return draw();
    }
    if (!e.target.closest('[data-go]')) return;
    if (start) {
      stop();
      draw();
      return;
    }
    unlockAudio();
    start = Date.now();
    draw();
    frame();
  };
  return { destroy: () => {
    cancelAnimationFrame(raf);
    view.onclick = null;
    view.onchange = null;
  } };
}
