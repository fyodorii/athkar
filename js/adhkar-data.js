// Adhkar and supplications, from the Book and the authentic Sunnah, each with its source;
// morning, evening and sleep come from wird-data.js.
// Item ids are stored with the user's progress and bookmarks, so keep them stable
// when editing: add new ids, never reuse old ones.

import { AL_IMRAN_END, EVENING, HASBIYA, KARB, MORNING, RUQYAH, SLEEP } from './wird-data.js';

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
  // Before the closing istighfar: the supplication of Muhammad ibn Wasi' against Satan.
  rest.splice(rest.findIndex((x) => x.id === `${p}-47`), 0, {
    id: `${p}-49`,
    text: 'اللهم إنك سلطت علينا عدواً بصيراً بعيوبنا، يرانا هو وقبيله من حيث لا نراهم، اللهم فآيسه منا كما آيسته من رحمتك، وقنّطه منا كما قنّطته من عفوك، وباعد بيننا وبينه كما باعدت بينه وبين رحمتك، إنك على كل شيء قدير',
    count: 1,
    ref: 'من دعاء التابعي محمد بن واسع رحمه الله صباحاً ومساءً، وليس حديثاً مرفوعاً؛ قال ابن باز: لا بأس به',
  });
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
  { id: 'ruqyah', title: 'الرقية الشرعية', subtitle: 'آيات وسور يرقي بها نفسه', icon: 'shield', tone: 'teal', items: list('ruqyah', RUQYAH) },
  {
    id: 'masjid',
    title: 'دعاء الذهاب إلى المسجد',
    subtitle: 'كما في صحيح البخاري',
    icon: 'f-home',
    tone: 'teal',
    items: list('masjid', [
      {
        text: 'اللَّهُمَّ اجْعَلْ فِي قَلْبِي نُورًا، وَفِي بَصَرِي نُورًا، وَفِي سَمْعِي نُورًا، وَعَنْ يَمِينِي نُورًا، وَعَنْ يَسَارِي نُورًا، وَفَوْقِي نُورًا، وَتَحْتِي نُورًا، وَأَمَامِي نُورًا، وَخَلْفِي نُورًا، وَاجْعَلْ لِي نُورًا',
        note: 'قال كريب: «وسبعٌ في التابوت»، فذكر: عصبي، ولحمي، ودمي، وشعري، وبشري، وذكر خصلتين',
        ref: 'رواه البخاري (٦٣١٦) عن ابن عباس، وعند مسلم أنه خرج إلى الصلاة وهو يقوله',
      },
    ]),
  },
  { id: 'karb', title: 'أدعية الكرب والهم', subtitle: 'ما كان النبي ﷺ يقوله عند الكرب', icon: 'heart', tone: 'indigo', items: list('karb', KARB) },
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
  { text: 'سبحان الله وبحمده، عدد خلقه، ورضا نفسه، وزنة عرشه، ومداد كلماته', note: 'قالها ﷺ لجويرية: «لو وُزنت بما قلتِ منذ اليوم لوزنتهن» — رواه مسلم' },
  { text: 'سبحان الله وبحمده', note: 'من قالها في يوم مائة مرة حُطّت خطاياه وإن كانت مثل زبد البحر — متفق عليه' },
  { text: 'سبحان الله', note: 'من سبّح مائة تسبيحة كُتبت له ألف حسنة أو حُطّت عنه ألف خطيئة — رواه مسلم' },
  { text: 'الحمد لله', note: '«والحمد لله تملأ الميزان» — رواه مسلم' },
  { text: 'لا إله إلا الله وحده لا شريك له، له الملك وله الحمد، وهو على كل شيء قدير', note: 'من قالها في يوم مائة مرة كانت له عدل عشر رقاب، وحرزاً من الشيطان يومه ذلك — رواه مالك في الموطأ' },
  { text: 'أشهد أن لا إله إلا الله، وأن محمداً عبد الله ورسوله', note: 'بعد إسباغ الوضوء: «إلا فُتحت له أبواب الجنة الثمانية، يدخل من أيها شاء» — رواه مسلم' },
];

// The usual adhkar with a light vocalisation (only the marks that guide the reading), for the
// tasbeeh. Found by the dhikr's letters alone, so a text typed with or without vowels meets its entry.
const bare = (s) => s.replace(/[\u064B-\u0652\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim();
const VOCALISED = Object.fromEntries(
  [
    'لا إلهَ إلّا اللهُ وحدَهُ لا شريكَ له، له المُلكُ وله الحمدُ، وهو على كلِّ شيءٍ قدير',
    'اللهمَّ صلِّ وسلِّم وبارك على نبيِّنا محمد',
    'سبحانَ اللهِ وبحمدِه',
    'لا حولَ ولا قوّةَ إلّا بالله',
    'أستغفرُ اللهَ وأتوبُ إليه',
    'لا حولَ ولا قوّةَ إلّا باللهِ العليِّ العظيم',
    'أستغفرُ اللهَ الذي لا إلهَ إلّا هو الحيَّ القيّومَ وأتوبُ إليه',
    'اللهمَّ صلِّ على محمدٍ وعلى آلِ محمد، كما صلّيتَ على إبراهيمَ وعلى آلِ إبراهيم، إنّك حميدٌ مجيد. اللهمَّ بارك على محمدٍ وعلى آلِ محمد، كما باركتَ على إبراهيمَ وعلى آلِ إبراهيم، إنّك حميدٌ مجيد',
    'سبحانَ الله',
    'الحمدُ لله',
    'اللهُ أكبر',
    'لا إلهَ إلّا الله',
    'أستغفرُ الله',
    'سبحانَ اللهِ العظيم',
    'سبحانَ اللهِ وبحمدِه، سبحانَ اللهِ العظيم',
  ].map((v) => [bare(v).replace(/[،.]/g, ''), v])
);
export const vocalised = (text) => VOCALISED[bare(String(text)).replace(/[،.]/g, '')] || text;
