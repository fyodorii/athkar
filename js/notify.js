// Reminders: the user's own («تذكيراتي»), the adhan and the iqama, Duha, the last third of the night, the morning and
// evening adhkar, the daily wird of the khatma, and debts coming due.
//
// A web app has no way to schedule a notification for a time when it is closed (that needs a
// push server), so a reminder shows when its moment comes while the app is open or still alive
// in the background, and the ones missed in the last minutes show when the app is opened again.

import { minutesText, num } from './dates.js';
import { addDays, dayKey } from './prayer.js';
import { registerServiceWorker } from './push.js';
import { save, state } from './store.js';
import { chime, unlockAudio } from './timers.js';
import { hoursAt, PRAYERS, today } from './today.js';
import { esc, toast } from './ui.js';
import { icon } from './icons.js';

const LATE = 20 * 60000; // a reminder still shows this long after its moment

export const notifySupported = () => 'Notification' in window;
export const notifyPermission = () => (notifySupported() ? Notification.permission : 'unsupported');

// Asks for the system permission (must follow a tap). The in-app reminders work without it.
export async function askPermission() {
  unlockAudio();
  if (!notifySupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return Notification.permission;
  }
}

// Today's reminders as { id, at, title, body, url }, from the settings.
export function reminders(now = new Date()) {
  const n = state.settings.notify;
  const info = today(now);
  const t = info.times;
  const out = [];
  const add = (id, at, title, body, url = '#/home') => out.push({ id: `${info.key}:${id}`, at, title, body, url });

  // The user's own daily reminders stand on their own switch.
  const clockNow = hoursAt(now);
  const atTime = (h, m) => now.getTime() + ((h - clockNow.h) * 60 + (m - clockNow.m)) * 60000 - clockNow.s * 1000;
  for (const r of state.reminders) {
    if (!r.on) continue;
    const [h, m] = r.time.split(':').map(Number);
    add(`mine-${r.id}-${r.time}`, atTime(h, m), 'تذكير', r.text, '#/reminders');
  }

  if (n.on) {
    for (const k of PRAYERS) {
      if (!n.prayers[k]) continue;
      const p = t[k];
      if (n.before > 0) add(`${k}-before`, p.at - n.before * 60000, `${p.name} بعد ${minutesText(n.before)}`, 'استعدّ للصلاة');
      add(k, p.at, `حان وقت صلاة ${p.name}`, '«إن الصلاة كانت على المؤمنين كتاباً موقوتاً»');
      const wait = state.settings.iqama?.[k];
      if (n.iqama && wait) add(`${k}-iqama`, p.at + wait * 60000, `إقامة صلاة ${p.name}`, 'حان وقت الإقامة');
    }
    if (n.duha) add('duha', t.duha.at, 'دخل وقت الضحى', 'ركعتان فأكثر، تجزئان عن صدقة كل مفاصلك', '#/worship');
    if (n.duhaEnd) add('duha-end', t.duhaEnd.at - 15 * 60000, 'يوشك وقت الضحى أن ينتهي', `يبقى ${minutesText(15)} على نهاية وقت الضحى`, '#/worship');
    if (n.lastThird) {
      // Before Fajr the night's last third is yesterday's.
      const lt = now.getTime() < t.fajr.at ? info.yesterday.lastThird : t.lastThird;
      add('last-third', lt.at, 'الثلث الأخير من الليل', 'وقت النزول والاستجابة — قيام ودعاء واستغفار');
    }
    if (n.morning) add('morning', t.fajr.at + 30 * 60000, 'أذكار الصباح', 'ابدأ يومك بذكر الله', '#/adhkar/morning');
    if (n.evening) add('evening', t.asr.at + 30 * 60000, 'أذكار المساء', 'اختم نهارك بذكر الله', '#/adhkar/evening');

    if (/^\d\d:\d\d$/.test(n.khatma)) {
      const [h, m] = n.khatma.split(':').map(Number);
      const c = hoursAt(now);
      const at = now.getTime() + ((h - c.h) * 60 + (m - c.m)) * 60000 - c.s * 1000;
      add('khatma', at, 'وردك من القرآن', `أكمل من صفحة ${num(Math.min(604, state.khatma.pos))}`, '#/khatma');
    }
    if (n.debts) {
      const soon = dayKey(addDays(info.day, 3));
      const c = hoursAt(now);
      const nine = now.getTime() + ((9 - c.h) * 60 - c.m) * 60000 - c.s * 1000;
      for (const d of state.debts) {
        if (d.paid || !d.due || !d.remind) continue;
        const who = d.dir === 'owe' ? `عليك لـ${d.person}` : `لك عند ${d.person}`;
        if (d.due === soon) add(`debt-${d.id}-3`, nine, 'دين يحلّ بعد ٣ أيام', `${num(d.amount)} ريال ${who}`, '#/debts');
        if (d.due === info.key) add(`debt-${d.id}-0`, nine, 'دين يحلّ اليوم', `${num(d.amount)} ريال ${who}`, '#/debts');
      }
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

async function show(r) {
  toast(`${icon('bell', 18)}<b>${esc(r.title)}</b><span>${esc(r.body)}</span>`, 'reminder long');
  if (state.settings.notify.sound) chime([0, 0.3, 0.6]);
  if (notifyPermission() !== 'granted') return;
  const opts = { body: r.body, tag: r.id, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', lang: 'ar', dir: 'rtl', data: { url: r.url } };
  try {
    const reg = await registerServiceWorker();
    if (reg?.showNotification) await reg.showNotification(r.title, opts);
    else new Notification(r.title, opts);
  } catch (e) {
    // The toast was shown.
  }
}

// Called every second, and when the app comes back: shows what is due and not yet shown.
export function checkReminders() {
  if (!state.settings.notify.on && !state.reminders.some((r) => r.on)) return;
  const now = Date.now();
  const log = state.notifyLog;
  const due = reminders().filter((r) => r.at <= now && now - r.at < LATE && !log[r.id]);
  if (!due.length) return;
  for (const r of due) log[r.id] = now;
  for (const k of Object.keys(log)) if (now - log[k] > 4 * 86400000) delete log[k];
  save();
  // Several at once (the app was away): the latest one speaks for them.
  show(due[due.length - 1]);
}

// Marks what is already past as shown, so turning reminders on does not replay the day.
export function primeReminders() {
  const now = Date.now();
  for (const r of reminders()) if (r.at <= now) state.notifyLog[r.id] ??= now;
  save();
}

export async function testReminder() {
  await show({ id: 'test', title: 'تنبيه تجريبي', body: 'هكذا تظهر تنبيهات مواقيت', url: '#/home' });
}
