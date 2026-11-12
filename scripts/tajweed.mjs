// Writes js/tajweed-data.js: the Quran passages of the adhkar (wird-data.js) in the text of
// DigitalKhatt's old-Madinah mushaf, coloured by its tajweed rules (scripts/tajweed-rules.mjs),
// for display in its font (fonts/oldmadina.woff2).
//
// Usage: node scripts/tajweed.mjs <quran_text_old_madinah.ts> <hafsData_v18.json>
//   the first from https://github.com/DigitalKhatt/digitalkhatt.org (ClientApp/src/app/services),
//   the second the King Fahd Complex text the adhkar verses were generated from; it is used
//   only to find which verses each passage of wird-data.js holds.
// Run it again whenever a Quran passage is added to or changed in js/wird-data.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { SURAHS } from '../js/quran-data.js';
import { AL_IMRAN_END, EVENING, MORNING, SLEEP } from '../js/wird-data.js';
import { TajweedService } from './tajweed-rules.mjs';

const [textPath, hafsPath] = process.argv.slice(2);
if (!textPath || !hafsPath) throw new Error('usage: node scripts/tajweed.mjs <quran_text_old_madinah.ts> <hafsData_v18.json>');

// ---- The mushaf text, line by line (read as data, not run), split into verses ----

const lines = [...readFileSync(textPath, 'utf8').matchAll(/^\s*'(.*)',?\s*$/gm)].map((m) => m[1]);
const digit = (s) => Number([...s].map((d) => d.charCodeAt(0) - 0x660).join(''));
const verses = []; // verses[surah - 1][ayah - 1]
let stream = '';
const flush = () => {
  if (!verses.length) return;
  const out = verses[verses.length - 1];
  for (const m of stream.matchAll(/(.*?)\s*۝([٠-٩]+)\s*/gsu)) {
    if (digit(m[2]) !== out.length + 1) throw new Error(`surah ${verses.length}: verse ${m[2]} out of order`);
    out.push(m[1].trim());
  }
  stream = '';
};
let heading = false; // the line after a surah's title is its basmala (not a verse, but in al-Fatihah)
let basmalas = 0;
for (const line of lines) {
  if (line.startsWith('سُورَةُ ')) {
    flush();
    verses.push([]);
    heading = true;
    continue;
  }
  const basmala = heading && line.startsWith('بِسْمِ ') && !line.includes('۝');
  heading = false;
  if (basmala) basmalas++;
  else stream += line + ' ';
}
if (basmalas !== 112) throw new Error(`found ${basmalas} basmala headings, expected 112`);
flush();
if (verses.length !== 114) throw new Error(`found ${verses.length} surahs`);
verses.forEach((v, i) => {
  if (v.length !== SURAHS[i][2]) throw new Error(`surah ${i + 1}: ${v.length} verses, expected ${SURAHS[i][2]}`);
});
const arabic = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// ---- Which verses each passage of the adhkar holds ----

const hafs = JSON.parse(readFileSync(hafsPath, 'utf8')).map((x) => ({ s: x.sora, a: x.aya_no, text: x.aya_text.trim().replace(/ /g, ' ') }));
const bare = (t) => t.replace(/ [٠-٩]+$/, ''); // a verse without its number
function locate(text) {
  for (let i = 0; i < hafs.length; i++) {
    if (!text.startsWith(bare(hafs[i].text))) continue;
    if (text === bare(hafs[i].text)) return { s: hafs[i].s, from: hafs[i].a, to: hafs[i].a, numbered: false };
    let joined = '';
    for (let j = i; j < hafs.length && hafs[j].s === hafs[i].s; j++) {
      joined += (joined ? ' ' : '') + hafs[j].text;
      if (joined === text) return { s: hafs[i].s, from: hafs[i].a, to: hafs[j].a, numbered: true };
      if (!text.startsWith(joined)) break;
    }
  }
  return null;
}

// ---- Colouring ----

const CLASSES = ['', 'green', 'tafkim', 'lgray', 'lkalkala', 'red1', 'red2', 'red3', 'red4'];
const service = new TajweedService();
// A passage as [class index, text] runs, one class per character as the rules give them.
function colour({ s, from, to, numbered }) {
  let text = '';
  for (let a = from; a <= to; a++) text += `${text ? ' ' : ''}${verses[s - 1][a - 1]} ۝${arabic(a)}`;
  const marks = new Map();
  service.applyTajweedForText(text, (pos, cls) => (cls ? marks.set(pos, cls) : marks.delete(pos)), () => {}, false);
  if (!numbered) text = text.replace(/ ۝[٠-٩]+$/, '');
  const runs = [];
  [...text].forEach((ch, i) => {
    const c = CLASSES.indexOf(marks.get(i) || '');
    if (c < 0) throw new Error(`unknown class ${marks.get(i)}`);
    if (runs.length && runs[runs.length - 1][0] === c) runs[runs.length - 1][1] += ch;
    else runs.push([c, ch]);
  });
  return runs;
}

const passages = {}; // "surah:from-to" → runs
const items = {}; // adhkar item id → passage key
const add = (id, text) => {
  const at = locate(text);
  if (!at) throw new Error(`${id}: verses not found in the mushaf text`);
  const key = `${at.s}:${at.from}-${at.to}${at.numbered ? '' : 'x'}`;
  passages[key] ??= colour(at);
  items[id] = key;
};
for (const x of [...MORNING, ...EVENING, ...SLEEP]) if (x.quran) add(x.id, x.text);
add('waking-4', AL_IMRAN_END);
// The basmala shown above a surah: the one the morning adhkar already hold (1:1, unnumbered).
items.basmala = items[MORNING.find((x) => x.quran && locate(x.text)?.s === 1).id];

writeFileSync(
  new URL('../js/tajweed-data.js', import.meta.url),
  `// Generated by scripts/tajweed.mjs — do not edit. The Quran passages of the adhkar in the text of
// DigitalKhatt's old-Madinah mushaf, as [colour, text] runs (colour is an index into TAJWEED_CLASSES),
// coloured by DigitalKhatt's tajweed rules. Text and rules: MIT License, Copyright (c) 2024 DigitalKhatt.

export const TAJWEED_CLASSES = ${JSON.stringify(CLASSES)};

// "surah:first verse-last verse" (x: shown without its verse number) → runs.
export const TAJWEED_PASSAGES = {
${Object.entries(passages).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}
};

// Adhkar item id → its passage.
export const TAJWEED_ITEMS = ${JSON.stringify(items, null, 2)};
`
);
console.log(`${Object.keys(items).length} items, ${Object.keys(passages).length} passages: ${Object.keys(passages).join('  ')}`);
