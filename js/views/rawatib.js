// «السنن الرواتب»: the twelve rak'at around the five prayers, before and after each.

import { num } from '../dates.js';
import { PRAYER_NAMES } from '../prayer.js';
import { PRAYERS, today } from '../today.js';
import { pageHeader } from '../ui.js';

// [before, after] in rak'at; Dhuhr's four before it are prayed two and two.
const RAWATIB = { fajr: ['2', ''], dhuhr: ['2 + 2', '2'], asr: ['', ''], maghrib: ['', '2'], isha: ['', '2'] };

export function render(view) {
  const info = today();
  // The prayer of this time; before sunrise and after Isha's it is the one coming.
  const now = Date.now() < info.times.fajr.at ? 'fajr' : info.lastPrayer.key;
  view.innerHTML = `
    ${pageHeader('السنن الرواتب', { back: '#/home' })}
    <section class="card rw-hadith">
      <p class="amiri">«مَنْ صَلَّى فِي يَوْمٍ وَلَيْلَةٍ ثِنْتَيْ عَشْرَةَ رَكْعَةً بُنِيَ لَهُ بَيْتٌ فِي الْجَنَّةِ»</p>
      <small>رواه الترمذي، وأصله في صحيح مسلم</small>
    </section>
    <p class="hint center">ثنتا عشرة ركعة في اليوم والليلة، مع الفرائض</p>
    <section class="card rw-table">
      <div class="rw-row head"><span>قبل</span><span>الصلاة</span><span>بعد</span></div>
      ${PRAYERS.map((k) => {
        const [b, a] = RAWATIB[k];
        return `<div class="rw-row ${k === now ? 'on' : ''}"><span>${b ? num(b) : '–'}</span><b>${PRAYER_NAMES[k]}</b><span>${a ? num(a) : '–'}</span></div>`;
      }).join('')}
    </section>
    <p class="rw-total">المجموع: ${num(12)} ركعة</p>
    <a class="btn ghost wide" href="#/worship">سجّلها في متابعة العبادات</a>`;
}
