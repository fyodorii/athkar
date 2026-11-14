// Live Quran radio, and the recordings of «الصوتيات»: one shared <audio> element, so playback keeps going while the user
// moves around the app, with lock-screen controls through the Media Session API.

import { state, save } from './store.js';

export const STATIONS = [
  { id: 'saudi', name: 'إذاعة القرآن الكريم', sub: 'المملكة العربية السعودية — بث مباشر', url: 'https://stream.radiojar.com/0tpy1h0kxtzuv' },
  // HLS from the Saudi Broadcasting Authority; Safari on the iPhone plays it in an <audio> element.
  { id: 'nidaa', name: 'إذاعة نداء الإسلام', sub: 'من مكة المكرمة — بث مباشر', url: 'https://live.kwikmotion.com/sbrksanedaradiolive/srpksanedaradio/playlist.m3u8' },
];

export function stationById(id) {
  return STATIONS.find((s) => s.id === id) || STATIONS[0];
}

let audio;
let status = 'stopped'; // stopped | loading | playing | paused | error
let current = null;
const listeners = new Set();

export const radioStatus = () => ({ status, station: current });
export function onRadio(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function set(s) {
  status = s;
  for (const fn of listeners) fn();
}

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'none';
  audio.addEventListener('playing', () => set('playing'));
  audio.addEventListener('waiting', () => status !== 'paused' && set('loading'));
  audio.addEventListener('pause', () => status !== 'stopped' && set('paused'));
  audio.addEventListener('error', () => status !== 'stopped' && set('error'));
  audio.addEventListener('ended', () => current?.clip && stop()); // a recording ends; a live stream does not
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => resume());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('stop', () => stop());
  }
  return audio;
}

// Must start from a tap: browsers only allow sound after a user gesture.
export function play(id) {
  const st = stationById(id);
  state.radio.station = st.id;
  save();
  start(st);
}

// A recording ({ id, name, sub, url }), played to its end in the same player.
export function playTrack(track) {
  start({ ...track, clip: true });
}

function start(st) {
  if (!st.url) return;
  const a = ensureAudio();
  current = st;
  a.src = st.url;
  set('loading');
  a.play().catch(() => set('error'));
  if ('mediaSession' in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: st.name,
      artist: st.sub || (st.clip ? 'الصوتيات' : 'إذاعة القرآن الكريم'),
      album: 'مواقيت',
      artwork: [{ src: new URL('icons/icon-512.png', location.href).href, sizes: '512x512', type: 'image/png' }],
    });
  }
}

export function pause() {
  if (!audio) return;
  audio.pause();
  set('paused');
}

export function resume() {
  if (!audio || !current) return;
  // A recording goes on where it was paused; a live stream resumes at the live point.
  if (current.clip) {
    set('loading');
    return audio.play().catch(() => set('error'));
  }
  audio.src = current.url;
  set('loading');
  audio.play().catch(() => set('error'));
}

export function stop() {
  if (!audio) return;
  set('stopped');
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  current = null;
  for (const fn of listeners) fn();
}

export function toggle() {
  if (status === 'playing' || status === 'loading') pause();
  else resume();
}
