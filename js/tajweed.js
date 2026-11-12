// Tajweed colours for the app's Quran passages (js/tajweed-data.js, made by scripts/tajweed.mjs).

import { state } from './store.js';
import { TAJWEED_CLASSES, TAJWEED_ITEMS, TAJWEED_PASSAGES } from './tajweed-data.js';
import { esc } from './ui.js';

// Safari shapes each coloured span on its own: a letter no longer joins the one in the next
// span, and a mark alone at the start of a span has no letter to sit on. So the colours are
// applied letter by letter — a letter and its marks take one colour (the letter's own, or
// else its first coloured mark's) — and where the colour changes between two letters that
// join, a zero-width joiner on each side keeps them in their joined shapes.
const ZWJ = '‍';
const LETTER = /[ء-ؿف-يٮ-ۓ]/; // Arabic letters (without the tatweel)
const JOINS_NEXT = /[ـبتثجحخسشصضطظعغفقكلمنهيئىۀہھیېےٮٯڡڪ]/; // joins the letter after it
const JOINS_PREV = /[ـآ-يٮ-ۓ]/; // joins the letter before it (all but the hamza)
// What starts a new cluster: a letter, a space, a verse or hizb mark, a digit, and the small
// waw and yeh that stand after a letter (they take space of their own).
const isBase = (ch) => LETTER.test(ch) || ch === '\u0640' || ch === ' ' || /[۝۞۩٠-٩\u06E5\u06E6]/.test(ch);

// [colour, text] runs → [colour, text, first letter, last letter] runs with each letter whole.
function byLetters(runs) {
  const clusters = []; // [colour of the base or null, text, base]
  for (const [c, text] of runs) {
    for (const ch of text) {
      if (isBase(ch) || !clusters.length) clusters.push([c, ch, ch, false]);
      else {
        const last = clusters[clusters.length - 1];
        last[1] += ch;
        // An uncoloured letter takes the colour of its first coloured mark.
        if (!last[0] && c && !last[3]) [last[0], last[3]] = [c, true];
      }
    }
  }
  const out = [];
  for (const [c, text, base] of clusters) {
    const last = out[out.length - 1];
    if (last && last[0] === c) [last[1], last[3]] = [last[1] + text, base];
    else out.push([c, text, base, base]);
  }
  return out;
}

// The passage of an adhkar item (by its id), of the verse of the day («ayah-<n>») or the
// basmala («basmala») as HTML with a span for each colour; null when it has none or the
// colours are switched off, and the verses then show plainly in the Complex's font.
export function tajweedHtml(id) {
  const runs = state.settings.tajweed && TAJWEED_PASSAGES[TAJWEED_ITEMS[id]];
  if (!runs) return null;
  const parts = byLetters(runs);
  return parts
    .map(([c, text, , lastBase], i) => {
      const next = parts[i + 1];
      const prev = parts[i - 1];
      const joinAfter = next && JOINS_NEXT.test(lastBase) && JOINS_PREV.test(next[2]);
      const joinBefore = prev && JOINS_NEXT.test(prev[3]) && JOINS_PREV.test(parts[i][2]);
      const body = `${joinBefore ? ZWJ : ''}${esc(text)}${joinAfter ? ZWJ : ''}`;
      return c ? `<span class="tj-${TAJWEED_CLASSES[c]}">${body}</span>` : body;
    })
    .join('');
}
