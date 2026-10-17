// Radio: the two live Quran stations (the Saudi Quran radio and Nidaa al-Islam), with the
// player shared with the mini bar above the tabs.

import { icon } from '../icons.js';
import { state } from '../store.js';
import { onRadio, play, radioStatus, STATIONS, stationById, stop, toggle } from '../radio.js';
import { esc, pageHeader } from '../ui.js';

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
      ${pageHeader('الإذاعة', { sub: 'القرآن الكريم — بث مباشر' })}
      <section class="radio-hero ${heroOn && live ? 'live' : ''}">
        <div class="radio-switch">${LIVE.map((id) => `<button class="${id === hero ? 'on' : ''}" data-hero="${id}">${esc(stationById(id).name.replace('إذاعة ', ''))}</button>`).join('')}</div>
        <div class="radio-art">${icon('radio', 46)}<span class="wave"><i></i><i></i><i></i><i></i></span></div>
        <b>${esc(main.name)}</b>
        <span>${esc(main.sub)}</span>
        <button class="radio-play" data-play="${hero}" aria-label="تشغيل">${icon(heroOn && live ? 'pause' : 'play', 34)}</button>
        <small class="radio-status">${statusText(heroOn ? status : 'stopped')}</small>
      </section>
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
