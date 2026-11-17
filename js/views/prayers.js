// «مواقيت الصلاة»: a day's prayers with their iqama and the moments of the day, the next prayer
// counted down; and «خروج الصلوات»: when each prayer's time begins and runs out, with its evidence.

import { clock, clockText, countdown, GREG_MONTHS, hijri, hijriText, num, weekday } from '../dates.js';
import { endNow, windows } from '../ends.js';
import { icon, PRAYER_ICONS } from '../icons.js';
import { addDays, dayTimes, METHODS } from '../prayer.js';
import { state } from '../store.js';
import { today } from '../today.js';
import { esc, pageHeader } from '../ui.js';

const timesOf = (day) => dayTimes(day, state.settings, hijri(day, state.settings.hijriAdjust).month === 9);
const dayLabel = (off, d) => (off === 0 ? 'اليوم' : off === 1 ? 'غداً' : off === -1 ? 'أمس' : weekday(d));

// Updates the countdowns in the page every second; returns the cleanup.
function ticking(view, fn) {
  const id = setInterval(() => (document.hidden ? null : fn()), 1000);
  return { destroy: () => {
    clearInterval(id);
    view.onclick = null;
  } };
}

export function render(view) {
  let off = 0;
  const draw = () => {
    const s = state.settings;
    const info = today();
    const day = addDays(info.day, off);
    const t = off === 0 ? info.times : timesOf(day);
    const now = Date.now();
    const n = info.nextPrayer;
    const row = (k, sub = '') => {
      const x = t[k];
      const c = clock(x.hours, s.clock24);
      const isNext = off === 0 && n.at === x.at;
      const isNow = off === 0 && info.lastPrayer.at === x.at;
      return `<li class="pt-row ${isNext ? 'next' : ''} ${isNow ? 'now' : ''} ${off === 0 && x.at <= now && !isNow ? 'passed' : ''}">
        <span class="pt-ic">${icon(PRAYER_ICONS[k] || 'clock', 20)}</span>
        <span class="pt-name"><b>${x.name}</b>${sub ? `<small>${sub}</small>` : ''}</span>
        <strong>${c.time}<small>${c.period}</small></strong></li>`;
    };
    const iq = (k) => (s.iqama?.[k] ? `الإقامة ${clockText(t[k].hours + s.iqama[k] / 60, s.clock24)}` : '');
    const e = endNow(info, now);
    view.innerHTML = `
      ${pageHeader('مواقيت الصلاة', { back: '#/home', sub: esc(s.location.name) })}
      <section class="pt-hero">
        <small>${icon(PRAYER_ICONS[n.key] || 'clock', 16)} الصلاة القادمة</small>
        <b>${n.name}</b>
        <strong data-left>${countdown(n.at - now)}</strong>
        <span>${clockText(n.hours, s.clock24)}${e ? ` · <em data-end>${e.need ? 'وقت الضرورة لـ' : 'باقي على خروج وقت '}${e.w.name} ${countdown(e.at - now)}</em>` : ''}</span>
      </section>
      <div class="pday pt-day">
        <button class="icon-btn ghost sm flip" data-off="-1" aria-label="اليوم السابق">${icon('chevron', 20)}</button>
        <button class="pday-label ${off ? 'other' : ''}" data-off="0"><b>${dayLabel(off, day)}</b><small>${weekday(day)}، ${num(day.d)} ${GREG_MONTHS[day.m - 1]} • ${hijriText(day, s.hijriAdjust)}</small></button>
        <button class="icon-btn ghost sm" data-off="1" aria-label="اليوم التالي">${icon('chevron', 20)}</button>
      </div>
      <ul class="card pt-list">
        ${row('fajr', iq('fajr'))}
        ${row('sunrise', 'نهاية وقت الفجر')}
        ${row('dhuhr', iq('dhuhr'))}
        ${row('asr', iq('asr'))}
        ${row('maghrib', iq('maghrib'))}
        ${row('isha', iq('isha'))}
      </ul>
      <ul class="card pt-list pt-more">
        ${row('duha', `ينتهي ${clockText(t.duhaEnd.hours, s.clock24)}`)}
        ${row('midnight', 'نهاية وقت العشاء')}
        ${row('lastThird', 'وقت النزول الإلهي')}
      </ul>
      <a class="card pt-link" href="#/ends">${icon('clock', 22)}<span><b>أوقات خروج الصلوات</b><small>متى يبدأ وقت كل صلاة ومتى ينتهي، بالدليل</small></span>${icon('back', 18)}</a>
      <p class="hint center">طريقة الحساب: <a class="link" href="#/settings/method">${esc(METHODS[s.method]?.name || '')}</a></p>`;
  };
  draw();
  view.onclick = (ev) => {
    const b = ev.target.closest('[data-off]');
    if (!b) return;
    const d = Number(b.dataset.off);
    off = d === 0 ? 0 : off + d;
    draw();
  };
  let lastNext = today().nextPrayer.at;
  return ticking(view, () => {
    const info = today();
    if (info.nextPrayer.at !== lastNext) {
      lastNext = info.nextPrayer.at;
      return draw();
    }
    const now = Date.now();
    const left = view.querySelector('[data-left]');
    if (left) left.textContent = countdown(info.nextPrayer.at - now);
    const end = view.querySelector('[data-end]');
    const e = endNow(info, now);
    if (end && e) end.textContent = `${e.need ? 'وقت الضرورة لـ' : 'باقي على خروج وقت '}${e.w.name} ${countdown(e.at - now)}`;
    else if (end || e) draw();
  });
}

// The evidence, from the books (Shamela).
const EVIDENCE = [
  {
    text: 'عن عبد الله بن عمرو رضي الله عنهما أن النبي ﷺ قال: «وقتُ الظهر إذا زالت الشمس، وكان ظلُّ الرجل كطوله ما لم يحضر العصر، ووقتُ العصر ما لم تصفرَّ الشمس، ووقتُ صلاة المغرب ما لم يغب الشفق، ووقتُ صلاة العشاء إلى نصف الليل الأوسط، ووقتُ صلاة الصبح من طلوع الفجر ما لم تطلع الشمس، فإذا طلعت الشمس فأمسك عن الصلاة؛ فإنها تطلع بين قرني شيطان».',
    refs: [['صحيح مسلم (٢/ ١٠٥)', 'https://shamela.ws/book/711/1640'], ['بلوغ المرام (ص ٩٨)', 'https://shamela.ws/book/17757/216'], ['مشكاة المصابيح (١/ ١٨٤)', 'https://shamela.ws/book/8360/676']],
  },
  {
    text: 'وعن أبي هريرة رضي الله عنه قال: قال رسول الله ﷺ: «إن للصلاة أولاً وآخراً … وإن أول وقت العصر حين يدخل وقت العصر، وإن آخر وقتها حين تصفرّ الشمس، وإن أول وقت المغرب حين تغرب الشمس، وإن آخر وقتها حين يغيب الشفق، وإن أول وقت العشاء الآخرة حين يغيب الشفق، وإن آخر وقتها حين ينتصف الليل، وإن أول وقت الفجر حين يطلع الفجر، وإن آخر وقتها حين تطلع الشمس». أخرجه أحمد والترمذي.',
    refs: [['الدر المنثور (٢/ ٦٦٨)', 'https://shamela.ws/book/12884/1766']],
  },
  {
    text: 'وفي حديث إمامة جبريل عن ابن عباس رضي الله عنهما: «… وصلى بي العصر حين كان ظل كل شيء مثليه … ثم التفت إليّ فقال: يا محمد، هذا وقت الأنبياء من قبلك، والوقت ما بين هذين الوقتين». قال الترمذي: حديث حسن.',
    refs: [['صحيح ابن خزيمة (١/ ١٦٨)', 'https://shamela.ws/book/1446/585'], ['المسند المصنف المعلل (١١/ ٤٤٣–٤٤٥)', 'https://shamela.ws/book/16953/11630']],
  },
  {
    text: 'وعن أبي هريرة رضي الله عنه: «من أدرك من الصبح ركعة قبل أن تطلع الشمس فقد أدرك الصبح، ومن أدرك ركعة من العصر قبل أن تغرب الشمس فقد أدرك العصر». متفق عليه.',
    refs: [['السنن والأحكام (١/ ٢٧٠)', 'https://shamela.ws/book/1875/456']],
  },
  {
    text: 'وقال الشيخ ابن عثيمين رحمه الله: وقت العشاء ينتهي بنصف الليل، لحديث عبد الله بن عمرو.',
    refs: [['مجموع فتاوى العثيمين (١٢/ ٢٠٨)', 'https://shamela.ws/book/12293/4492']],
  },
];

export function renderEnds(view) {
  const draw = () => {
    const s = state.settings;
    const info = today();
    const now = Date.now();
    const e = endNow(info, now);
    const ws = windows(info.times);
    const ct = (x) => clockText(x.hours, s.clock24);
    view.innerHTML = `
      ${pageHeader('خروج الصلوات', { back: '#/prayers', sub: 'متى ينتهي وقت كل صلاة' })}
      ${e ? `<section class="pt-hero ends">
        <small>${icon('clock', 16)} ${e.need ? `وقت الضرورة لصلاة ${e.w.name}` : `الوقت الآن وقت ${e.w.name}`}</small>
        <b>${e.need ? `حتى ${e.w.lastText}` : `يخرج عند ${e.w.endText}`}</b>
        <strong data-left>${countdown(e.at - now)}</strong>
        <span>${clockText((e.need ? e.w.last : e.w.end).hours, s.clock24)}</span>
      </section>` : `<section class="pt-hero ends"><small>${icon('clock', 16)} ليس الآن وقت صلاة مفروضة</small><b>القادمة: ${info.nextPrayer.name}</b><span>${ct(info.nextPrayer)}</span></section>`}
      <h3 class="pt-h">مواقيت اليوم: ${weekday(info.day)}، ${hijriText(info.day, s.hijriAdjust)}</h3>
      <div class="en-list">
        ${ws.map((w) => {
          const on = e && e.w.start.at === w.start.at;
          return `<section class="card en ${on ? 'on' : ''}">
            <div class="en-head">${icon(PRAYER_ICONS[w.key], 22)}<b>${w.name}</b>${on ? '<em>الآن</em>' : ''}</div>
            <div class="en-bar"><span><small>يدخل</small><b>${ct(w.start)}</b></span><i></i><span><small>يخرج · ${w.endText}</small><b>${ct(w.end)}</b></span></div>
            ${w.last ? `<p class="en-need">${icon('info', 15)} ويمتد وقت الضرورة إلى ${w.lastText} (${ct(w.last)}): «من أدرك ركعة من العصر قبل أن تغرب الشمس فقد أدرك العصر».</p>` : ''}
          </section>`;
        }).join('')}
      </div>
      <h3 class="pt-h">الدليل</h3>
      ${EVIDENCE.map((x) => `<blockquote class="card en-ev"><p>${x.text}</p><small>${x.refs.map(([n, u]) => `<a class="link" href="${u}" target="_blank" rel="noopener">${n}</a>`).join(' · ')}</small></blockquote>`).join('')}
      <p class="hint">اصفرار الشمس محسوب تقريباً بمصير ظل كل شيء مثليه (حديث إمامة جبريل)، وغياب الشفق الأحمر بنزول الشمس نحو ١٧° تحت الأفق، ومنتصف الليل منتصف ما بين المغرب والفجر. الأحوط أن تصلي قبل هذه الأوقات بوقت كافٍ.</p>`;
  };
  draw();
  let key = '';
  return ticking(view, () => {
    const info = today();
    const now = Date.now();
    const e = endNow(info, now);
    const k = `${info.key}|${e?.at}|${e?.need}`;
    if (key && k !== key) {
      key = k;
      return draw();
    }
    key = k;
    const left = view.querySelector('[data-left]');
    if (left && e) left.textContent = countdown(e.at - now);
  });
}
