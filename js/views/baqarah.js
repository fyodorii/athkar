// «سورة البقرة للرقية»: how to read al-Baqarah for one who is ill (the steps the user follows),
// its virtue from the Sunnah, and a tracker of today's reading: 48 pages, a pause to blow
// into the water after every two.

import { num } from '../dates.js';
import { icon } from '../icons.js';
import { save, state } from '../store.js';
import { today } from '../today.js';
import { confirmSheet, haptic, pageHeader, toast } from '../ui.js';

const PAGES = 48; // al-Baqarah fills pages 2–49 of the Madinah Mushaf
// al-Isra 45, from the Hafs Mushaf data.
const ISRA_45 = 'وَإِذَا قَرَأۡتَ ٱلۡقُرۡءَانَ جَعَلۡنَا بَيۡنَكَ وَبَيۡنَ ٱلَّذِينَ لَا يُؤۡمِنُونَ بِٱلۡأٓخِرَةِ حِجَابٗا مَّسۡتُورٗا ﰬ';

const STEPS = [
  ['النية الصادقة', 'انوِ بها: الشفاء، وفكّ السحر، وطرد العارض، ورفع الحسد، والبركة، والتحصين. فالنية باب الفتح، وما نواه العبد وجده.'],
  ['دعاء قبل القراءة', '«اللهم ارزقني فضل سورة البقرة وبركتها، اللهم طهّر بها جسدي من السحر والحسد والعين والأمراض، اللهم اجعلها حصناً ودرعاً لي، اللهم اجعل كل حرف من سورة البقرة أقرؤه الآن ناراً وعذاباً على كل شيطان ساكن في جسدي أو خارج جسدي، اللهم صلّ وسلّم على نبينا محمد».'],
  ['الاستعاذة والبسملة', '«أعوذ بالله من الشيطان الرجيم، من همزه ونفخه ونفثه، بسم الله الرحمن الرحيم».'],
];

const day = () => {
  const k = today().key;
  if (state.baqarah?.day !== k) state.baqarah = { day: k, pages: 0 };
  return state.baqarah;
};

export function render(view) {
  const draw = () => {
    const b = day();
    const done = b.pages >= PAGES;
    view.innerHTML = `
      ${pageHeader('سورة البقرة للرقية', { back: '#/home', sub: 'مرة واحدة في اليوم بصوت مسموع' })}
      <section class="card bq-virtue">
        <p>«اقرؤوا سورة البقرة؛ فإن أخذها بركة، وتركها حسرة، ولا تستطيعها البَطَلة». قال معاوية بن سلّام: بلغني أن البطلة: السحرة. <small>رواه مسلم</small></p>
        <p>«لا تجعلوا بيوتكم مقابر، إن الشيطان ينفر من البيت الذي تُقرأ فيه سورة البقرة». <small>رواه مسلم</small></p>
      </section>
      <section class="card bq-track ${done ? 'done' : ''}">
        <div class="bq-head"><b>قراءة اليوم</b><span>${num(b.pages)} / ${num(PAGES)} صفحة</span></div>
        <div class="bar light"><i style="width:${Math.round((b.pages / PAGES) * 100)}%"></i></div>
        ${done
          ? `<p class="bq-msg">${icon('check', 18)} أتممت سورة البقرة اليوم، تقبّل الله منك وشفاك.</p>`
          : `<p class="bq-msg">${b.pages ? `انفث في الماء ٣ مرات، ثم أكمل من صفحة ${num(b.pages + 2)} في المصحف.` : 'ابدأ من الصفحة ٢ في المصحف، وبعد كل صفحتين اضغط الزر وانفث في الماء.'}</p>
             <button class="btn primary wide" data-two>${icon('plus', 18)} قرأت صفحتين</button>`}
        ${b.pages ? `<button class="btn ghost wide" data-reset>${icon('reset', 16)} البدء من جديد</button>` : ''}
      </section>
      <h3 class="pt-h">الطريقة</h3>
      ${STEPS.map(([t, x], i) => `<section class="card bq-step"><b><em>${num(i + 1)}</em>${t}</b><p>${x}</p></section>`).join('')}
      <section class="card bq-step"><b><em>${num(4)}</em>ثم اقرأ هذه الآية بصوت مسموع</b><p class="hafs bq-ayah">﴿${ISRA_45}﴾</p><small class="muted">الإسراء: ٤٥</small></section>
      <section class="card bq-step"><b><em>${num(5)}</em>طريقة النفث أثناء القراءة</b><p>جهّز جالون ماء (لترين أو ثلاثة)، وكلما أتممت قراءة صفحتين انفث في الماء ثلاث مرات (نفث مع رذاذ خفيف من الريق)، واستمر كذلك حتى تتم السورة كاملة. اجعل الماء قريباً من فمك بحيث يتساقط نفَسك فيه أثناء القراءة.</p></section>
      <p class="hint">الحديثان من صحيح مسلم، والدعاء والطريقة كما وصلتنا، وهي من الاجتهاد في الرقية لا من نصوص السنة.</p>`;
  };
  draw();
  view.onclick = async (e) => {
    const b = day();
    if (e.target.closest('[data-two]')) {
      b.pages = Math.min(PAGES, b.pages + 2);
      save();
      haptic(20, true);
      if (b.pages < PAGES) toast(`${icon('drop', 18)} انفث في الماء ٣ مرات`);
      return draw();
    }
    if (e.target.closest('[data-reset]')) {
      if (!(await confirmSheet('تصفير قراءة اليوم؟', { ok: 'تصفير' }))) return;
      b.pages = 0;
      save();
      draw();
    }
  };
  return { destroy: () => (view.onclick = null) };
}
