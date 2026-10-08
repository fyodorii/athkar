// The list of reminders for the coming days, worked out on the device. The server
// (push/cron.php) only sends each one at its time, so it needs no prayer-time code.

import { addDays, dateAt, dayTimes, forbiddenTimes, iqamaTime, PRAYER_NAMES, prayerEnd } from './prayer.js';
import { PAGES } from './quran-data.js';
import { dailyPages } from './khatma.js';
import { clockText, hijri, minutesText, num } from './dates.js';
import { OCCASIONS } from './occasions.js';

export const SCHEDULE_DAYS = 30;

const ADHAN_BODY = {
  fajr: 'الصلاة خير من النوم',
  dhuhr: 'حيّ على الصلاة، حيّ على الفلاح',
  asr: '«من صلى البردين دخل الجنة»',
  maghrib: 'حيّ على الصلاة، حيّ على الفلاح',
  isha: '«من صلى العشاء في جماعة فكأنما قام نصف الليل»',
};

const SALAWAT = [
  'اللهم صلِّ وسلم وبارك على نبينا محمد ﷺ',
  '«من صلى علي صلاة صلى الله عليه بها عشراً»',
  'اللهم صل على محمد وعلى آل محمد، كما صليت على إبراهيم وعلى آل إبراهيم، إنك حميد مجيد',
];

const isRamadan = (day, adj) => hijri(day, adj).month === 9;
const dayNumber = ({ y, m, d }) => Math.floor(Date.UTC(y, m - 1, d) / 86400000);

// Moment of "HH:MM" on a calendar day at the location.
function atClock(day, hhmm, times) {
  const [h, m] = hhmm.split(':').map(Number);
  // Midnight of the day at the location, from any prayer time of that day.
  const ref = times.dhuhr;
  return ref.at + ((h + m / 60 - ref.hours) * 60) * 60000;
}

export function buildSchedule(state, { days = SCHEDULE_DAYS, from = Date.now() } = {}) {
  const s = state.settings;
  const n = s.notify;
  const items = [];
  const place = s.location.name;
  const add = (at, title, body, url, tag) => {
    if (at > from) items.push({ at: Math.round(at), title, body, url: url || '#/home', tag: tag || '' });
  };
  const today = dateAt(s.location.tz, new Date(from));

  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    const t = dayTimes(day, s, isRamadan(day, s.hijriAdjust));
    const weekday = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();

    for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      if (!n.prayers[k]) continue;
      const name = k === 'dhuhr' && weekday === 5 ? 'الجمعة' : PRAYER_NAMES[k];
      add(t[k].at, `حان الآن وقت صلاة ${name}`, `${ADHAN_BODY[k]} — ${place}`, '#/home', `adhan-${k}`);
      const before = n.beforeBy?.[k] ?? n.before;
      if (before > 0) {
        add(
          t[k].at - before * 60000,
          `اقترب وقت صلاة ${name}`,
          `بعد ${minutesText(before)}، الساعة ${clockText(t[k].hours, s.clock24)}`,
          '#/home',
          `before-${k}`
        );
      }
      if (n.iqama && s.iqama[k] > 0) {
        const q = iqamaTime(t, k, s.iqama);
        add(q.at, `إقامة صلاة ${name}`, `حان وقت الإقامة (${clockText(q.hours, s.clock24)}) — ${place}`, '#/home', `iqama-${k}`);
      }
      if (n.afterAdhan > 0) {
        add(t[k].at + n.afterAdhan * 60000, `هل صليت ${name}؟`, 'أقم صلاتك، ولا تنسَ أذكار ما بعد الصلاة', '#/worship', `after-${k}`);
      }
      if (n.prayerEnd > 0) {
        // For Asr, warn before its chosen time ends rather than at sunset.
        const chosenAsr = k === 'asr' && s.asr === 1 && t.asr2.at > t.asr.at;
        const end = chosenAsr ? t.asr2 : prayerEnd(t, k);
        add(
          end.at - n.prayerEnd * 60000,
          chosenAsr ? 'اقترب خروج وقت الاختيار للعصر' : `اقترب خروج وقت صلاة ${name}`,
          `يخرج وقتها بعد ${minutesText(n.prayerEnd)}، الساعة ${clockText(end.hours, s.clock24)} — إن لم تصلِّها فبادر`,
          '#/home',
          `end-${k}`
        );
      }
    }
    if (n.fajrInfo) {
      // The coming Fajr: this morning's if the reminder is after midnight, else tomorrow's.
      const at = atClock(day, n.fajrInfoTime || '23:00', t);
      const f = at < t.fajr.at ? t : dayTimes(addDays(day, 1), s, isRamadan(addDays(day, 1), s.hijriAdjust));
      add(at, 'موعد الفجر والشروق', `الفجر ${clockText(f.fajr.hours, s.clock24)} • الشروق ${clockText(f.sunrise.hours, s.clock24)}${s.iqama?.fajr ? ` • الإقامة ${clockText(f.fajr.hours + s.iqama.fajr / 60, s.clock24)}` : ''}`, '#/home', 'fajr-info');
    }
    if (n.duha) {
      add(t.sunrise.at + Math.max(15, n.duhaDelay) * 60000, 'صلاة الضحى', '«صلاة الأوابين حين ترمض الفصال» — ركعتان تجزئان عن صدقة كل مفاصلك', '#/worship', 'duha');
    }
    if (n.nahy) {
      const z = forbiddenTimes(t)[1];
      add(z.from.at, 'دخل وقت النهي', `قيام الشمس حتى الظهر (${clockText(t.dhuhr.hours, s.clock24)}) — لا تُصلَّ فيه نافلة مطلقة`, '#/home', 'nahy');
    }
    if (n.qailulah) {
      // The start of the sixth seasonal hour of the day, the hour before the zawal.
      const zawal = t.dhuhr.at - (s.offsets.dhuhr || 0) * 60000;
      const a0 = zawal - (t.maghrib.at - t.sunrise.at) / 12;
      add(a0, 'وقت القيلولة', `نافذة ما قبل الزوال حتى ${clockText(t.dhuhr.hours - (s.offsets.dhuhr || 0) / 60, s.clock24)} — والقائلة: الاستراحة وسط النهار`, '#/qailulah', 'qailulah');
    }
    if (n.midnight) add(t.midnight.at, 'منتصف الليل', 'آخر وقت صلاة العشاء، وأوتر قبل أن تنام إن خشيت ألا تقوم', '#/home', 'midnight');
    if (n.sunrise) {
      if (n.sunriseBefore > 0) {
        add(t.sunrise.at - n.sunriseBefore * 60000, 'اقترب الشروق', `يخرج وقت الفجر بعد ${minutesText(n.sunriseBefore)} (${clockText(t.sunrise.hours, s.clock24)}) — إن لم تصلِّ فبادر`, '#/home', 'sunrise');
      } else add(t.sunrise.at, 'الشروق', 'انتهى وقت صلاة الفجر', '#/home', 'sunrise');
    }
    if (n.morning) {
      add(t.fajr.at + n.morningDelay * 60000, 'أذكار الصباح ☀️', '«أصبحنا وأصبح الملك لله…» حصّن يومك بأذكار الصباح', '#/adhkar/morning', 'morning');
    }
    if (n.evening) {
      add(t.asr.at + n.eveningDelay * 60000, 'أذكار المساء 🌙', '«أمسينا وأمسى الملك لله…» حان وقت أذكار المساء', '#/adhkar/evening', 'evening');
    }
    if (n.sleep) add(atClock(day, n.sleepTime, t), 'أذكار النوم', '«باسمك اللهم أموت وأحيا» — لا تنسَ أذكار النوم', '#/adhkar/sleep', 'sleep');
    if (n.lastThird) {
      add(t.lastThird.at, 'الثلث الأخير من الليل', '«ينزل ربنا تبارك وتعالى كل ليلة إلى السماء الدنيا حين يبقى ثلث الليل الآخر…»', '#/home', 'last-third');
    }
    if (n.worship) {
      add(atClock(day, '21:30', t), 'عباداتي اليوم', 'سجّل صلواتك وعباداتك، وحاسب نفسك قبل أن تنام', '#/worship', 'worship');
    }
    if (n.friday && weekday === 5) {
      add(atClock(day, '10:00', t), 'يوم الجمعة', 'أكثر من الصلاة على النبي ﷺ، وتحرَّ ساعة الإجابة آخر ساعة بعد العصر', '#/home', 'friday');
    }
    if (n.kahf && weekday === 5) {
      add(atClock(day, n.kahfTime, t), 'سورة الكهف 📖', '«من قرأ سورة الكهف يوم الجمعة أضاء له من النور ما بين الجمعتين»', '#/surah/kahf', 'kahf');
    }
    if (n.mulk) {
      add(atClock(day, n.mulkTime, t), 'سورة الملك', '«سورة من القرآن ثلاثون آية شفعت لرجل حتى غُفر له: تبارك الذي بيده الملك»', '#/surah/mulk', 'mulk');
    }
    if (n.baqarah > 0 && dayNumber(day) % n.baqarah === 0) {
      add(atClock(day, n.baqarahTime, t), 'سورة البقرة', '«لا تجعلوا بيوتكم مقابر، إن الشيطان ينفر من البيت الذي تُقرأ فيه سورة البقرة»', '#/surah/baqarah', 'baqarah');
    }
    if (n.khatma && state.khatma.page < PAGES) {
      add(atClock(day, n.khatmaTime, t), 'وردك من القرآن', `وردك اليوم ${num(dailyPages(state.khatma, day))} صفحة لتختم في موعدك`, '#/quran', 'khatma');
    }
    if (n.fasting && (weekday === 0 || weekday === 3)) {
      add(atClock(day, n.fastingTime || '21:00', t), `غداً ${weekday === 0 ? 'الاثنين' : 'الخميس'}`, 'تذكير بصيام التطوع، وتُعرض الأعمال فيه على الله', '#/home', 'fasting');
    }
    const hd = hijri(day, s.hijriAdjust);
    // In Dhu al-Hijjah the 13th is a day of Tashreeq (no fasting): only the 14th and 15th.
    if (n.whiteDays && hd.day === (hd.month === 12 ? 13 : 12)) {
      const white = hd.month === 12 ? `${num(14)} و${num(15)} (والثالث عشر من أيام التشريق لا يُصام)` : `${num(13)} و${num(14)} و${num(15)} من الشهر`;
      add(atClock(day, n.whiteDaysTime || '21:00', t), 'الأيام البيض', `تبدأ غداً صيام الأيام البيض: ${white}`, '#/home', 'white-days');
    }
    if (n.occasions) {
      // The evening before an occasion begins.
      const h = hijri(addDays(day, 1), s.hijriAdjust);
      for (const o of OCCASIONS) {
        if (h.month !== o.month || h.day !== o.from) continue;
        const one = o.from === o.to;
        // Ramadan and its last ten begin with tonight's prayer (Taraweeh, the night of the 21st):
        // an hour before Maghrib, not at night.
        if (o.id === 'ramadan' || o.id === 'lastTen') {
          add(t.maghrib.at - 3600000, `${o.id === 'ramadan' ? 'يبدأ الليلة' : 'تبدأ الليلة'}: ${o.name}`, o.text.replace(/\s+—.*$/, ''), '#/occasions', `occasion-${o.id}`);
        } else add(atClock(day, n.occasionsTime || '21:00', t), `${one ? 'غداً' : 'تبدأ غداً'}: ${o.name}`, o.text.replace(/\s+—.*$/, ''), '#/occasions', `occasion-${o.id}`);
      }
    }
    if (n.salawat) {
      const every = Math.max(1, n.salawatHours);
      for (let h = 9, j = 0; h <= 21; h += every, j++) {
        add(atClock(day, `${h}:00`, t), 'الصلاة على النبي ﷺ', SALAWAT[(i + j) % SALAWAT.length], '#/home', 'salawat');
      }
    }
    for (const c of state.custom) {
      if (!c.reminder) continue;
      add(atClock(day, c.reminder, t), 'أذكاري', c.text.length > 120 ? c.text.slice(0, 117) + '…' : c.text, `#/mine/${c.id}`, `custom-${c.id}`);
    }
  }
  return items.sort((a, b) => a.at - b.at);
}

// Changes when anything that affects the schedule changes, so the app re-sends it then.
export function scheduleHash(state) {
  const s = state.settings;
  const custom = state.custom.filter((c) => c.reminder).map((c) => [c.id, c.reminder, c.text]);
  const k = state.khatma;
  const text = JSON.stringify([s.location, s.method, s.asr, s.offsets, s.iqama, s.hijriAdjust, s.clock24, s.digits, s.notify, custom, k.days, k.start, k.page]);
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  return String(h);
}
