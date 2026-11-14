// The push server of «مواقيت»: a Cloudflare Worker that sends the app's reminders as Web Push
// notifications, so they arrive while the app is closed.
//
// The app knows the reminders (it computes the prayer times on the phone); every time it opens it
// sends the next days' reminders here (POST /sync). Once a minute (the cron trigger) the Worker
// sends those that are due. It stores only what it needs for that: the push subscription (an
// address at Apple's or Google's push service) and the reminders' times and texts — no names, no
// location.
//
// Bindings: DB (a D1 database), VAPID_PUBLIC (text), VAPID_PRIVATE_JWK (secret, the private key as
// a JWK). Deployed with push/deploy.mjs.

const ORIGINS = ['https://fyodorii.github.io', 'http://localhost:8765'];
const MAX_EVENTS = 400; // per subscription: about a week of reminders
const LATE = 10 * 60000; // a reminder is still sent this long after its time (a missed cron run)
const SUBJECT = 'https://fyodorii.github.io/athkar/';

let ready = false;
async function schema(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS subs (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, updated INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS events (sub TEXT NOT NULL, eid TEXT NOT NULL, at INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (sub, eid))'),
    db.prepare('CREATE INDEX IF NOT EXISTS events_at ON events (at)'),
  ]);
  ready = true;
}

// ---- Base64url and bytes ----

const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) out.set(p, (i += p.length) - p.length);
  return out;
};
const sha256hex = async (text) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');

// ---- Web Push: the message encryption (RFC 8291, aes128gcm) and the VAPID signature (RFC 8292) ----

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

export async function encrypt(payload, p256dh, auth) {
  const uaPublic = unb64u(p256dh);
  const authSecret = unb64u(auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(payload), new Uint8Array([2])); // one record, the last
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const header = new Uint8Array(21);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, cipher);
}

let signingKey;
export async function vapidHeader(endpoint, env, now = Date.now()) {
  signingKey ??= await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: SUBJECT })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

async function send(sub, payload, env) {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint, env),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'high',
    },
    body: await encrypt(payload, sub.p256dh, sub.auth),
  });
  return res.status;
}

// ---- HTTP: the app sends its reminders ----

function cors(req) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}
const reply = (req, status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } });

const text = (x, max) => String(x ?? '').slice(0, max);

async function sync(req, env) {
  const body = await req.json().catch(() => null);
  const s = body?.subscription;
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth || !/^https:\/\//.test(s.endpoint)) return reply(req, 400, { error: 'subscription' });
  const id = await sha256hex(s.endpoint);
  const now = Date.now();
  const events = (Array.isArray(body.events) ? body.events : [])
    .filter((e) => e && Number.isFinite(e.at) && e.at > now - LATE && e.at < now + 15 * 86400000)
    .slice(0, MAX_EVENTS)
    .map((e) => ({ eid: text(e.id, 120), at: Math.round(e.at), payload: JSON.stringify({ title: text(e.title, 120), body: text(e.body, 300), url: text(e.url, 60), tag: text(e.id, 120) }) }));
  const db = env.DB;
  await schema(db);
  await db.batch([
    db.prepare('INSERT INTO subs (id, endpoint, p256dh, auth, updated) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET p256dh = ?3, auth = ?4, updated = ?5').bind(id, s.endpoint, s.keys.p256dh, s.keys.auth, now),
    db.prepare('DELETE FROM events WHERE sub = ?1').bind(id),
    ...events.map((e) => db.prepare('INSERT OR REPLACE INTO events (sub, eid, at, payload) VALUES (?1, ?2, ?3, ?4)').bind(id, e.eid, e.at, e.payload)),
  ]);
  return reply(req, 200, { ok: true, events: events.length });
}

async function unsubscribe(req, env) {
  const body = await req.json().catch(() => null);
  if (!body?.endpoint) return reply(req, 400, { error: 'endpoint' });
  const id = await sha256hex(body.endpoint);
  await schema(env.DB);
  await env.DB.batch([env.DB.prepare('DELETE FROM events WHERE sub = ?1').bind(id), env.DB.prepare('DELETE FROM subs WHERE id = ?1').bind(id)]);
  return reply(req, 200, { ok: true });
}

// ---- Cron: send what is due ----

async function sendDue(env) {
  const db = env.DB;
  await schema(db);
  const now = Date.now();
  const { results } = await db
    .prepare('SELECT e.sub, e.eid, e.payload, s.endpoint, s.p256dh, s.auth FROM events e JOIN subs s ON s.id = e.sub WHERE e.at <= ?1 AND e.at > ?2 ORDER BY e.at LIMIT 500')
    .bind(now, now - LATE)
    .all();
  const gone = new Set();
  await Promise.all(
    results.map(async (r) => {
      try {
        const status = await send(r, r.payload, env);
        if (status === 404 || status === 410) gone.add(r.sub); // the subscription has ended
      } catch (e) {
        // A network error: this reminder is lost, the next ones are still tried.
      }
    })
  );
  await db.batch([
    db.prepare('DELETE FROM events WHERE at <= ?1').bind(now),
    ...[...gone].flatMap((id) => [db.prepare('DELETE FROM events WHERE sub = ?1').bind(id), db.prepare('DELETE FROM subs WHERE id = ?1').bind(id)]),
    db.prepare('DELETE FROM subs WHERE updated < ?1').bind(now - 30 * 86400000), // not opened for a month
  ]);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const path = new URL(req.url).pathname;
    try {
      if (req.method === 'POST' && path === '/sync') return await sync(req, env);
      if (req.method === 'POST' && path === '/unsubscribe') return await unsubscribe(req, env);
      if (req.method === 'GET' && path === '/') return reply(req, 200, { ok: true, service: 'mawaqit-push' });
    } catch (e) {
      return reply(req, 500, { error: 'server' });
    }
    return reply(req, 404, { error: 'not found' });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDue(env));
  },
};
