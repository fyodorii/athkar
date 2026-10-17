// Radio: live Quran stations (the Saudi Quran radio, Nidaa al-Islam and reciters), with the
// player shared with the mini bar above the tabs.

import { icon } from '../icons.js';
import { onRadio, play, radioStatus, STATIONS, stationById, stop, toggle } from '../radio.js';
import { save, state } from '../store.js';
import { esc, openSheet, pageHeader, toast } from '../ui.js';

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
