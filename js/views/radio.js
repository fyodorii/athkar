// Radio: the two live Quran stations (the Saudi Quran radio and Nidaa al-Islam), with the
// player shared with the mini bar above the tabs.

import { icon } from '../icons.js';
import { state } from '../store.js';
import { onRadio, play, radioStatus, stop, toggle } from '../radio.js';
import { esc, pageHeader } from '../ui.js';

// The four live stations: one picked at a time in the large player, all of them in the list under it.
const LIVE = ['makkah', 'madinah', 'saudi', 'nidaa'];
const INFO = {
  makkah: ['المسجد الحرام', 'مكة المكرمة', 'kaaba', '#8a6a2c'],
  madinah: ['المسجد النبوي', 'المدينة المنورة', 'mosque', '#2f7a66'],
  saudi: ['إذاعة القرآن الكريم', 'المملكة العربية السعودية', 'radio', '#2c6fcc'],
  nidaa: ['إذاعة نداء الإسلام', 'من مكة المكرمة', 'radio', '#7a4fc8'],
};

export function renderRadio(view) {
  let hero = LIVE.includes(state.radio.station) ? state.radio.station : 'makkah';
  const draw = () => {
    const { status, station } = radioStatus();
    if (LIVE.includes(station?.id)) hero = station.id;
    const live = station && (status === 'playing' || status === 'loading');
    const heroOn = station?.id === hero;
    const [name, place, ic, tint] = INFO[hero];
    view.innerHTML = `
      ${pageHeader('الإذاعة', { sub: 'بث مباشر من الحرمين وإذاعات القرآن' })}
      <section class="rd-now ${heroOn && live ? 'live' : ''}" style="--tint:${tint}">
        <span class="rd-badge"><i></i> مباشر</span>
        <div class="rd-art">${icon(ic, 52)}</div>
        <b>${esc(name)}</b>
        <small>${esc(place)}</small>
        <span class="rd-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
        <div class="rd-ctrl">
          ${heroOn && station ? `<button class="rd-side" data-stop aria-label="إيقاف">${icon('close', 22)}</button>` : '<span class="rd-side ghost"></span>'}
          <button class="rd-play" data-play="${hero}" aria-label="${heroOn && live ? 'إيقاف مؤقت' : 'تشغيل'}">${icon(heroOn && live ? 'pause' : 'play', 36)}</button>
          <span class="rd-side ghost"></span>
        </div>
        <p class="rd-status">${statusText(heroOn ? status : 'stopped')}</p>
      </section>
      <h3 class="rd-h">المحطات</h3>
      <div class="rd-list">
        ${LIVE.map((id) => {
          const [n, p, i2, c] = INFO[id];
          const on = station?.id === id;
          const playing = on && live;
          return `<button class="rd-row ${id === hero ? 'sel' : ''} ${playing ? 'playing' : ''}" data-pick="${id}" style="--tint:${c}">
            <span class="rd-ic">${icon(i2, 24)}</span>
            <span class="rd-txt"><b>${esc(n)}</b><small>${playing ? statusText(status) : esc(p)}</small></span>
            <span class="rd-go">${playing ? '<span class="rd-eq"><i></i><i></i><i></i></span>' : icon('play', 18)}</span>
          </button>`;
        }).join('')}
      </div>
      <p class="hint center">يستمر البث وأنت تتنقل في التطبيق، وتظهر أزرار التحكم في شاشة القفل. يحتاج اتصالاً بالإنترنت.</p>`;
  };
  draw();
  const off = onRadio(draw);

  view.onclick = (e) => {
    const r = e.target.closest('[data-pick]');
    if (r) {
      const id = r.dataset.pick;
      const { status, station } = radioStatus();
      hero = id;
      if (station?.id === id && status !== 'error') return toggle();
      return play(id);
    }
    const p = e.target.closest('[data-play]');
    if (p) {
      const { status, station } = radioStatus();
      if (station?.id === p.dataset.play && status !== 'error') toggle();
      else play(p.dataset.play);
      return;
    }
    if (e.target.closest('[data-stop]')) return stop();
  };
  return {
    destroy() {
      off();
      view.onclick = null;
    },
  };
}

export function statusText(status, clip = false) {
  if (clip) return { loading: 'جارٍ التحميل…', playing: 'يُتلى الآن', paused: 'متوقف مؤقتاً', error: 'تعذر التشغيل، تأكد من الإنترنت' }[status] || '';
  return (
    {
      loading: 'جارٍ الاتصال بالبث…',
      playing: 'يُبث الآن',
      paused: 'متوقف مؤقتاً',
      error: 'تعذر تشغيل البث، تأكد من الإنترنت أو جرّب محطة أخرى',
    }[status] || 'اضغط للاستماع'
  );
}
