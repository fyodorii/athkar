// Deploys the push Worker to a Cloudflare account through the Cloudflare API:
//   node push/deploy.mjs <path to the VAPID private key JWK file>
// Needs CF_API_TOKEN (Workers Scripts: Edit, D1: Edit, Account Settings: Read). Creates the D1
// database if missing, uploads push/worker.js with its bindings, runs it every minute, turns on
// its workers.dev address and prints it. The VAPID public key is taken from the private JWK.
import { readFileSync } from 'node:fs';

const NAME = 'mawaqit-push';
const API = 'https://api.cloudflare.com/client/v4';
const token = process.env.CF_API_TOKEN;
if (!token) throw new Error('CF_API_TOKEN is missing');
const jwk = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const pub = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]).toString('base64url');

async function cf(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...opts.headers } });
  const data = await res.json().catch(() => ({}));
  if (!data.success) throw new Error(`${opts.method || 'GET'} ${path}: ${res.status} ${JSON.stringify(data.errors || data)}`);
  return data.result;
}

const accounts = await cf('/accounts');
const account = accounts[0];
console.log('account:', account.name);
const A = `/accounts/${account.id}`;

const dbs = await cf(`${A}/d1/database?name=${NAME}`);
const db = dbs.find((d) => d.name === NAME) || (await cf(`${A}/d1/database`, { method: 'POST', body: JSON.stringify({ name: NAME }) }));
console.log('database:', db.uuid);

const form = new FormData();
form.append('metadata', JSON.stringify({
  main_module: 'worker.js',
  compatibility_date: '2025-01-01',
  bindings: [
    { type: 'd1', name: 'DB', id: db.uuid },
    { type: 'plain_text', name: 'VAPID_PUBLIC', text: pub },
    { type: 'secret_text', name: 'VAPID_PRIVATE_JWK', text: JSON.stringify(jwk) },
  ],
}));
form.append('worker.js', new Blob([readFileSync(new URL('./worker.js', import.meta.url))], { type: 'application/javascript+module' }), 'worker.js');
await cf(`${A}/workers/scripts/${NAME}`, { method: 'PUT', body: form });
console.log('script uploaded');

await cf(`${A}/workers/scripts/${NAME}/schedules`, { method: 'PUT', body: JSON.stringify([{ cron: '* * * * *' }]) });
console.log('runs every minute');

let sub;
try {
  sub = (await cf(`${A}/workers/subdomain`)).subdomain;
} catch (e) {
  throw new Error('This account has no workers.dev subdomain yet: open Workers & Pages once in the Cloudflare dashboard, then run again.');
}
await cf(`${A}/workers/scripts/${NAME}/subdomain`, { method: 'POST', body: JSON.stringify({ enabled: true, previews_enabled: false }) });
console.log('URL:', `https://${NAME}.${sub}.workers.dev`);
console.log('VAPID public key:', pub);
