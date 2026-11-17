// The push server of «مواقيت»: a Cloudflare Worker that sends the app's reminders as Web Push
// notifications, so they arrive while the app is closed.
//
// The app knows the reminders (it computes the prayer times on the phone); every time it opens it
// sends the next days' reminders here (POST /sync). Once a minute (the cron trigger) the Worker
// sends those that are due. It stores only what it needs for that: the push subscription (an
// address at Apple's or Google's push service) and the reminders' times and texts — no names, no
// location.
//
// It also keeps the app signed in to Google for the Drive backup: Google's sign-in for browser
// apps gives a token for an hour only, so the Worker takes the sign-in's code, keeps the long-lived
// «refresh token» Google gives with it, and hands the app a fresh hour each time it asks (/google/…).
// The app keeps only a random key that finds its refresh token here.
//
// Bindings: DB (a D1 database), VAPID_PUBLIC (text), VAPID_PRIVATE_JWK (secret, the private key as
// a JWK), GOOGLE_CLIENT_ID (text), GOOGLE_CLIENT_SECRET (secret, set by the owner in the Cloudflare
// dashboard). Deployed with push/deploy.mjs.

const ORIGINS = ['https://fyodorii.github.io', 'http://localhost:8765'];
const MAX_EVENTS = 400; // per subscription: about a week of reminders
const EARLY = 20000; // sent this much before its time, to reach the phone at its minute
const LATE = 10 * 60000; // a reminder sent from the app this late is still taken (and cleaned up)
const SUBJECT = 'https://fyodorii.github.io/athkar/';

let ready = false;
async function schema(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS subs (id TEXT PRIMARY KEY, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, updated INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS events (sub TEXT NOT NULL, eid TEXT NOT NULL, at INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY (sub, eid))'),
    db.prepare('CREATE INDEX IF NOT EXISTS events_at ON events (at)'),
    db.prepare('CREATE TABLE IF NOT EXISTS google (id TEXT PRIMARY KEY, refresh TEXT NOT NULL, updated INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS sent (sub TEXT NOT NULL, eid TEXT NOT NULL, at INTEGER NOT NULL, status INTEGER NOT NULL, reason TEXT)'),
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
  if (res.ok) return { status: res.status, reason: '' };
  return { status: res.status, reason: (await res.text().catch(() => '')).slice(0, 200) };
}

// ---- HTTP: the app sends its reminders ----

function cors(req) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
  // Only what changed is written (the free plan counts every row written): the reminders that are
  // new or moved, the ones no longer wanted, and the subscription once in a while.
  const sub = await db.prepare('SELECT p256dh, auth, updated FROM subs WHERE id = ?1').bind(id).first();
  const { results: had } = await db.prepare('SELECT eid, at, payload FROM events WHERE sub = ?1').bind(id).all();
  const old = new Map(had.map((r) => [r.eid, r]));
  const want = new Set(events.map((e) => e.eid));
  const writes = [];
  if (!sub || sub.p256dh !== s.keys.p256dh || sub.auth !== s.keys.auth || now - sub.updated > 86400000) {
    writes.push(db.prepare('INSERT INTO subs (id, endpoint, p256dh, auth, updated) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET p256dh = ?3, auth = ?4, updated = ?5').bind(id, s.endpoint, s.keys.p256dh, s.keys.auth, now));
  }
  for (const r of had) if (!want.has(r.eid) && r.eid !== 'test') writes.push(db.prepare('DELETE FROM events WHERE sub = ?1 AND eid = ?2').bind(id, r.eid)); // a test on its way stays
  for (const e of events) {
    const o = old.get(e.eid);
    if (!o || o.at !== e.at || o.payload !== e.payload) writes.push(db.prepare('INSERT OR REPLACE INTO events (sub, eid, at, payload) VALUES (?1, ?2, ?3, ?4)').bind(id, e.eid, e.at, e.payload));
  }
  if (writes.length) await db.batch(writes);
  return reply(req, 200, { ok: true, events: events.length, written: writes.length });
}

// A test reminder about a minute from now, for a phone the server already knows.
async function test(req, env) {
  const body = await req.json().catch(() => null);
  if (!body?.endpoint) return reply(req, 400, { error: 'endpoint' });
  const id = await sha256hex(body.endpoint);
  await schema(env.DB);
  const known = await env.DB.prepare('SELECT 1 FROM subs WHERE id = ?1').bind(id).first();
  if (!known) return reply(req, 404, { error: 'subscription' });
  const now = Date.now();
  const payload = JSON.stringify({ title: 'مواقيت', body: 'تنبيه تجريبي: التنبيهات تصلك والتطبيق مغلق', url: '#/settings/notify', tag: 'test' });
  await env.DB.prepare('INSERT OR REPLACE INTO events (sub, eid, at, payload) VALUES (?1, ?2, ?3, ?4)').bind(id, 'test', now + 45000, payload).run();
  return reply(req, 200, { ok: true });
}

async function unsubscribe(req, env) {
  const body = await req.json().catch(() => null);
  if (!body?.endpoint) return reply(req, 400, { error: 'endpoint' });
  const id = await sha256hex(body.endpoint);
  await schema(env.DB);
  await env.DB.batch([env.DB.prepare('DELETE FROM events WHERE sub = ?1').bind(id), env.DB.prepare('DELETE FROM subs WHERE id = ?1').bind(id)]);
  return reply(req, 200, { ok: true });
}

// ---- Google: the sign-in that lasts ----

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const googleReady = (env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

async function googleToken(env, params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: String(env.GOOGLE_CLIENT_ID).trim(), client_secret: String(env.GOOGLE_CLIENT_SECRET).trim(), ...params }), // a pasted secret may carry a space or a line break
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// The sign-in's one-time code → an hour's token now, and a key for the hours after.
async function googleExchange(req, env) {
  if (!googleReady(env)) return reply(req, 503, { error: 'not set up' });
  const body = await req.json().catch(() => null);
  if (!body?.code || !/^https:\/\//.test(body.redirect_uri || '')) return reply(req, 400, { error: 'code' });
  const { status, data } = await googleToken(env, { grant_type: 'authorization_code', code: body.code, redirect_uri: body.redirect_uri });
  if (status !== 200 || !data.access_token) return reply(req, 400, { error: data.error || 'exchange' });
  let key = null;
  if (data.refresh_token) {
    key = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await schema(env.DB);
    await env.DB.prepare('INSERT OR REPLACE INTO google (id, refresh, updated) VALUES (?1, ?2, ?3)').bind(await sha256hex(key), data.refresh_token, Date.now()).run();
  }
  return reply(req, 200, { access_token: data.access_token, expires_in: data.expires_in || 3600, key });
}

// A fresh hour for a device that holds its key.
async function googleRefresh(req, env) {
  if (!googleReady(env)) return reply(req, 503, { error: 'not set up' });
  const body = await req.json().catch(() => null);
  if (!body?.key) return reply(req, 400, { error: 'key' });
  await schema(env.DB);
  const id = await sha256hex(body.key);
  const row = await env.DB.prepare('SELECT refresh FROM google WHERE id = ?1').bind(id).first();
  if (!row) return reply(req, 401, { error: 'unknown' });
  const { status, data } = await googleToken(env, { grant_type: 'refresh_token', refresh_token: row.refresh });
  if (status !== 200 || !data.access_token) {
    if (data.error === 'invalid_grant') await env.DB.prepare('DELETE FROM google WHERE id = ?1').bind(id).run(); // access withdrawn
    return reply(req, 401, { error: data.error || 'refresh' });
  }
  await env.DB.prepare('UPDATE google SET updated = ?2 WHERE id = ?1').bind(id, Date.now()).run();
  return reply(req, 200, { access_token: data.access_token, expires_in: data.expires_in || 3600 });
}

// Signing out: the refresh token is withdrawn at Google and forgotten here.
async function googleForget(req, env) {
  const body = await req.json().catch(() => null);
  if (!body?.key) return reply(req, 400, { error: 'key' });
  await schema(env.DB);
  const id = await sha256hex(body.key);
  const row = await env.DB.prepare('SELECT refresh FROM google WHERE id = ?1').bind(id).first();
  if (row) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(row.refresh)}`, { method: 'POST' }).catch(() => {});
    await env.DB.prepare('DELETE FROM google WHERE id = ?1').bind(id).run();
  }
  return reply(req, 200, { ok: true });
}

// ---- Cron: send what is due ----

// Each minute's run sends the reminders of its own minute only (by the time it was scheduled for),
// so a reminder goes out once even when the clean-up below cannot write.
async function sendDue(env, scheduled = Date.now()) {
  const db = env.DB;
  await schema(db);
  const now = Date.now();
  const to = Math.floor(scheduled / 60000) * 60000 + EARLY;
  const { results } = await db
    .prepare('SELECT e.sub, e.eid, e.payload, s.endpoint, s.p256dh, s.auth FROM events e JOIN subs s ON s.id = e.sub WHERE e.at <= ?1 AND e.at > ?2 ORDER BY e.at LIMIT 500')
    .bind(to, to - 60000)
    .all();
  const gone = new Set();
  const log = [];
  await Promise.all(
    results.map(async (r) => {
      try {
        const { status, reason } = await send(r, r.payload, env);
        log.push([r.sub, r.eid, status, reason]);
        if (status === 404 || status === 410) gone.add(r.sub); // the subscription has ended
      } catch (e) {
        log.push([r.sub, r.eid, 0, String(e).slice(0, 200)]); // a network error: this reminder is lost
      }
    })
  );
  await db.batch([
    db.prepare('DELETE FROM events WHERE at <= ?1').bind(to),
    ...[...gone].flatMap((id) => [db.prepare('DELETE FROM events WHERE sub = ?1').bind(id), db.prepare('DELETE FROM subs WHERE id = ?1').bind(id)]),
    db.prepare('DELETE FROM subs WHERE updated < ?1').bind(now - 30 * 86400000), // not opened for a month
    // What the push services answered when they refused, kept for two days to see why a reminder did not arrive.
    ...log.filter(([, , status]) => status < 200 || status >= 300).map(([sub, eid, status, reason]) => db.prepare('INSERT INTO sent (sub, eid, at, status, reason) VALUES (?1, ?2, ?3, ?4, ?5)').bind(sub, eid, now, status, reason)),
    db.prepare('DELETE FROM sent WHERE at < ?1').bind(now - 2 * 86400000),
  ]);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const path = new URL(req.url).pathname;
    try {
      if (req.method === 'POST' && path === '/sync') return await sync(req, env);
      if (req.method === 'POST' && path === '/test') return await test(req, env);
      if (req.method === 'POST' && path === '/unsubscribe') return await unsubscribe(req, env);
      if (req.method === 'POST' && path === '/google/exchange') return await googleExchange(req, env);
      if (req.method === 'POST' && path === '/google/refresh') return await googleRefresh(req, env);
      if (req.method === 'POST' && path === '/google/forget') return await googleForget(req, env);
      if (req.method === 'GET' && path === '/google/ready') return reply(req, 200, { ready: googleReady(env) });
      if (req.method === 'GET' && path === '/') return reply(req, 200, { ok: true, service: 'mawaqit-reminders' });
    } catch (e) {
      return reply(req, 500, { error: 'server' });
    }
    return reply(req, 404, { error: 'not found' });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDue(env, event.scheduledTime));
  },
};
