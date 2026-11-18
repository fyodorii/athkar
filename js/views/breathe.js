// «تنفّس ٥-٣-٧»: breathe in for 5 seconds (the belly rising), hold for 3, breathe out slowly for 7;
// five rounds, before sleep or in a moment of worry. A circle grows and shrinks with the breath.

import { num } from '../dates.js';
import { icon } from '../icons.js';
import { haptic, pageHeader } from '../ui.js';

const PHASES = [
  ['in', 'شهيق', 'من الأنف، والبطن يبرز', 5],
  ['hold', 'احبس', 'أمسك النفس بهدوء', 3],
  ['out', 'زفير', 'ببطء من الفم', 7],
];
const ROUNDS = 5;
const CYCLE = PHASES.reduce((a, p) => a + p[3], 0);

export function render(view) {
  let start = 0; // when the exercise began (0 = not running)
  let raf = 0;
  const draw = () => {
    view.innerHTML = `
      ${pageHeader('تنفّس ٥-٣-٧', { back: '#/home', sub: 'شهيق ٥ ثوانٍ، حبس ٣، زفير ٧' })}
      <section class="br">
        <div class="br-stage"><span class="br-ring"></span><span class="br-ball" data-ball></span>
          <div class="br-text"><b data-word>${start ? '' : 'جاهز؟'}</b><strong data-sec></strong><small data-how>${start ? '' : `${num(ROUNDS)} دورات`}</small></div></div>
        <p class="br-round" data-round>${start ? '' : '&nbsp;'}</p>
        <button class="btn ${start ? 'ghost' : 'primary'} wide" data-go>${start ? 'إيقاف' : `${icon('play', 18)} ابدأ`}</button>
        <ol class="card br-steps">${PHASES.map(([, w, how, s]) => `<li><b>${w} ${num(s)} ثوانٍ</b><small>${how}</small></li>`).join('')}</ol>
        <p class="hint">جرّبه ٥ دورات قبل النوم أو في أثناء القلق. تمرين للاسترخاء، ولا يغني عن استشارة الطبيب ولا عن علاج الضغط.</p>
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
    if (w.textContent !== word) {
      w.textContent = word;
      view.querySelector('[data-how]').textContent = how;
      haptic(15, true);
    }
    view.querySelector('[data-sec]').textContent = num(Math.ceil(len - x));
    view.querySelector('[data-round]').textContent = `الدورة ${num(round + 1)} من ${num(ROUNDS)}`;
    raf = requestAnimationFrame(frame);
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
  view.onclick = (e) => {
    if (!e.target.closest('[data-go]')) return;
    if (start) {
      stop();
      draw();
      return;
    }
    start = Date.now();
    draw();
    frame();
  };
  return { destroy: () => {
    cancelAnimationFrame(raf);
    view.onclick = null;
  } };
}
