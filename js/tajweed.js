// Tajweed colours for the app's Quran passages (js/tajweed-data.js, made by scripts/tajweed.mjs).
//
// A coloured span is shaped on its own in Safari, so a letter no longer joins its neighbours
// across a change of colour. Here a passage stays one unbroken text, shaped whole, and the
// colours are painted over ranges of it with the CSS Custom Highlight API (Safari 17.2+,
// Chrome 105+), which colours text without splitting it. Where that API is missing the verses
// show uncoloured, still joined.

import { state } from './store.js';
import { TAJWEED_CLASSES, TAJWEED_ITEMS, TAJWEED_PASSAGES } from './tajweed-data.js';
import { esc } from './ui.js';

const supported = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight === 'function';

// The passage of an adhkar item (by its id), of the verse of the day («ayah-<n>») or the
// basmala («basmala») as one text in the mushaf font, marked for paintTajweed(); null when it
// has none or the colours are switched off, and the verses then show in the Complex's font.
export function tajweedHtml(id) {
  const runs = state.settings.tajweed && TAJWEED_PASSAGES[TAJWEED_ITEMS[id]];
  return runs ? `<span class="madina" data-tj="${esc(id)}">${esc(runs.map((r) => r[1]).join(''))}</span>` : null;
}

// Paints the colours of every passage now in the page (called after each change to the view).
export function paintTajweed() {
  if (!supported) return;
  const ranges = {};
  for (const el of document.querySelectorAll('[data-tj]')) {
    const runs = TAJWEED_PASSAGES[TAJWEED_ITEMS[el.dataset.tj]];
    const node = el.firstChild;
    if (!runs || !node || node.nodeType !== 3) continue;
    let at = 0;
    for (const [c, text] of runs) {
      if (c && at + text.length <= node.length) {
        const r = new Range();
        r.setStart(node, at);
        r.setEnd(node, at + text.length);
        (ranges[c] ??= []).push(r);
      }
      at += text.length;
    }
  }
  TAJWEED_CLASSES.forEach((name, c) => {
    if (c) CSS.highlights.set(`tj-${name}`, new Highlight(...(ranges[c] || [])));
  });
}
