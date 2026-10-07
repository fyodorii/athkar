// Memorization plan (منهاج الحفظ): two new faces (pages of the Madinah mushaf) a day for
// 300 days, then 20 days of consolidation. Each day also has «تكرار الأمس» (yesterday's two
// faces five times), «الربط» (the recent faces read once, 50 to 60 of them) and, from day 33,
// «المراجعة» (the older faces in slices, finished every six days). It follows the user's
// plan (plan.html) day by day.
// state.hifz = { on, day: plan day 1–320, checks: { 'd<day>-<task>': 'YYYY-MM-DD' } }

import { PAGES, SURAHS } from './quran-data.js';
import { state } from './store.js';

export const HIFZ_DAYS = 320;

export function hifzDay(d) {
  const e = { day: d, from: null, to: null, yesterday: null, link: null, review: null };
  // New faces: two a day, and the last three days take the remaining faces.
  if (d <= 297) [e.from, e.to] = [2 * d - 1, 2 * d];
  else if (d === 298) [e.from, e.to] = [595, 597];
  else if (d === 299) [e.from, e.to] = [598, 600];
  else if (d === 300) [e.from, e.to] = [601, 604];
  if (d >= 2 && d <= 301) {
    const y = hifzDay(d - 1);
    e.yesterday = { from: y.from, to: y.to, times: 5 };
  }
  if (d >= 3) {
    const from = d <= 32 ? 1 : 13 + 12 * Math.floor((d - 33) / 6);
    const to = d <= 297 ? 2 * d - 4 : { 298: 592, 299: 594, 300: 597, 301: 600 }[d] || PAGES;
    e.link = { from, to };
  }
  if (d >= 33) {
    const round = Math.floor((d - 33) / 6) + 1;
    const slice = (d - 33) % 6;
    e.review = { from: slice * 2 * round + 1, to: (slice + 1) * 2 * round, round };
  }
  return e;
}

// The surahs a range of faces touches (a surah that starts mid-face keeps the one before it).
export function surahsIn(from, to) {
  const names = [];
  SURAHS.forEach(([name, start], i) => {
    const end = i + 1 < SURAHS.length ? Math.max(start, SURAHS[i + 1][1] - 1) : PAGES;
    if (start <= to && end >= from) names.push(name);
  });
  return names;
}

// The day's tasks, in order; `part` says whether it is new memorization or revision.
// `n` formats the numbers (Arabic or Latin digits, from the settings).
export function dayTasks(d, n = String) {
  const e = hifzDay(d);
  const tasks = [];
  if (e.from) {
    tasks.push(
      { id: 'listen', part: 'new', label: 'السماع', detail: '٣ مرات لكل وجه من قارئ متقن' },
      { id: 'tafsir', part: 'new', label: 'التفسير', detail: 'الميسَّر أو المختصر في التفسير' },
      { id: 'record', part: 'new', label: 'التسجيل', detail: '٣ مرات متتالية حفظاً دون خطأ' },
      { id: 'repeat', part: 'new', label: 'التكرار', detail: '٤٠ مرة لكل وجه بمفرده' }
    );
  }
  if (e.yesterday) tasks.push({ id: 'yesterday', part: 'review', label: 'تكرار الأمس', detail: `الوجهان ${n(e.yesterday.from)}–${n(e.yesterday.to)} خمس مرات` });
  if (e.link) tasks.push({ id: 'link', part: 'review', label: 'الربط', detail: `من الوجه ${n(e.link.from)} إلى ${n(e.link.to)} مرة واحدة (${n(e.link.to - e.link.from + 1)} وجهاً)، والأفضل في صلاة` });
  if (e.review) tasks.push({ id: 'review', part: 'review', label: 'المراجعة', detail: `الجولة ${n(e.review.round)}: الأوجه ${n(e.review.from)}–${n(e.review.to)}، وتُختم كل ستة أيام` });
  return tasks;
}

const h = () => state.hifz;
export const taskKey = (d, id) => `d${d}-${id}`;
export const isChecked = (d, id) => !!h().checks[taskKey(d, id)];
export const partDone = (d, part) => {
  const list = dayTasks(d).filter((x) => !part || x.part === part);
  return list.length > 0 && list.every((x) => isChecked(d, x.id));
};
export function facesDone() {
  const d = h().day;
  if (d > 300) return PAGES;
  if (partDone(d, 'new')) return hifzDay(d).to;
  return d > 1 ? hifzDay(d - 1).to : 0;
}

// Ticks a task (dated today) and marks «ورد الحفظ» / «ورد المراجعة» in the worship tracker.
export function toggleTask(d, id, todayKey) {
  const key = taskKey(d, id);
  if (h().checks[key]) delete h().checks[key];
  else h().checks[key] = todayKey;
  const r = (state.worship[todayKey] ??= {});
  if (partDone(d, 'new')) r.hifz = 1;
  if (dayTasks(d).some((x) => x.part === 'review') && partDone(d, 'review')) r.review = 1;
}

// A finished plan day moves on by itself once a new calendar day starts.
export function advanceIfDone(todayKey) {
  const d = h().day;
  if (d >= HIFZ_DAYS || !partDone(d)) return false;
  const last = dayTasks(d).map((x) => h().checks[taskKey(d, x.id)]).sort().pop();
  if (last >= todayKey) return false;
  h().day = d + 1;
  return true;
}

export const HIFZ_STEPS = [
  ["السماع", "تَسْمَعُ الْوَجْهَ الَّذِي تُرِيدُ حِفْظَهُ مِنْ قَارِئٍ حَتَّى تَتَأَكَّدَ أَنَّكَ لَا تَلْحَنُ وَلَا تُخْطِئُ لَوْ قَرَأْتَهُ نَظَرًا، وَلَا يُسْمَحُ بِأَنْ يَنْقُصَ سَمَاعُ الْوَجْهِ عَنْ <b>٣ مَرَّاتٍ</b> لِلْوَجْهِ الْوَاحِدِ، وَتَخْتَارُ وَاحِدًا مِنْ هَؤُلَاءِ الْقُرَّاءِ: <b>محمد أيوب، علي الحذيفي، إبراهيم الأخضر</b> المسجل في مجمع الملك فهد لطباعة المصحف الشريف."],
  ["التفسير", "وَيَجِبُ بَعْدَ أَنْ تَسْمَعَ الْوَجْهَ أَنْ تَقْرَأَ تَفْسِيرَ الْوَجْهِ الَّذِي تُرِيدُ حِفْظَهُ، وَتَخْتَارُ وَاحِدًا مِنْ تَفْسِيرَيْنِ: <b>التفسير الميسَّر</b> أو <b>المختصر في التفسير</b>."],
  ["الإتقان", "وَبَعْدَ أَنْ تَقْرَأَ التَّفْسِيرَ تَبْدَأُ بِقِرَاءَةِ الْوَجْهِ حَتَّى تُتْقِنَهُ جِدًّا، سَوَاءٌ تَحْفَظُ كُلَّ آيَةٍ لِوَحْدِهَا، أَوْ تَحْفَظُ نِصْفَ وَجْهٍ ثُمَّ النِّصْفَ الْآخَرَ، أَوْ تُكَرِّرُ الْوَجْهَ كَامِلًا حَتَّى تُتْقِنَهُ، كُلُّ شَخْصٍ وَطَرِيقَتُهُ."],
  ["!", "وَعَلَيْكَ أَنْ تَنْتَبِهَ هُنَا لِأَمْرٍ مُهِمٍّ جِدًّا: وَأَنْتَ تَحْفَظُ الْوَجْهَ الْحَالِيَ لَا تَقِفُ عَلَى نِهَايَتِهِ، بَلْ لَا بُدَّ أَنْ تَأْخُذَ السَّطْرَ الْأَوَّلَ مِنَ الْوَجْهِ التَّالِي وَتُكَرِّرَهُ مَعَهُ؛ حَتَّى تَرْتَبِطَ الْأَوْجُهُ بَعْضُهَا بِبَعْضٍ."],
  ["التسجيل", "وَبَعْدَ إِتْقَانِهِ حِفْظًا، تُغْلِقُ الْمُصْحَفَ وَتُبْعِدُهُ عَنْكَ ثُمَّ تَفْتَحُ الْمُسَجِّلَ وَتُسَجِّلُ صَوْتَكَ فَتَقْرَأُ الْوَجْهَ <b>٣ مَرَّاتٍ مُتَتَالِيَةً حِفْظًا</b> دُونَ أَنْ تَفْتَحَ الْمُصْحَفَ."],
  ["التحقق", "بَعْدَ أَنْ تُسَجِّلَ تَفْتَحُ الْمُصْحَفَ وَتُشَغِّلُ التَّسْجِيلَ وَتُسَمِّعُ لِنَفْسِكَ جَمِيعَ <b>الثَّلَاثِ مَرَّاتٍ</b>، فَإِنْ لَمْ تُخْطِئْ مُطْلَقًا فَانْتَقِلْ لِلْخُطْوَةِ التَّالِيَةِ، وَإِنْ أَخْطَأْتَ وَلَوْ فِي وَاحِدَةٍ فَصَحِّحْ وَأَعِدْ تَسْجِيلَ الثَّلَاثِ مَرَّاتٍ وَأَنْتَ مُغْلِقُ الْمُصْحَفِ، وَلَا تَتَجَاوَزْ هَذِهِ الْمَرْحَلَةَ حَتَّى تَتَأَكَّدَ أَنَّكَ قَرَأْتَ الْوَجْهَ مُسَجَّلًا <b>٣ مَرَّاتٍ دُونَ خَطَأٍ</b>."],
  ["التكرار", "بَعْدَ ذَلِكَ تَبْدَأُ فِي تَكْرَارِ الْوَجْهِ <b>٤٠ مَرَّةً</b> حِفْظًا دُونَ أَنْ تَفْتَحَ الْمُصْحَفَ، ثُمَّ انْتَقِلْ لِلْوَجْهِ الثَّانِي وَافْعَلْ بِهِ كَمَا فَعَلْتَ بِالْأَوَّلِ تَمَامًا."],
  ["التركيز", "كُلُّ وَجْهٍ يُكَرَّرُ بِمَفْرَدِهِ <b>٤٠ مَرَّةً</b>، وَلَا يُسْمَحُ بِتَكْرَارِ الْوَجْهَيْنِ مُجْتَمِعَيْنِ فِي تِكْرَارٍ وَاحِدَةٍ، وَذَلِكَ أَحْسَنُ فِي التَّرْكِيزِ."],
];
