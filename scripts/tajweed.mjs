// Writes js/tajweed-data.js: the Quran passages of the adhkar and the verses of the day in the text of
// DigitalKhatt's old-Madinah mushaf, coloured by its tajweed rules (scripts/tajweed-rules.mjs),
// for display in its font (fonts/oldmadina.woff2).
//
// Usage: node scripts/tajweed.mjs <quran_text_old_madinah.ts> <hafsData_v18.json>
//   the first from https://github.com/DigitalKhatt/digitalkhatt.org (ClientApp/src/app/services),
//   the second the King Fahd Complex text the app's verses were generated from; it is used
//   only to find which words of the mushaf each passage holds.
// Run it again whenever a Quran passage is added to or changed in js/wird-data.js, js/adhkar-data.js
// or the AYAT of js/daily-data.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { SURAHS } from '../js/quran-data.js';
import { CATEGORIES } from '../js/adhkar-data.js';
import { AYAT } from '../js/daily-data.js';
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

// ---- Which words of the mushaf each passage holds ----

// A passage of the app is whole words of consecutive verses in the Complex's text (a verse, part
// of one, or several, with or without the verse numbers). The two texts spell differently but
// divide into the same words, so a passage is found by its words in the Complex's text and
// then taken, word for word, from the mushaf text. (The hizb mark ۞ stands alone there and is
// joined to its word here; it is left out of the count.)
const words = (t) => t.trim().split(/\s+/).filter((w) => w !== '۞');
const hafs = JSON.parse(readFileSync(hafsPath, 'utf8')).map((x) => {
  const all = words(x.aya_text.replace(/ /g, ' '));
  return { s: x.sora, a: x.aya_no, words: all }; // the last word is the verse number
});
function locate(text) {
  const want = words(text);
  for (let i = 0; i < hafs.length; i++) {
    for (let w = hafs[i].words.indexOf(want[0]); w >= 0; w = hafs[i].words.indexOf(want[0], w + 1)) {
      // Follow the words on from here, through the following verses of the surah.
      let [j, k, n] = [i, w, 0];
      while (n < want.length && j < hafs.length && hafs[j].s === hafs[i].s && hafs[j].words[k] === want[n]) {
        n++;
        if (++k === hafs[j].words.length) [j, k] = [j + 1, 0];
      }
      if (n === want.length) return { s: hafs[i].s, from: hafs[i].a, word: w, count: n, to: k === 0 ? hafs[j - 1].a : hafs[j].a };
    }
  }
  return null;
}

// ---- Colouring ----

const CLASSES = ['', 'green', 'tafkim', 'lgray', 'lkalkala', 'red1', 'red2', 'red3', 'red4'];
const service = new TajweedService();
// A passage as [class index, text] runs, one class per character as the rules give them. The
// rules run over its verses whole, so that a part of a verse is coloured as it is in its place.
function colour({ s, from, to, word, count }) {
  let text = '';
  for (let a = from; a <= to; a++) {
    const verse = verses[s - 1][a - 1];
    const complex = hafs.find((x) => x.s === s && x.a === a).words.length - 1;
    if (words(verse).length !== complex) throw new Error(`${s}:${a}: ${words(verse).length} words here, ${complex} in the Complex's text`);
    text += `${text ? ' ' : ''}${verse} ۝${arabic(a)}`;
  }
  const marks = new Map();
  service.applyTajweedForText(text, (pos, cls) => (cls ? marks.set(pos, cls) : marks.delete(pos)), () => {}, false);
  // The characters of the wanted words: from the start of word `word` for `count` words.
  const chars = [...text];
  const starts = [];
  chars.forEach((ch, i) => {
    if (ch !== ' ' && (i === 0 || chars[i - 1] === ' ')) starts.push(i);
  });
  const begin = starts[word];
  const end = word + count < starts.length ? starts[word + count] - 1 : chars.length;
  const runs = [];
  for (let i = begin; i < end; i++) {
    const c = CLASSES.indexOf(marks.get(i) || '');
    if (c < 0) throw new Error(`unknown class ${marks.get(i)}`);
    if (runs.length && runs[runs.length - 1][0] === c) runs[runs.length - 1][1] += chars[i];
    else runs.push([c, chars[i]]);
  }
  return runs;
}

const passages = {}; // "surah:verse.word+count" → runs
const items = {}; // item id → passage key
const add = (id, text) => {
  const at = locate(text);
  if (!at) throw new Error(`${id}: words not found in the mushaf text`);
  const key = `${at.s}:${at.from}.${at.word}+${at.count}`;
  passages[key] ??= colour(at);
  items[id] = key;
};
// The verses of the adhkar, by item id; the verse of the day, by its place in AYAT.
for (const c of CATEGORIES) for (const x of c.items) if (x.quran) add(x.id, x.text);
AYAT.forEach(([text], i) => add(`ayah-${i}`, text));
// The basmala shown above a surah: the one the morning adhkar already hold (al-Fatihah 1, unnumbered).
if (!passages['1:1.0+4']) throw new Error('the basmala is not among the adhkar');
items.basmala = '1:1.0+4';

writeFileSync(
  new URL('../js/tajweed-data.js', import.meta.url),
  `// Generated by scripts/tajweed.mjs — do not edit. The Quran passages of the adhkar and the verses of the day in the text of
// DigitalKhatt's old-Madinah mushaf, as [colour, text] runs (colour is an index into TAJWEED_CLASSES),
// coloured by DigitalKhatt's tajweed rules. Text and rules: MIT License, Copyright (c) 2024 DigitalKhatt.

export const TAJWEED_CLASSES = ${JSON.stringify(CLASSES)};

// "surah:verse.first word+number of words" → runs.
export const TAJWEED_PASSAGES = {
${Object.entries(passages).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}
};

// Adhkar item id, or ayah-<place in AYAT of daily-data.js>, → its passage.
export const TAJWEED_ITEMS = ${JSON.stringify(items, null, 2)};
`
);
console.log(`${Object.keys(items).length} items, ${Object.keys(passages).length} passages: ${Object.keys(passages).join('  ')}`);
