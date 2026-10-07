// Timers that keep running while the user moves around the app: the qailulah nap, the
// Japanese interval walk and the ten-minute rule. Each is stored as moments in time,
// so a timer is right again the moment the app returns from the background.

import { dayKey } from './prayer.js';
import { save, state } from './store.js';
import { today } from './today.js';
import { haptic, toast } from './ui.js';

export const WALK = { rounds: 5, fast: 180, slow: 180 };

const tools = () => (state.tools ??= {});

// ---- Sound and screen ----

let audio;
export function unlockAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume?.();
  } catch (e) {
    audio = null;
  }
}

export function chime(pattern = [0, 0.3, 0.6]) {
  try {
    if (!audio) return;
    const t0 = audio.currentTime;
    pattern.forEach((d, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = 'sine';
      o.frequency.value = i % 3 === 2 ? 880 : 660;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
      o.connect(g).connect(audio.destination);
      o.start(t0 + d);
      o.stop(t0 + d + 0.3);
    });
  } catch (e) {
    // No sound: the toast still shows.
  }
  haptic(300);
}

// Keeps the screen on while a timer runs (iOS 16.4+), so it can sound on time.
let lock;
export async function keepAwake(on) {
  try {
    if (on && !lock && navigator.wakeLock) lock = await navigator.wakeLock.request('screen');
    if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch (e) {
    lock = null;
  }
}

function markWorship(id) {
  const key = dayKey(today().day);
  (state.worship[key] ??= {})[id] = 1;
}

// ---- Nap ----

export function startNap(minutes) {
  unlockAudio();
  tools().napEnd = Date.now() + minutes * 60000;
  tools().napMinutes = minutes;
  save();
  keepAwake(true);
}
export function stopNap() {
  tools().napEnd = 0;
  save();
  keepAwake(false);
}

// ---- Japanese interval walk: rounds of fast then slow walking ----

export function walkElapsed(w = tools().walk) {
  if (!w) return 0;
  return Math.floor(((w.paused ? w.pausedAt : Date.now()) - w.startedAt) / 1000);
}

export function walkState(w = tools().walk) {
  const total = WALK.rounds * (WALK.fast + WALK.slow);
  const elapsed = Math.min(total, walkElapsed(w));
  const per = WALK.fast + WALK.slow;
  const round = Math.min(WALK.rounds, Math.floor(elapsed / per) + 1);
  const inRound = elapsed - (round - 1) * per;
  const fast = inRound < WALK.fast;
  const left = elapsed >= total ? 0 : fast ? WALK.fast - inRound : per - inRound;
  return { total, elapsed, round, fast, left, done: elapsed >= total, phaseLen: fast ? WALK.fast : WALK.slow };
}

export function startWalk() {
  unlockAudio();
  const w = tools().walk;
  if (w?.paused) {
    w.startedAt += Date.now() - w.pausedAt;
    w.paused = false;
  } else tools().walk = { startedAt: Date.now(), paused: false, phase: 'r1f' };
  save();
  keepAwake(true);
}
export function pauseWalk() {
  const w = tools().walk;
  if (!w || w.paused) return;
  w.paused = true;
  w.pausedAt = Date.now();
  save();
  keepAwake(false);
}
export function resetWalk() {
  tools().walk = null;
  save();
  keepAwake(false);
}

// ---- Ten-minute rule ----

export function startFocus(minutes, task) {
  unlockAudio();
  const t = tools();
  t.focus = { ...(t.focus || {}), end: Date.now() + minutes * 60000, minutes, task, paused: false };
  save();
  keepAwake(true);
}
export function pauseFocus() {
  const f = tools().focus;
  if (!f?.end || f.paused) return;
  f.paused = true;
  f.left = f.end - Date.now();
  save();
  keepAwake(false);
}
export function resumeFocus() {
  const f = tools().focus;
  if (!f?.paused) return;
  unlockAudio();
  f.end = Date.now() + f.left;
  f.paused = false;
  save();
  keepAwake(true);
}
export function resetFocus() {
  const f = tools().focus;
  if (f) Object.assign(f, { end: 0, paused: false, left: 0 });
  save();
  keepAwake(false);
}

// Called every second by the app: sounds and records whatever just finished.
export function checkTimers() {
  const t = tools();
  const now = Date.now();
  if (t.napEnd && now >= t.napEnd) {
    t.napEnd = 0;
    markWorship('qailulah');
    save();
    keepAwake(false);
    chime([0, 0.3, 0.6, 1.5, 1.8, 2.1, 3, 3.3, 3.6]);
    toast('انتهت القيلولة — «الحمد لله الذي أحيانا»', 'reminder');
  }
  if (t.walk && !t.walk.paused && !t.walk.finished) {
    const s = walkState(t.walk);
    const phase = s.done ? 'done' : `r${s.round}${s.fast ? 'f' : 's'}`;
    if (phase !== t.walk.phase) {
      t.walk.phase = phase;
      if (s.done) {
        t.walk.finished = true;
        markWorship('walk');
        keepAwake(false);
        chime([0, 0.3, 0.6, 1.2, 1.5, 1.8]);
        toast('أحسنت! أتممت المشي الياباني ٣٠ دقيقة', 'reminder');
      } else {
        chime([0, 0.25]);
        toast(s.fast ? `الجولة ${s.round}: مشي سريع ⚡` : 'مشي بطيء 🧘');
      }
      save();
    }
  }
  const f = t.focus;
  if (f?.end && !f.paused && now >= f.end) {
    f.end = 0;
    f.count = (f.count || 0) + 1;
    f.total = (f.total || 0) + f.minutes;
    save();
    keepAwake(false);
    chime([0, 0.3, 0.6]);
    toast('🎉 أحسنت! هل تستمر عشر دقائق أخرى أم تأخذ استراحة؟', 'reminder');
  }
}

export const anyTimerRunning = () => {
  const t = tools();
  return !!(t.napEnd || (t.walk && !t.walk.paused && !t.walk.finished) || (t.focus?.end && !t.focus.paused));
};
