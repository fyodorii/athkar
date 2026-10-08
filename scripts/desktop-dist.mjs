// Copies the app's files into desktop/dist for the Windows build (Tauri bundles that
// folder into the exe). The server scripts (push/) and the repository tooling stay out.
//
// Run by `npm run build` in desktop/ (tauri.conf.json → beforeBuildCommand).
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIST = join(ROOT, 'desktop', 'dist');
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
for (const name of ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'fonts', 'icons', 'js']) {
  cpSync(join(ROOT, name), join(DIST, name), { recursive: true });
}
console.log('desktop/dist ready');
