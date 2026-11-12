// Brings every Quran passage in the app to the King Fahd Complex's text in the file given:
// the verses of the adhkar (js/wird-data.js), the verses of the day (js/daily-data.js) and the
// verse on the qailulah page (js/views/tools.js).
//
// Usage: node scripts/mushaf.mjs "<UthmanicHafs_v2-0 data/hafsData_v2-0.json>" [<older hafsData.json> …]
//   The first file is the Complex's text to use (UthmanicHafs_v2-0.zip from qurancomplex.gov.sa,
//   «منصة مطوري برمجيات القرآن الكريم»); the others are the texts the passages may be in now
//   (hafsData_v18.json), used only to find them. A passage is whole words of consecutive verses,
//   with or without the verse numbers; it is found by its words and rewritten word for word.
//   The verse numbers become the Complex's verse marks (one character each, drawn by its font),
//   joined to the verse as in its text.
import { readFileSync, writeFileSync } from 'node:fs';

const [target, ...older] = process.argv.slice(2);
if (!target) throw new Error('usage: node scripts/mushaf.mjs <hafsData_v2-0.json> [<hafsData_v18.json> …]');

const read = (path) => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const toWords = (text) => text.replace(/\u00A0/g, ' ').trim().split(/\s+/);
// A verse number: digits (older texts) or the Complex's verse-mark character.
const isNumber = (w) => /^[٠-٩0-9]+$/.test(w) || /^[\uFC00-\uFDFF]$/.test(w);
// Words compare without the tatweel (the 2.0 text drops one in «كلا») and with the marks on
// each letter in any order (a verse typed by hand may put the shadda after its vowel).
const key = (w) =>
  w
    .replace(/\u0640/g, '')
    .match(/\P{M}\p{M}*/gu)
    .map((c) => c[0] + [...c.slice(1)].sort().join(''))
    .join('');

const verses = (data) => data.map((x) => ({ s: x.sura_no ?? x.sora, a: x.aya_no, words: toWords(x.aya_text).filter((w) => !isNumber(w)) }));
const NEW = verses(read(target));
// Each verse's mark with the space before it, as the Complex writes it (a no-break space, or in
// a few verses a plain one).
const MARK = read(target).map((x) => x.aya_text.trimEnd().slice(-2));
const TEXTS = [NEW, ...older.map((p) => verses(read(p)))];
for (const t of TEXTS) if (t.length !== NEW.length || t.some((v, i) => v.words.length !== NEW[i].words.length)) throw new Error('the texts do not divide into the same words');

// The passage as the target text has it, or null when it is not a passage of the Quran.
function convert(text) {
  const want = toWords(text);
  const first = want.findIndex((w) => !isNumber(w));
  if (first < 0) return null;
  for (const src of TEXTS) {
    for (let i = 0; i < src.length; i++) {
      for (let w = 0; w < src[i].words.length; w++) {
        if (key(src[i].words[w]) !== key(want[first])) continue;
        // Follow the passage word by word, through the following verses of the surah.
        let [v, k, n] = [i, w, first];
        const out = [];
        while (n < want.length) {
          if (isNumber(want[n])) {
            if (k !== 0 || v === i) break; // a number only where a verse has just ended
            out[out.length - 1] += MARK[v - 1];
            n++;
            continue;
          }
          if (v >= src.length || src[v].s !== src[i].s || key(src[v].words[k]) !== key(want[n])) break;
          // The hizb sign ۞ is a word of its own, held to the next by a no-break space.
          if (out.at(-1) === '۞') out[out.length - 1] += '\u00A0' + NEW[v].words[k];
          else out.push(NEW[v].words[k]);
          n++;
          if (++k === src[v].words.length) [v, k] = [v + 1, 0];
        }
        if (n === want.length) return { text: out.join(' '), at: `${src[i].s}:${src[i].a}` };
      }
    }
  }
  return null;
}

// Rewrites the passages of a file: every string literal (in "…", '…' or ﴿…﴾ there) that is one.
function rewrite(path, pick) {
  let src = readFileSync(path, 'utf8');
  let changed = 0;
  const found = [];
  src = src.replace(pick, (whole, open, body, close) => {
    const raw = open === '"' ? JSON.parse(`"${body}"`) : body;
    const c = /[\u06E1\u0671]/.test(raw) ? convert(raw) : null; // only Uthmani text (sukun ۡ or wasla ٱ)
    if (!c) return whole;
    found.push(c.at);
    if (c.text === raw) return whole;
    changed++;
    const enc = open === '"' ? JSON.stringify(c.text).slice(1, -1) : c.text;
    return `${open}${enc}${close}`;
  });
  writeFileSync(path, src);
  console.log(`${path}: ${found.length} passages (${changed} rewritten): ${found.join(' ')}`);
  return found.length;
}

const root = new URL('../', import.meta.url);
rewrite(new URL('js/wird-data.js', root), /(")((?:[^"\\\n]|\\.)*)(")/g);
rewrite(new URL('js/daily-data.js', root), /(")((?:[^"\\\n]|\\.)*)(")/g);
rewrite(new URL('js/views/tools.js', root), /(﴿)([^﴾]*)(﴾)/g);
