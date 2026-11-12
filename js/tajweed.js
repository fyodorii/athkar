// Tajweed colours for the app's Quran passages (js/tajweed-data.js, made by scripts/tajweed.mjs).

import { state } from './store.js';
import { TAJWEED_CLASSES, TAJWEED_ITEMS, TAJWEED_PASSAGES } from './tajweed-data.js';
import { esc } from './ui.js';

// The passage of an adhkar item (by its id), of the verse of the day («ayah-<n>») or the
// basmala («basmala») as HTML with a span for each colour; null when it has none or the
// colours are switched off, and the verses then show plainly in the Complex's font.
export function tajweedHtml(id) {
  const runs = state.settings.tajweed && TAJWEED_PASSAGES[TAJWEED_ITEMS[id]];
  return runs ? runs.map(([c, text]) => (c ? `<span class="tj-${TAJWEED_CLASSES[c]}">${esc(text)}</span>` : esc(text))).join('') : null;
}
