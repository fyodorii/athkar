// Sign in with Google, and the user's data kept in their own Google Drive (the app's hidden
// folder, which only this app can see), so it can be restored on another device.
//
// The app has no server, so it uses Google's OAuth for browser apps: the page goes to Google's
// sign-in and comes back with an access token in the address (#access_token=…), which works in
// a home-screen app on the iPhone where pop-up windows do not. The token lasts about an hour;
// after that the next save asks Google again (without a prompt once the user has agreed).
// It needs an OAuth client ID (GOOGLE_CLIENT_ID in js/config.js) whose authorised JavaScript
// origins and redirect URIs include the app's address; without one the feature says so.
//
// So that the backup keeps going on its own, the app's server (push/worker.js, at PUSH_URL) can
// keep the sign-in: when it is set up (it holds the client's secret), the sign-in asks Google for
// a code instead, the server turns it into a lasting sign-in, and the app asks it for a fresh hour
// whenever the last one has run out. The app keeps only a random key for that (`gkey`).

import { GOOGLE_CLIENT_ID, PUSH_URL } from './config.js';
import { exportData, importData, onChange } from './store.js';

const KEY = 'adhkar-app:google'; // kept apart from the app's data, so never in a backup
const FILE = 'mogait-backup.json';
const SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com';

export const googleReady = () => !!GOOGLE_CLIENT_ID;

// { email, name, picture, token, expires, auto, savedAt, fileId } or {}.
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}
let account = load();
function keep(patch) {
  account = { ...account, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(account));
  } catch (e) {
    /* private mode: kept in memory */
  }
}
export const googleAccount = () => account;
const hasToken = () => account.token && account.expires > Date.now() + 60000;

const redirectUri = () => location.origin + location.pathname;

// Whether the server keeps sign-ins (it has the client's secret); asked once per launch.
let serverReady = null;
export async function lastingReady() {
  if (serverReady !== null) return serverReady;
  try {
    serverReady = !!(PUSH_URL && (await (await fetch(`${PUSH_URL}/google/ready`)).json()).ready);
  } catch (e) {
    serverReady = false;
  }
  return serverReady;
}
const server = async (path, body) => {
  const res = await fetch(`${PUSH_URL}/google/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'server'), { status: res.status });
  return data;
};

// A valid token: the one held, or a fresh one from the server. False when signing in again is needed.
export async function ensureToken() {
  if (hasToken()) return true;
  if (!account.gkey) return false;
  try {
    const t = await server('refresh', { key: account.gkey });
    keep({ token: t.access_token, expires: Date.now() + t.expires_in * 1000 });
    return true;
  } catch (e) {
    if (e.status === 401) keep({ gkey: '' }); // the lasting sign-in was withdrawn
    return false;
  }
}

// Goes to Google's sign-in; the app opens again at `back` when it returns.
export async function signIn(back = location.hash || '#/home', silent = false) {
  const lasting = !silent && (await lastingReady());
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  try {
    localStorage.setItem(`${KEY}:state`, JSON.stringify({ nonce, back }));
  } catch (e) {
    /* the check on return then fails safely */
  }
  const q = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: lasting ? 'code' : 'token',
    scope: SCOPE,
    include_granted_scopes: 'true',
    state: nonce,
    // A lasting sign-in: Google gives its refresh token only with «offline» and the consent shown.
    ...(lasting ? { access_type: 'offline', prompt: 'consent select_account' } : { prompt: silent ? 'none' : 'select_account' }),
    ...(account.email ? { login_hint: account.email } : {}),
  });
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
}

// On start: takes the token Google put in the address, before the app reads it as a route.
// Returns the route to open, or null when the address is not Google's answer.
export function takeRedirect() {
  // A lasting sign-in comes back with ?code=… (in the query); the hour's token with #access_token=….
  const query = new URLSearchParams(location.search);
  const coded = query.has('code') || (query.has('error') && query.has('state'));
  const h = location.hash.slice(1);
  if (!coded && !/(^|&)(access_token|error)=/.test(h)) return null;
  const p = coded ? query : new URLSearchParams(h);
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(`${KEY}:state`) || '{}');
    localStorage.removeItem(`${KEY}:state`);
  } catch (e) {
    /* nothing saved */
  }
  const back = /^#\/[\w/-]*$/.test(saved.back || '') ? saved.back : '#/settings/account';
  if (p.get('state') !== saved.nonce) return { back, error: 'تعذّر التحقق من الدخول، حاول مرة أخرى' };
  if (p.get('error')) return { back, error: p.get('error') === 'access_denied' ? 'لم يُسمح بالدخول' : 'تعذّر الدخول بحساب Google' };
  if (coded) keep({ code: p.get('code'), fresh: true });
  else keep({ token: p.get('access_token'), expires: Date.now() + Number(p.get('expires_in') || 3600) * 1000, fresh: true });
  return { back };
}

async function call(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { Authorization: `Bearer ${account.token}`, ...(opts.headers || {}) } });
  if (res.status === 401) {
    keep({ token: '', expires: 0 });
    throw Object.assign(new Error('انتهت جلسة Google، سجّل الدخول مرة أخرى'), { expired: true });
  }
  if (!res.ok) throw new Error('تعذّر الاتصال بـ Google Drive');
  return res;
}

// After returning from Google: who signed in, and whether Drive already holds a copy.
export async function finishSignIn() {
  if (account.fresh && account.code) {
    // The server turns the code into the hour's token and the key for the hours after.
    const code = account.code;
    keep({ code: '' });
    const t = await server('exchange', { code, redirect_uri: redirectUri() });
    keep({ token: t.access_token, expires: Date.now() + t.expires_in * 1000, gkey: t.key || account.gkey || '' });
  }
  if (!account.fresh || !hasToken()) return null;
  const me = await (await call('/oauth2/v3/userinfo')).json();
  keep({ fresh: false, email: me.email || '', name: me.name || '', picture: me.picture || '', auto: account.auto ?? true });
  return remoteFile();
}

// The copy in Drive: { id, modifiedTime } or null.
export async function remoteFile() {
  const q = encodeURIComponent(`name='${FILE}'`);
  const { files = [] } = await (await call(`/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`)).json();
  if (files[0]) keep({ fileId: files[0].id });
  return files[0] || null;
}

// Saves the app's data to Drive (replacing the copy there).
export async function saveToDrive() {
  if (!(await ensureToken())) throw Object.assign(new Error('سجّل الدخول بحساب Google أولاً'), { expired: true });
  const body = exportData();
  const file = account.fileId ? { id: account.fileId } : await remoteFile();
  if (file) {
    await call(`/upload/drive/v3/files/${file.id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  } else {
    // Drive's multipart upload: the file's details, then its content, as multipart/related.
    const b = `mogait${Date.now().toString(36)}`;
    const meta = JSON.stringify({ name: FILE, parents: ['appDataFolder'] });
    const parts = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${body}\r\n--${b}--`;
    const made = await (
      await call('/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${b}` }, body: parts })
    ).json();
    keep({ fileId: made.id });
  }
  keep({ savedAt: Date.now() });
}

// Replaces the app's data with the copy in Drive.
export async function restoreFromDrive() {
  if (!(await ensureToken())) throw Object.assign(new Error('سجّل الدخول بحساب Google أولاً'), { expired: true });
  const file = await remoteFile();
  if (!file) throw new Error('لا توجد نسخة محفوظة في حسابك بعد');
  importData(await (await call(`/drive/v3/files/${file.id}?alt=media`)).text());
  keep({ savedAt: Date.now() });
}

export async function signOut() {
  const token = account.token;
  if (account.gkey) server('forget', { key: account.gkey }).catch(() => {});
  account = {};
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* nothing kept */
  }
  if (token) fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => {});
}

export function setAuto(on) {
  keep({ auto: on });
}

// Saves on its own a few seconds after each change: with a lasting sign-in always, otherwise while
// the hour's sign-in is valid (then the account page offers to sign in again).
let timer;
let saving = false;
onChange(() => {
  if (!account.auto || !account.email || !(hasToken() || account.gkey) || saving) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    saving = true;
    try {
      await saveToDrive();
    } catch (e) {
      /* tried again on the next change */
    }
    saving = false;
  }, 8000);
});
