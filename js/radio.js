// Live Quran radio: one shared <audio> element, so playback keeps going while the user
// moves around the app, with lock-screen controls through the Media Session API.

import { state, save } from './store.js';

export const STATIONS = [
  { id: 'saudi', name: 'إذاعة القرآن الكريم', sub: 'المملكة العربية السعودية — بث مباشر', url: 'https://stream.radiojar.com/0tpy1h0kxtzuv' },
  { id: 'tarateel', name: 'تلاوات خاشعة', sub: 'مختارات من القراء', url: 'https://qurango.net/radio/tarateel' },
  { id: 'sudais', name: 'عبدالرحمن السديس', sub: 'إمام الحرم المكي', url: 'https://qurango.net/radio/abdulrahman_alsudaes' },
  { id: 'shuraim', name: 'سعود الشريم', sub: 'إمام الحرم المكي', url: 'https://qurango.net/radio/saud_alshuraim' },
  { id: 'maher', name: 'ماهر المعيقلي', sub: 'إمام الحرم المكي', url: 'https://qurango.net/radio/maher' },
  { id: 'yasser', name: 'ياسر الدوسري', sub: 'إمام الحرم المكي', url: 'https://qurango.net/radio/yasser_aldosari' },
  { id: 'afasy', name: 'مشاري العفاسي', sub: 'تلاوات متواصلة', url: 'https://qurango.net/radio/mishary_alafasi' },
  { id: 'ruqyah', name: 'الرقية الشرعية', sub: 'آيات الرقية متواصلة', url: 'https://qurango.net/radio/roqiah' },
];

export function stationById(id) {
  if (id === 'custom') return { id: 'custom', name: 'محطتي', sub: state.radio.custom, url: state.radio.custom };
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
  if (!st.url) return;
  const a = ensureAudio();
  current = st;
  state.radio.station = st.id;
  save();
  a.src = st.url;
  set('loading');
  a.play().catch(() => set('error'));
  if ('mediaSession' in navigator && window.MediaMetadata) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: st.name,
      artist: st.sub || 'إذاعة القرآن الكريم',
      album: 'أذكار ومواقيت',
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
  // A live stream resumes at the live point, not where it was paused.
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
