// «الصوتيات»: al-Fatiha in the reading of Abu Amr, and the poems (al-Ilbiri, al-Zaynabiyya). The recordings play in
// the app's shared player (radio.js), so they go on while the user moves around the app.

import { FATIHA_QIRAAT, NASHEEDS, POEMS } from '../audio-data.js';
import { icon } from '../icons.js';
import { onRadio, playTrack, radioStatus, stop, toggle } from '../radio.js';
import { esc, pageHeader } from '../ui.js';
import { statusText } from './radio.js';

const tracks = new Map(
  FATIHA_QIRAAT.flatMap((q) => q.rawis.filter((r) => r.url).map((r) => [`fatiha-${r.id}`, { id: `fatiha-${r.id}`, name: `الفاتحة برواية ${r.name}`, sub: r.reciter, url: r.url }]))
);
for (const n of NASHEEDS.filter((x) => x.url)) tracks.set(`nasheed-${n.id}`, { ...n, id: `nasheed-${n.id}` });
for (const p of POEMS) if (p.audio) tracks.set(`poem-${p.id}`, { id: `poem-${p.id}`, name: p.title, sub: p.audio.reader || 'إنشاد', url: p.audio.url });

export function render(view) {
  const draw = () => {
    const { status, station } = radioStatus();
    const on = (id) => station?.id === id;
    const live = status === 'playing' || status === 'loading';
    const row = (id, name, sub) => `<button class="au-row ${on(id) ? 'on' : ''}" data-track="${id}">
        <span class="au-btn">${icon(on(id) && live ? 'pause' : 'play', 18)}</span>
        <span class="au-text"><b>${esc(name)}</b><small>${esc(sub)}${on(id) ? ` • ${statusText(status, true)}` : ''}</small></span>
      </button>`;
    const items = [
      ...FATIHA_QIRAAT.flatMap((q) => q.rawis.filter((r) => r.url).map((r) => row(`fatiha-${r.id}`, `الفاتحة برواية ${r.name}`, r.reciter))),
      ...NASHEEDS.map((n) =>
        n.link
          ? `<a class="au-row" href="${n.link}" target="_blank" rel="noopener"><span class="au-btn">${icon('play', 18)}</span><span class="au-text"><b>${esc(n.name)}</b><small>${esc(n.sub)}</small></span></a>`
          : row(`nasheed-${n.id}`, n.name, n.sub)
      ),
      ...POEMS.filter((p) => p.audio).map((p) => row(`poem-${p.id}`, p.title, p.audio.reader ? `بصوت ${p.audio.reader}` : 'إنشاد')),
    ];
    view.innerHTML = `
      ${pageHeader('الصوتيات', { sub: 'تلاوات وأناشيد تستمع إليها' })}
      <section class="card au-sec">${items.join('')}</section>
      ${station?.clip ? `<button class="btn ghost wide" data-stop>${icon('close', 18)} إيقاف</button>` : ''}`;
  };
  draw();
  const off = onRadio(draw);
  view.onclick = (e) => {
    const t = e.target.closest('[data-track]');
    if (t) {
      const { status, station } = radioStatus();
      if (station?.id === t.dataset.track && status !== 'error') return toggle();
      return playTrack(tracks.get(t.dataset.track));
    }
    if (e.target.closest('[data-stop]')) stop();
  };
  return {
    destroy() {
      off();
      view.onclick = null;
    },
  };
}
