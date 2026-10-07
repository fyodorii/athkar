// Packs the app into adhkar-web-app.zip for upload to the site. The app needs no build
// step; the zip holds its files under adhkar/ (the folder it is served from), minus this
// repository's own tooling and the server data (push/data keeps only its .htaccess and
// index.html guards, so keys and subscribers on the site are never overwritten).
//
// Usage: npm run zip   (Node 22 or newer)
import { readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { files, writeZip } from './zip.mjs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const ZIP = join(ROOT, 'adhkar-web-app.zip');
const SKIP = /^(\.git|\.github|scripts|node_modules)(\/|$)|^(package\.json|package-lock\.json|\.gitignore|adhkar-web-app\.zip)$/;

const entries = files(ROOT)
  .map((file) => ({ file, rel: relative(ROOT, file).split(sep).join('/') }))
  .filter(({ rel }) => !SKIP.test(rel) && !/^push\/data\/(?!\.htaccess$|index\.html$)/.test(rel))
  .sort((a, b) => a.rel.localeCompare(b.rel))
  .map(({ file, rel }) => ({ name: 'adhkar/' + rel, data: readFileSync(file) }));
writeZip(ZIP, entries);
console.log(`adhkar-web-app.zip: ${Math.round(statSync(ZIP).size / 1024)} KB, ${entries.length} files`);
