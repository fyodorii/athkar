// «مواقيت الصلاة»: a day's prayers with their iqama and the moments of the day, the next prayer
// counted down; and «خروج الصلوات»: when each prayer's time begins and runs out, with its evidence.

import { clock, clockText, countdown, GREG_MONTHS, hijri, hijriText, num, weekday } from '../dates.js';
import { endLabel, endNow, progress, windows } from '../ends.js';
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
        <span>${clockText(n.hours, s.clock24)}${e ? ` · <em data-end>${endLabel(e)} ${countdown(e.at - now)}</em>` : ''}</span>
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
        ${row('midnight', 'نهاية وقت الاختيار للعشاء')}
        ${row('lastThird', 'وقت النزول الإلهي')}
      </ul>
      <a class="card pt-link" href="#/ends">${icon('clock', 22)}<span><b>أوقات خروج الصلوات</b><small>وقت الاختيار ووقت الضرورة لكل صلاة، بالدليل</small></span>${icon('back', 18)}</a>
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
    if (end && e) end.textContent = `${endLabel(e)} ${countdown(e.at - now)}`;
    else if (end || e) draw();
  });
}


// What the two parts of a prayer's time mean (الشرح الكبير على المقنع).
const KINDS = [
  ['ch', 'وقت الاختيار', '«هو الذي يجوز تأخير الصلاة إلى آخره من غير عذر».'],
  ['nd', 'وقت الضرورة', '«إنما يُباح تأخير الصلاة إليه مع العذر، فإن أخّرها لغير عذر أثم، ومتى فعلها فيه فهو مدرك لها أداءً في وقتها، سواء كان لعذر أو غيره».'],
];
const KINDS_REF = [['الشرح الكبير على المقنع (٣/ ١٤٩)', 'https://shamela.ws/book/19188/1016']];

// Which prayers have a time of need.
const SPLIT = {
  text: 'قال د. سعد الشويرخ: «الصلوات تنقسم إلى قسمين من ناحية الوقت: صلاة ليس لها إلا وقت واحد، وهذا الوقت هو وقت جواز، من أوله إلى آخره، يجوز أن تُؤدّى الصلاة في أي جزء منه دون كراهة لذلك، وهذا مثل صلاة المغرب، وصلاة الظهر، وصلاة الفجر. القسم الثاني: صلاة لها وقتان، وقت جواز ووقت ضرورة، مثل: صلاة العصر، وصلاة العشاء، ولا يجوز أن تؤخّر إلى وقت الضرورة إلا لضرورة تدعو إلى ذلك».',
  refs: [['فتاوى الإسلام اليوم (٥/ ٣٠٧)', 'https://shamela.ws/book/894/2351'], ['(٥/ ٣٠٨)', 'https://shamela.ws/book/894/2352']],
};

// The evidence from the Sunnah, and what the scholars said (from the books, on Shamela).
const SUNNAH = [
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
];

const SCHOLARS = [
  {
    text: 'في فتوى اللجنة الدائمة للبحوث العلمية والإفتاء: «ووقت العصر حين يصير ظل الشيء مثله بعد فيء الزوال إلى أن يصير مثليه، وهذا هو وقت الاختيار لها، ووقت الاضطرار من بدء اصفرار الشمس إلى أن يبقى ما يكفي لأداء ركعة قبل غروب الشمس … ووقت العشاء من غيبوبة الشفق الأحمر إلى نصف الليل، وهذا وقت الاختيار لها، ووقت الاضطرار من نصف الليل إلى طلوع الفجر. ووقت الفجر من طلوع الفجر الصادق إلى طلوع الشمس».',
    refs: [['فتاوى اللجنة الدائمة (٦/ ١١٥)', 'https://shamela.ws/book/8381/4120'], ['مجلة البحوث الإسلامية (٥/ ٣٠٢)', 'https://shamela.ws/book/8322/2502']],
  },
  {
    text: 'وفي فتوى أخرى لها برئاسة الشيخ ابن باز: «وقت صلاة العشاء يمتد إلى نصف الليل، وهو وقت الاختيار لها، وما بعد هذا الوقت إلى طلوع الفجر وقت ضرورة لا يجوز تأخيرها إليه، كما لا يجوز تأخير صلاة العصر إلى أن تصفرّ الشمس، لكن متى أخّر المسلم ذلك لعذر شرعي وقعت الصلاة في وقت الضرورة، وعليه التوبة إلى الله من تأخيرها إلى ذلك الوقت إذا كان بغير عذر شرعي».',
    refs: [['فتاوى اللجنة الدائمة - المجموعة الثانية (٦/ ١٣٨)', 'https://shamela.ws/book/21772/3574'], ['(٦/ ١٣٩)', 'https://shamela.ws/book/21772/3575']],
  },
  {
    text: 'وفي زاد المستقنع: «ويليه وقت العصر إلى مصير الفيء مثليه بعد فيء الزوال، والضرورة إلى غروبها … ويليه وقت العشاء إلى الفجر الثاني … وتأخيرها إلى ثلث الليل أفضل إن سهل». قال البهوتي في الروض المربع عن وقت الضرورة في العصر: «فالصلاة فيه أداء، لكن يأثم بالتأخير إليه لغير عذر»، وفي العشاء: «ويحرم تأخيرها بعد الثلث بلا عذر؛ لأنه وقت ضرورة».',
    refs: [['زاد المستقنع (ص ٤٠)', 'https://shamela.ws/book/11230/27'], ['الروض المربع (١/ ٢٠٨)', 'https://shamela.ws/book/147658/203'], ['الروض المربع (ص ٧٠)', 'https://shamela.ws/book/1679/69']],
  },
  {
    text: 'وفي الإقناع للحجاوي في العصر: «ووقتها من خروج وقت الظهر إلى أن يصير ظل الشيء مثليه سوى ظل الزوال إن كان، وهو آخر وقتها المختار، وعنه إلى اصفرار الشمس، اختاره الموفق والمجد وجمع، وما بعد ذلك وقت ضرورة إلى غروبها»، وفي العشاء: «وآخر وقتها المختار إلى ثلث الليل، وعنه نصفه، اختاره الموفق والمجد وجمع … ولا يجوز تأخير الصلاة أو بعضها إلى وقت الضرورة ما لم يكن عذر»، وفي الفجر: «يمتد وقتها إلى طلوع الشمس، وليس لها وقت ضرورة».',
    refs: [['الإقناع (١/ ٨٢)', 'https://shamela.ws/book/7360/123'], ['(١/ ٨٣)', 'https://shamela.ws/book/7360/124'], ['(١/ ٨٤)', 'https://shamela.ws/book/7360/125']],
  },
  {
    text: 'وقال شيخ الإسلام ابن تيمية في الفجر: «ويمتدّ وقتها في حال الاختيار والاضطرار إلى طلوع الشمس … هذا ظاهر المذهب، وهو المنصوص عنه. وقال بعض أصحابنا: إذا أسفر ذهب وقت الاختيار، ويبقى وقت الضرورة إلى طلوع الشمس كالعصر والعشاء … والأول أصح».',
    refs: [['شرح عمدة الفقه لابن تيمية (٢/ ١٨٥)', 'https://shamela.ws/book/151/893']],
  },
  {
    text: 'وفي المذاهب قال مجير الدين العليمي: «وآخر وقتها [العصر] المختار مصير ظل كل شيء مثليه عند مالك والشافعي وأحمد، ووقت الضرورة عند الشافعي وأحمد إلى غروب الشمس، وهو آخر الوقت عند أبي حنيفة … وآخر وقتها [العشاء] المختار عند مالك والشافعي وأحمد ثلث الليل الأول … وعند الشافعي وأحمد وقت الضرورة إلى طلوع الفجر الثاني».',
    refs: [['فتح الرحمن في تفسير القرآن (٥/ ٢٧٧)', 'https://shamela.ws/book/14404/2527'], ['(٥/ ٢٧٨)', 'https://shamela.ws/book/14404/2528']],
  },
  {
    text: 'وقال الشيخ ابن عثيمين في الشرح الممتع: «ولكن الراجح في هذه المسألة: حديث عبد الله بن عمرو … «وقت العصر ما لم تصفرّ الشمس»، أي: ما لم تكن صفراء، وهذا في الغالب يزيد على مصير ظل كل شيء مثليه … فيُجمع بين الحديثين بأن يقال: «ما لم تصفرّ الشمس» هذا وقت الاختيار، و«إلى الغروب» وقت الضرورة. فإن قيل: ما معنى وقت الضرورة؟ فالجواب: أن يضطر الإنسان إلى تأخيرها عن وقت الاختيار».',
    refs: [['الشرح الممتع (٢/ ١٠٨)', 'https://shamela.ws/book/10649/621'], ['(٢/ ١٠٩)', 'https://shamela.ws/book/10649/622']],
  },
  {
    text: 'وسُئل الشيخ ابن عثيمين: هل يكون بعد اصفرار الشمس وبعد نصف الليل وقت لأداء العصر والعشاء؟ فقال: «أما العصر فنعم، ما بين الاصفرار إلى الغروب من وقتها … وأما العشاء فلا، فإن العشاء ينتهي وقتها بنصف الليل … فما بين نصف الليل إلى طلوع الفجر ليس وقتاً للعشاء … والمشهور عند كثير من العلماء أن وقت صلاة العشاء ينتهي بطلوع الفجر، لكن ما بين نصف الليل وطلوع الفجر وقت ضرورة، كما بين اصفرار الشمس وغروبها وقت ضرورة بالنسبة للعصر، لكن القول الذي اخترناه هو الذي تدل عليه الأدلة». وقال في العصر: «وليس المعنى أنه يجوز تأخيرها إلى الغروب، فإنه لا يجوز تأخيرها إلى ما بعد اصفرار الشمس».',
    refs: [['فتاوى نور على الدرب للعثيمين (٨/ ٢)', 'https://shamela.ws/book/2300/1928'], ['مجموع فتاوى ورسائل العثيمين (١٢/ ٢١٠)', 'https://shamela.ws/book/12293/4494']],
  },
];

const refsHtml = (refs) => refs.map(([n, u]) => `<a class="link" href="${u}" target="_blank" rel="noopener">${n}</a>`).join(' · ');
const quote = (x) => `<blockquote class="card en-ev"><p>${x.text}</p><small>${refsHtml(x.refs)}</small></blockquote>`;

export function renderEnds(view) {
  const draw = () => {
    const s = state.settings;
    const info = today();
    const now = Date.now();
    const e = endNow(info, now);
    const ct = (x) => clockText(x.hours, s.clock24);
    const span = (a, b) => `<span class="en-span"><b>${ct(a)}</b><i>–</i><b>${ct(b)}</b></span>`;

    const hero = () => {
      if (!e) return `<section class="pt-hero ends"><small>${icon('clock', 16)} ليس الآن وقت صلاة مفروضة</small><b>القادمة: ${info.nextPrayer.name}</b><span>${ct(info.nextPrayer)}</span></section>`;
      const { w } = e;
      const what = e.need ? `وقت الضرورة لصلاة ${w.name}` : w.last ? `وقت الاختيار لصلاة ${w.name}` : `وقت صلاة ${w.name}`;
      const after = e.need ? 'لا تُؤخَّر الصلاة إليه إلا لعذر' : w.last ? `ثم وقت الضرورة حتى ${w.lastText} ${ct(w.last)}` : '';
      return `<section class="pt-hero ends ${e.need ? 'need' : ''}">
        <small>${icon('clock', 16)} الآن ${what}</small>
        <b>${e.need ? `حتى ${w.lastText}` : `ينتهي عند ${w.endText}`}</b>
        <strong data-left>${countdown(e.at - now)}</strong>
        <span>${ct(e.need ? w.last : w.end)}${after ? ` · ${after}` : ''}</span>
      </section>`;
    };

    const card = (w) => {
      const on = !!e && e.w.start.at === w.start.at;
      const done = !on && (w.last || w.end).at <= now;
      const share = w.last ? ((w.end.at - w.start.at) / (w.last.at - w.start.at)) * 100 : 100;
      const chip = on ? `<em class="${e.need ? 'nd' : ''}">الآن · ${e.need ? 'وقت الضرورة' : w.last ? 'وقت الاختيار' : 'وقتها'}</em>` : done ? '<em class="off">انتهى</em>' : '';
      const note = w.key === 'isha'
        ? `<p class="en-note">وفي المذهب الحنبلي: آخر وقت الاختيار ثلث الليل${w.third ? ` (${ct(w.third)})` : ''}، وعنه: نصفه. واختار ابن عثيمين أنه لا وقت للعشاء بعد نصف الليل.</p>`
        : w.key === 'asr' && w.last
          ? '<p class="en-note">وعن أحمد: يمتد وقت الاختيار إلى اصفرار الشمس، اختارها الموفق والمجد، ورجّحها ابن عثيمين، والاصفرار في الغالب بعد مصير الظل مثليه.</p>'
          : '';
      return `<section class="card en ${on ? 'on' : ''} ${on && e.need ? 'need' : ''} ${done ? 'done' : ''}">
        <div class="en-head">${icon(PRAYER_ICONS[w.key], 22)}<b>${w.name}</b>${chip}</div>
        <div class="en-track"><i class="ch" style="flex: ${share.toFixed(2)}"></i>${w.last ? `<i class="nd" style="flex: ${(100 - share).toFixed(2)}"></i>` : ''}${on ? `<s data-pos style="inset-inline-start: ${progress(w, now).toFixed(2)}%"></s>` : ''}</div>
        <div class="en-row ch"><span><b>${w.last || w.one ? 'وقت الاختيار' : 'وقتها'}</b><small>إلى ${w.endText}</small></span>${span(w.start, w.end)}</div>
        ${w.last ? `<div class="en-row nd"><span><b>وقت الضرورة</b><small>إلى ${w.lastText}، ولا تُؤخَّر إليه إلا لعذر</small></span>${span(w.end, w.last)}</div>` : ''}
        ${w.one ? '<p class="en-note">ليس لها وقت ضرورة: وقتها كله وقت اختيار.</p>' : ''}
        ${note}
      </section>`;
    };

    view.innerHTML = `
      ${pageHeader('خروج الصلوات', { back: '#/prayers', sub: 'وقت الاختيار ووقت الضرورة' })}
      ${hero()}
      <h3 class="pt-h">مواقيت اليوم: ${weekday(info.day)}، ${hijriText(info.day, s.hijriAdjust)}</h3>
      <div class="en-legend"><span class="ch">وقت الاختيار</span><span class="nd">وقت الضرورة</span></div>
      <div class="en-list">${windows(info.times, info.tomorrow).map(card).join('')}</div>
      <h3 class="pt-h">الفرق بين الوقتين</h3>
      <div class="en-kinds">${KINDS.map(([c, n, t]) => `<div class="card en-kind ${c}"><b>${n}</b><p>${t}</p></div>`).join('')}</div>
      <p class="en-src">${refsHtml(KINDS_REF)}</p>
      ${quote(SPLIT)}
      <h3 class="pt-h">الدليل من السنة</h3>
      ${SUNNAH.map(quote).join('')}
      <h3 class="pt-h">من كلام أهل العلم</h3>
      ${SCHOLARS.map(quote).join('')}
      <p class="hint">نهاية وقت الاختيار للعصر محسوبة بمصير ظل كل شيء مثليه بعد فيء الزوال (حديث إمامة جبريل، وهو المذهب)، أما اصفرار الشمس فلا يُحسب هنا، وهو في الغالب بعد ذلك. وغياب الشفق الأحمر بنزول الشمس نحو ١٧° تحت الأفق، ومنتصف الليل منتصف ما بين المغرب والفجر، وثلثه الأول ثلث ما بينهما. الأحوط أن تصلي قبل هذه الأوقات بوقت كافٍ.</p>`;
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
    const pos = view.querySelector('[data-pos]');
    if (pos && e) pos.style.insetInlineStart = `${progress(e.w, now).toFixed(2)}%`;
  });
}
