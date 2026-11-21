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
for (const n of NASHEEDS) tracks.set(`nasheed-${n.id}`, { ...n, id: `nasheed-${n.id}` });
for (const p of POEMS) if (p.audio) tracks.set(`poem-${p.id}`, { id: `poem-${p.id}`, name: p.title, sub: p.audio.reader || 'إنشاد', url: p.audio.url });

export function render(view) {
  const draw = () => {
    const { status, station } = radioStatus();
    const on = (id) => station?.id === id;
    const live = status === 'playing' || status === 'loading';
    view.innerHTML = `
      ${pageHeader('الصوتيات', { sub: 'تلاوات وقصائد تستمع إليها' })}
      <section class="card au-sec">
        <div class="au-head"><span class="au-ic">${icon('quran', 22)}</span><span><b>سورة الفاتحة بقراءة أبي عمرو البصري</b><small>بروايتي الدوري والسوسي</small></span></div>
        ${FATIHA_QIRAAT.map(
          (q) => `<div class="au-imam">
            ${q.rawis
              .map((r) => {
                const id = `fatiha-${r.id}`;
                if (!r.url) return `<div class="au-row off"><span class="au-btn">${icon('play', 18)}</span><span class="au-text"><b>رواية ${esc(r.name)}</b><small>لا يتوفر تسجيل لهذه الرواية بعد</small></span></div>`;
                const playing = on(id) && live;
                return `<button class="au-row ${on(id) ? 'on' : ''}" data-track="${id}">
                  <span class="au-btn">${icon(playing ? 'pause' : 'play', 18)}</span>
                  <span class="au-text"><b>رواية ${esc(r.name)}</b><small>${esc(r.reciter)}${on(id) ? ` • ${statusText(status, true)}` : ''}</small></span>
                </button>`;
              })
              .join('')}</div>`
        ).join('')}
        <p class="hint">التسجيلات من موقع mp3quran.net، وتحتاج اتصالاً بالإنترنت.</p>
      </section>
      <section class="card au-sec">
        <div class="au-head"><span class="au-ic">${icon('sound', 22)}</span><span><b>أناشيد</b><small>بلا معازف</small></span></div>
        ${NASHEEDS.map((n) => {
          const id = `nasheed-${n.id}`;
          return `<button class="au-row ${on(id) ? 'on' : ''}" data-track="${id}">
            <span class="au-btn">${icon(on(id) && live ? 'pause' : 'play', 18)}</span>
            <span class="au-text"><b>${esc(n.name)}</b><small>${esc(n.sub)}${on(id) ? ` • ${statusText(status, true)}` : ''}</small></span>
          </button>`;
        }).join('')}
      </section>
      ${POEMS.map((p) => {
        const id = `poem-${p.id}`;
        const playing = on(id) && live;
        return `<section class="card au-sec">
        <div class="au-head"><span class="au-ic">${icon('book', 22)}</span><span><b>${esc(p.title)}</b><small>${esc(p.sub)}</small></span></div>
        ${p.audio ? `<button class="au-row ${on(id) ? 'on' : ''}" data-track="${id}">
          <span class="au-btn">${icon(playing ? 'pause' : 'play', 18)}</span>
          <span class="au-text"><b>استمع إلى القصيدة</b><small>${p.audio.reader ? `بصوت ${esc(p.audio.reader)} — ` : 'إنشاد — '}من ${esc(p.audio.from)}${on(id) ? ` • ${statusText(status, true)}` : ''}</small></span>
        </button>` : ''}
        <details class="au-poem"><summary>${icon('chevron', 14)} نص القصيدة</summary>
          <ol class="poem">${p.lines.map(([a, b]) => `<li><span>${esc(a)}</span><span>${esc(b)}</span></li>`).join('')}</ol>
          <a class="q-src" href="${p.url}" target="_blank" rel="noopener">النص من: ${esc(p.src)} ${icon('chevron', 12)}</a>
        </details>
      </section>`;
      }).join('')}
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
