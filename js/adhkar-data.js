// Adhkar and supplications, from the Book and the authentic Sunnah, each with its source;
// morning, evening and sleep come from wird-data.js.
// Item ids are stored with the user's progress and bookmarks, so keep them stable
// when editing: add new ids, never reuse old ones.

import { AL_IMRAN_END, EVENING, HASBIYA, MORNING, SLEEP } from './wird-data.js';

const list = (cat, items) => items.map((x, i) => ({ ...x, id: `${cat}-${i + 1}`, count: x.count || 1 }));

// The adhkar of «أذكاري الخاصة» and of the tasbeeh, as the user keeps them.
export const MY_ADHKAR = [
  'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير',
  'اللهم صل وسلم وبارك على نبينا محمد',
  'سبحان الله وبحمده',
  'لا حول ولا قوة إلا بالله',
  'أستغفر الله وأتوب إليه',
  'لا حول ولا قوة إلا بالله العلي العظيم',
  'أستغفر الله الذي لا إله إلا هو الحي القيوم وأتوب إليه',
  'اللهم صل على محمد وعلى آل محمد، كما صليت على إبراهيم وعلى آل إبراهيم، إنك حميد مجيد. اللهم بارك على محمد وعلى آل محمد، كما باركت على إبراهيم وعلى آل إبراهيم، إنك حميد مجيد',
];

// Morning and evening in the user's order (`p` is the id prefix: am, pm): the crown of dhikr,
// the prayer upon the Prophet ﷺ, the two isti'adhas in one card three times, the other
// ta'awwudhat, then the rest as in wird-data.js, with «لا حول ولا قوة إلا بالله» a hundred
// times before the closing istighfar.
const WIRD_FIRST = [13, 17, 1, 37, 38, 39, 40];
const WIRD_TITLES = { 13: 'تاج الذكر', 17: 'الصلاة على النبي' };
function ordered(items, p) {
  const get = (n) => items.find((i) => i.id === `${p}-${n}`);
  const used = [...WIRD_FIRST, 2].map((n) => `${p}-${n}`);
  const head = WIRD_FIRST.map((n) => {
    const x = get(n);
    if (n === 1) return { ...x, text: `${x.text}\n${get(2).text}`, count: 3, note: get(2).note };
    return { ...x, ...(WIRD_TITLES[n] ? { title: WIRD_TITLES[n] } : {}) };
  });
  // «حسبي الله…» is shown as the verse it is.
  const rest = items.filter((x) => !used.includes(x.id)).map((x) => (x.id === `${p}-32` ? { ...x, quran: true, text: HASBIYA, ref: 'التوبة: ١٢٩' } : x));
  const last = rest.findIndex((x) => x.id === `${p}-47`);
  rest.splice(last, 0, { id: `${p}-48`, text: 'لا حول ولا قوة إلا بالله', count: 100 });
  return [...head, ...rest];
}

export const CATEGORIES = [
  { id: 'morning', title: 'أذكار الصباح', subtitle: 'من الفجر إلى طلوع الشمس', icon: 'sunrise', tone: 'amber', items: ordered(MORNING, 'am') },
  { id: 'evening', title: 'أذكار المساء', subtitle: 'من العصر إلى الغروب', icon: 'sunset', tone: 'rose', items: ordered(EVENING, 'pm') },
  { id: 'sleep', title: 'أذكار النوم', subtitle: 'وِرد النوم قبل أن تنام', icon: 'moon', tone: 'indigo', items: SLEEP },
  {
    id: 'waking',
    title: 'أذكار الاستيقاظ',
    subtitle: 'إذا استيقظت من النوم',
    icon: 'sun',
    tone: 'amber',
    items: list('waking', [
      { text: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ.', ref: 'رواه البخاري' },
      { text: 'الْحَمْدُ لِلَّهِ الَّذِي رَدَّ عَلَيَّ رُوحِي، وَعَافَانِي فِي جَسَدِي، وَأَذِنَ لِي بِذِكْرِهِ.', ref: 'حديث صحيح — «الكلم الطيب» ص ٣٦' },
      {
        text: 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير، سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر، ولا حول ولا قوة إلا بالله العلي العظيم، رب اغفر لي.',
        virtue: 'من تعارّ من الليل فقالها ثم دعا استُجيب له، فإن توضأ وصلى قُبلت صلاته.',
        ref: 'رواه البخاري',
      },
      { quran: true, title: 'خواتيم سورة آل عمران', text: AL_IMRAN_END, ref: 'آل عمران: ١٩٠–٢٠٠ — قرأها النبي ﷺ حين استيقظ، متفق عليه' },
    ]),
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export function findItem(id) {
  for (const c of CATEGORIES) {
    const x = c.items.find((i) => i.id === id);
    if (x) return x;
  }
  return null;
}

// Short adhkar for the "dhikr of the day" card and notifications, rotating daily.
export const DAILY = [
  { text: 'سبحان الله وبحمده، سبحان الله العظيم', note: 'كلمتان خفيفتان على اللسان، ثقيلتان في الميزان' },
  { text: 'لا حول ولا قوة إلا بالله', note: 'كنز من كنوز الجنة' },
  { text: 'سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر', note: 'أحب الكلام إلى الله' },
  { text: 'اللهم صل وسلم على نبينا محمد', note: 'من صلى عليه واحدة صلى الله عليه بها عشراً' },
  { text: 'أستغفر الله وأتوب إليه', note: 'كان ﷺ يتوب إلى الله في اليوم مائة مرة' },
  { text: 'لا إله إلا أنت سبحانك إني كنت من الظالمين', note: 'دعوة ذي النون، ما دعا بها مسلم إلا استجاب الله له' },
  { text: 'رب اغفر لي وتب علي إنك أنت التواب الرحيم', note: 'كان ﷺ يقولها في المجلس مائة مرة' },
  { text: 'حسبنا الله ونعم الوكيل', note: 'قالها إبراهيم حين أُلقي في النار، وقالها محمد ﷺ' },
  { text: 'يا مقلب القلوب ثبت قلبي على دينك', note: 'كان أكثر دعاء النبي ﷺ' },
  { text: 'اللهم إنك عفو تحب العفو فاعف عني', note: 'دعاء ليلة القدر' },
];
