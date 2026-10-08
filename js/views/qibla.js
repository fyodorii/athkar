// Qibla compass: the dial turns with the phone's heading and the Kaaba mark sits at
// the qibla direction, so pointing the top of the phone at it faces the qibla.

import { num } from '../dates.js';
import { icon } from '../icons.js';
import { qibla } from '../prayer.js';
import { state } from '../store.js';
import { $, esc, haptic, pageHeader, toast } from '../ui.js';

const TOLERANCE = 4; // degrees counted as facing the qibla

export function render(view) {
  const loc = state.settings.location;
  const q = qibla(loc.lat, loc.lng);
  const bearing = Math.round(q.bearing);
  let listening = null;
  let shown = 0; // unwrapped dial angle, so 359° → 1° turns 2° and not back round
  let aligned = false;

  view.innerHTML = `
    ${pageHeader('اتجاه القبلة', { back: '#/home', sub: `${icon('pin', 14)} ${esc(loc.name)}` })}
    <section class="qibla">
      <div class="compass" data-compass>
        <div class="compass-glow"></div>
        <div class="dial" data-dial>
          ${ticks()}
          <span class="cardinal n">ش</span><span class="cardinal e">ق</span><span class="cardinal s">ج</span><span class="cardinal w">غ</span>
          <div class="kaaba-mark" style="transform: rotate(${q.bearing}deg)"><span>${icon('kaaba', 26)}</span></div>
          <div class="qibla-line" style="transform: rotate(${q.bearing}deg)"></div>
        </div>
        <div class="needle"></div>
        <div class="compass-center"><b data-heading>${num(bearing)}°</b><small data-heading-label>القبلة</small></div>
      </div>
      <p class="qibla-status" data-status>اضغط «تشغيل البوصلة» ثم ضع الجوال مستوياً</p>
      <button class="btn primary wide" data-start>${icon('compass', 20)} تشغيل البوصلة</button>
      <div class="stats">
        <div><small>زاوية القبلة</small><b>${num(bearing)}°</b><span>من الشمال باتجاه عقارب الساعة</span></div>
        <div><small>المسافة إلى مكة</small><b>${num(Math.round(q.km).toLocaleString('en-US'))}</b><span>كيلومتر</span></div>
      </div>
      <p class="hint center">${icon('info', 15)} أبعد الجوال عن المعادن والمغناطيس، وإن اضطربت القراءة فحرّكه على شكل الرقم ٨ لمعايرة البوصلة.</p>
    </section>`;

  const dial = $('[data-dial]', view);
  const status = $('[data-status]', view);
  const compass = $('[data-compass]', view);

  const onHeading = (heading) => {
    // Turn the dial so its north points to real north.
    let delta = -heading - shown;
    delta = ((((delta + 180) % 360) + 360) % 360) - 180;
    shown += delta;
    dial.style.transform = `rotate(${shown}deg)`;
    $('[data-heading]', view).textContent = `${num(Math.round(heading))}°`;
    $('[data-heading-label]', view).textContent = 'اتجاهك';
    let off = (((q.bearing - heading) % 360) + 360) % 360;
    if (off > 180) off -= 360;
    const now = Math.abs(off) <= TOLERANCE;
    if (now !== aligned) {
      aligned = now;
      compass.classList.toggle('aligned', now);
      if (now) haptic(40);
    }
    status.innerHTML = now
      ? `${icon('check', 18)} أنت متجه إلى القبلة`
      : `استدر ${off > 0 ? 'يميناً' : 'يساراً'} ${num(Math.round(Math.abs(off)))}°`;
    status.classList.toggle('ok', now);
  };

  const start = async () => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') throw new Error('denied');
      }
    } catch (e) {
      toast('لم يُسمح بالوصول إلى البوصلة. فعّله من إعدادات Safari ← الحركة والاتجاه');
      return;
    }
    if (listening) return;
    const absolute = 'ondeviceorientationabsolute' in window;
    const handler = (e) => {
      let heading = null;
      if (typeof e.webkitCompassHeading === 'number') heading = e.webkitCompassHeading; // iPhone
      else if ((e.absolute || absolute) && typeof e.alpha === 'number') heading = 360 - e.alpha; // Android
      if (heading === null) return;
      const screenAngle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      onHeading((heading + screenAngle + 360) % 360);
    };
    const type = absolute ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(type, handler);
    listening = () => window.removeEventListener(type, handler);
    $('[data-start]', view).hidden = true;
    status.textContent = 'جارٍ قراءة البوصلة…';
    setTimeout(() => {
      if ($('[data-heading-label]', view)?.textContent === 'القبلة') {
        status.textContent = 'لا توجد بوصلة في هذا الجهاز. استعمل زاوية القبلة من الشمال الموضحة أدناه.';
      }
    }, 3000);
  };

  $('[data-start]', view).addEventListener('click', start);
  return { destroy: () => listening?.() };
}

function ticks() {
  let s = '';
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0;
    s += `<i class="tick ${major ? 'major' : ''}" style="transform: rotate(${d}deg)"></i>`;
    if (major && d % 90 !== 0) s += `<em class="deg" style="transform: rotate(${d}deg)"><span style="transform: rotate(${-d}deg)">${num(d)}</span></em>`;
  }
  return s;
}
