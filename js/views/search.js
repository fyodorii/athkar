// Search across the app: its sections, the adhkar of every set, «أذكاري» and «أدعيتي».

import { CATEGORIES } from '../adhkar-data.js';
import { icon } from '../icons.js';
import { state } from '../store.js';
import { esc, openSheet } from '../ui.js';

const SECTIONS = [
  ['#/home', 'الرئيسية', 'home'],
  ['#/mine', 'أذكاري', 'heart'],
  ['#/notebook', 'أدعيتي', 'hand'],
  ['#/tasbeeh', 'السبحة', 'beads'],
  ['#/counter', 'العداد', 'hash'],
  ['#/worship', 'متابعة العبادات', 'check'],
  ['#/radio', 'الإذاعة', 'radio'],
  ['#/audio', 'الصوتيات', 'play'],
  ['#/calendar', 'التقويم', 'calendar'],
  ['#/khatma', 'الختمات', 'quran'],
  ['#/rawatib', 'النوافل', 'mosque'],
  ['#/reminders', 'تذكيراتي', 'bell'],
  ['#/debts', 'الديون', 'wallet'],
  ['#/datecalc', 'حاسبة التاريخ', 'grid'],
  ['#/tools', 'الأدوات', 'widget'],
  ['#/sahw', 'سجود السهو', 'widget'],
  ['#/nahy', 'أوقات النهي', 'widget'],
  ['#/settings', 'الإعدادات', 'gear'],
  ['#/settings/notify', 'التنبيهات والإقامة', 'bell'],
  ['#/settings/fonts', 'الخطوط والألوان', 'type'],
  ['#/settings/location', 'الموقع', 'pin'],
];

const norm = (s) => String(s).replace(/[ً-ٰٟـۖ-ۭ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const snip = (text, q) => {
  const t = String(text).replace(/\s+/g, ' ');
  const i = norm(t).indexOf(q);
  const from = Math.max(0, i - 30);
  return (from ? '…' : '') + t.slice(from, from + 90) + (t.length > from + 90 ? '…' : '');
};

export function openSearch() {
  openSheet(
    `<label class="search">${icon('search', 18)}<input type="search" placeholder="ابحث في الأقسام والأذكار والأدعية" data-q></label><div class="menu search-res" data-res></div>`,
    (el, close) => {
      const input = el.querySelector('[data-q]');
      const res = el.querySelector('[data-res]');
      const run = () => {
        const q = norm(input.value.trim());
        if (q.length < 2) {
          res.innerHTML = '<p class="hint center">اكتب حرفين أو أكثر.</p>';
          return;
        }
        const out = [];
        for (const [href, name, ic] of SECTIONS) if (norm(name).includes(q)) out.push([href, ic, name, 'قسم']);
        for (const c of CATEGORIES) {
          if (norm(c.title).includes(q)) out.push([`#/adhkar/${c.id}`, c.icon || 'book', c.title, 'أذكار']);
          for (const x of c.items) {
            if (!norm(`${x.title || ''} ${x.text}`).includes(q)) continue;
            out.push([`#/adhkar/${c.id}`, c.icon || 'book', x.title && norm(x.title).includes(q) ? x.title : snip(x.text, q), c.title]);
          }
        }
        for (const x of state.custom) if (norm(x.text).includes(q)) out.push([`#/mine/${x.id}`, 'heart', snip(x.text, q), 'أذكاري']);
        for (const x of state.notebook) if (norm(`${x.title} ${x.text}`).includes(q)) out.push(['#/notebook', 'hand', x.title || snip(x.text, q), 'أدعيتي']);
        res.innerHTML = out.length
          ? out.slice(0, 40).map(([href, ic, title, sub]) => `<a class="search-hit" href="${href}">${icon(ic, 20)}<span><b>${esc(title)}</b><small>${esc(sub)}</small></span></a>`).join('')
          : '<p class="hint center">لا نتائج.</p>';
      };
      input.addEventListener('input', run);
      res.addEventListener('click', (e) => e.target.closest('a') && close());
      run();
      setTimeout(() => input.focus(), 250);
    },
    { title: 'بحث' }
  );
}
