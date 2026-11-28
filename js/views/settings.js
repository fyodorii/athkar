// Settings: location, calculation, display and backup.

import { CITIES, nearestCity } from '../cities.js';
import { googleAccount } from '../google.js';
import { APP_NAME, APP_VERSION, DESIGNER } from '../config.js';
import { clockText, hijriText, num } from '../dates.js';
import { icon } from '../icons.js';
import { METHODS, PRAYER_NAMES } from '../prayer.js';
import { exportData, importData, save, state } from '../store.js';
import { today } from '../today.js';
import { PRAYERS } from '../today.js';
import { anyTimerRunning, keepAwake } from '../timers.js';
import { $, ACCENTS, copyText, esc, FONT_NAMES, FONTS, haptic, openSheet, pageHeader, QURAN_COLORS, QURAN_FONTS, QURAN_WEIGHTS, toast, toggle, WEIGHTS } from '../ui.js';

const row = (href, ic, label, value = '') =>
  `<a class="row" href="${href}"><span class="row-icon">${icon(ic, 20)}</span><span class="row-label">${label}</span><span class="row-value">${value}</span>${icon('chevron', 18, 'muted')}</a>`;

// ---- Main list ----

export function render(view) {
  const s = state.settings;
  view.innerHTML = `
    ${pageHeader('الإعدادات', { back: '#/home' })}
    <div class="group">
      <h4>الموقع والأوقات</h4>
      ${row('#/settings/location', 'pin', 'الموقع', esc(s.location.name))}
      ${row('#/settings/method', 'sun', 'طريقة الحساب', esc(METHODS[s.method]?.name.split(' — ')[0]))}
      ${row('#/settings/notify', 'clock', 'الإقامة', 'المدة بين الأذان والإقامة')}
      ${row('#/settings/order', 'rows', 'ترتيب الرئيسية والأدوات', 'إظهار وإخفاء وترتيب')}
      ${row('#/settings/icon', 'stars', 'أيقونة التطبيق', APP_ICONS.find((x) => x[0] === s.appIcon)?.[1] || '')}
    </div>
    <div class="group">
      <h4>الاهتزاز</h4>
      <div class="row"><span class="row-icon">${icon('vibrate', 20)}</span><span class="row-label">الاهتزاز<small>${s.haptics ? 'مفعّل: عند العدّ والتسجيل وتنبيه الأعداد' : 'متوقف: لا يهتز التطبيق أبداً'}</small></span>${toggle('haptics', s.haptics)}</div>
      <p class="hint">على الآيفون يُحَسّ الاهتزاز بعد تفعيل «اللمس الاهتزازي للنظام» في إعدادات الجهاز ← الأصوات واللمس.</p>
    </div>
    <div class="group">
      <h4>السبحة</h4>
      <button class="row" data-tasbeeh><span class="row-icon">${icon('beads', 20)}</span><span class="row-label">إعدادات السبحة<small>الشكل والخط والألوان، الهدف، تنبيه الأعداد، المجموعات</small></span>${icon('chevron', 18, 'muted')}</button>
    </div>
    <div class="group">
      <h4>العرض</h4>
      <div class="row"><span class="row-icon">${icon('palette', 20)}</span><span class="row-label">المظهر</span>
        <div class="seg-mini" data-theme>
          ${[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(([v, l]) => `<button class="${s.theme === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}
        </div></div>
      <div class="row"><span class="row-icon">${icon('layers', 20)}</span><span class="row-label">تصميم مسطّح<small>ضوء مسطّح وألوان أقل، بلا زجاج سائل</small></span>${toggle('flat', s.flat)}</div>
      ${row('#/settings/fonts', 'type', 'الخطوط والألوان', `${ACCENTS.find((a) => a[0] === (s.accent || 'blue'))?.[1] || ''} · ${FONT_NAMES[s.fontUi] || ''}`)}
      <div class="row"><span class="row-icon">${icon('clock', 20)}</span><span class="row-label">نظام ٢٤ ساعة</span>${toggle('clock24', s.clock24)}</div>
      <div class="row"><span class="row-icon">${icon('clock', 20)}</span><span class="row-label">إظهار الساعة أعلى الرئيسية</span>${toggle('topClock', s.topClock)}</div>
      <div class="row"><span class="row-icon">${icon('sun', 20)}</span><span class="row-label">إبقاء الشاشة مضاءة<small>لا تنطفئ الشاشة ولا يُقفل الجوال والتطبيق مفتوح</small></span>${toggle('awake', s.awake)}</div>
      <div class="row"><span class="row-icon">${icon('digits', 20)}</span><span class="row-label">نوع الأرقام</span>
        <div class="seg-mini" data-digits>
          ${[['arab', '١٢٣'], ['latn', '123']].map(([v, l]) => `<button class="${s.digits === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}
        </div></div>
      <div class="row"><span class="row-icon">${icon('calendar', 20)}</span><span class="row-label">تعديل التاريخ الهجري</span>
        <div class="stepper" data-hijri><button data-d="-1">−</button><b>${num(s.hijriAdjust > 0 ? '+' + s.hijriAdjust : s.hijriAdjust)}</b><button data-d="1">+</button></div></div>
      <p class="hint">اليوم: ${hijriText(today().day, s.hijriAdjust)}. عدّله يوماً إن خالف رؤية الهلال في بلدك.</p>
    </div>
    <div class="group">
      <h4>بياناتك</h4>
      ${row('#/settings/account', 'upload', 'حساب Google', googleAccount().email ? esc(googleAccount().email) : 'الدخول والحفظ في Drive')}
      <button class="row" data-export><span class="row-icon">${icon('download', 20)}</span><span class="row-label">نسخة احتياطية</span><span class="row-value">تصدير</span></button>
      <label class="row"><span class="row-icon">${icon('upload', 20)}</span><span class="row-label">استعادة نسخة</span><span class="row-value">استيراد</span><input type="file" accept="application/json,.json" hidden data-import></label>
      <p class="hint">بياناتك محفوظة على جهازك. ادخل بحساب Google لتُحفظ في حسابك، أو صدّر نسخة إلى ملفاتك أو iCloud بين حين وآخر.</p>
    </div>
    <div class="group about">
      <img src="icons/alt/${APP_ICONS.some((x) => x[0] === s.appIcon) ? s.appIcon : 'sky'}.png" alt="" width="72" height="72">
      <b>${APP_NAME}</b>
      <p>«ألا بذكر الله تطمئن القلوب»</p>
      <button class="btn primary" data-share-app>${icon('share', 20)} شارك التطبيق</button>
      <p class="credit">تصميم التطبيق <b>${DESIGNER}</b></p>
      <small>الإصدار ${num(APP_VERSION)}</small>
    </div>`;

  const onChange = (e) => {
    const t = e.target;
    if (t.name === 'clock24') s.clock24 = t.checked;
    if (t.name === 'haptics') s.haptics = t.checked;
    if (t.name === 'haptics' && s.haptics) haptic(30, true); // a buzz to feel it on
    if (t.name === 'flat') s.flat = t.checked;
    if (t.name === 'topClock') s.topClock = t.checked;
    if (t.name === 'awake') {
      s.awake = t.checked;
      if (s.awake || !anyTimerRunning()) keepAwake(s.awake);
      if (s.awake && !navigator.wakeLock) toast('هذا الجهاز لا يدعم إبقاء الشاشة مضاءة (يحتاج iOS 16.4 أو أحدث)');
    }
    if (t.matches('[data-import]') && t.files[0]) {
      t.files[0].text().then((text) => {
        try {
          importData(text);
          toast(`${icon('check', 18)} استُعيدت بياناتك`);
          render(view);
        } catch (err) {
          toast(err.message || 'تعذرت قراءة الملف');
        }
      });
      return;
    }
    save();
    if (t.name === 'clock24' || t.name === 'haptics') render(view);
  };
  const onClick = (e) => {
    const dg = e.target.closest('[data-digits] [data-v]');
    if (dg) {
      s.digits = dg.dataset.v;
      save();
      return render(view);
    }
    const th = e.target.closest('[data-theme] [data-v]');
    if (th) {
      s.theme = th.dataset.v;
      save();
      return render(view);
    }
    const hd = e.target.closest('[data-hijri] [data-d]');
    if (hd) {
      s.hijriAdjust = Math.max(-2, Math.min(2, s.hijriAdjust + Number(hd.dataset.d)));
      save();
            return render(view);
    }
    if (e.target.closest('[data-tasbeeh]')) import('./adhkar.js').then((m) => m.tasbeehSettings());
    if (e.target.closest('[data-export]')) exportBackup();
    if (e.target.closest('[data-share-app]')) shareApp();
  };
  view.onchange = onChange;
  view.onclick = onClick;
  return {
    destroy() {
      view.onchange = view.onclick = null;
    },
  };
}

// The app as a card to pass on: what it holds, its link, and the share sheet of the phone.
export function shareApp() {
  const url = `${location.origin}${location.pathname}`;
  const text = `تطبيق «${APP_NAME}» 🌙\nمواقيت الصلاة والأذكار، السبحة، متابعة العبادات، الختمة والسنن الرواتب — بلا إعلانات، ويعمل دون إنترنت.\n«من دلّ على خير فله مثل أجر فاعله»`;
  openSheet(
    `<div class="share-card">
       <img src="icons/alt/sky.png" alt="" width="84" height="84">
       <b>${APP_NAME}</b>
       <p>مواقيت الصلاة والأذكار، السبحة، متابعة العبادات، الختمة والسنن الرواتب</p>
       <ul><li>${icon('check', 16)} بلا إعلانات</li><li>${icon('check', 16)} يعمل دون إنترنت</li><li>${icon('check', 16)} بياناتك على جهازك</li></ul>
       <span class="share-url">${esc(url.replace(/^https?:\/\//, ''))}</span>
       <small>تصميم ${DESIGNER}</small>
     </div>
     <p class="hint center">«من دلّ على خير فله مثل أجر فاعله» — رواه مسلم</p>
     <div class="sheet-actions">
       <button class="btn primary" data-go>${icon('share', 20)} مشاركة</button>
       <button class="btn ghost" data-copy>${icon('copy', 20)} نسخ الرابط</button>
     </div>`,
    (el, close) =>
      el.addEventListener('click', async (e) => {
        if (e.target.closest('[data-copy]')) return copyText(`${text}\n${url}`);
        if (!e.target.closest('[data-go]')) return;
        if (navigator.share) {
          try {
            await navigator.share({ title: APP_NAME, text, url });
            close();
          } catch (err) {
            if (err.name !== 'AbortError') copyText(`${text}\n${url}`);
          }
        } else copyText(`${text}\n${url}`);
      }),
    { title: 'شارك التطبيق' }
  );
}

async function exportBackup() {
  const text = exportData();
  const name = `adhkar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'نسخة احتياطية — مواقيت' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---- Location ----

export function renderLocation(view) {
  const s = state.settings;
  let q = '';
  const draw = () => {
    const list = CITIES.filter((c) => !q || c.name.includes(q) || c.country.includes(q));
    $('[data-cities]', view).innerHTML = list
      .map(
        (c) => `<button class="row city ${s.location.name === c.name ? 'on' : ''}" data-city="${CITIES.indexOf(c)}">
          <span class="row-label">${esc(c.name)}<small>${esc(c.country)}</small></span>${s.location.name === c.name ? icon('check', 20) : ''}</button>`
      )
      .join('');
  };
  view.innerHTML = `
    ${pageHeader('الموقع', { back: '#/settings' })}
    <div class="group">
      <div class="loc-now">${icon('pin', 22)}<div><b>${esc(s.location.name)}</b><small>${num(s.location.lat.toFixed(3))}، ${num(s.location.lng.toFixed(3))}</small></div></div>
      <button class="btn primary wide" data-gps>${icon('locate', 20)} تحديد موقعي تلقائياً</button>
      <p class="hint">الموقع يُستعمل لحساب المواقيت والقبلة على جهازك فقط، ولا يُرسل إلا اسم المدينة لتحديدها.</p>
    </div>
    <label class="search">${icon('search', 18)}<input type="search" placeholder="ابحث عن مدينة" data-q></label>
    <div class="group list" data-cities></div>`;
  draw();

  const pick = (loc, method) => {
    s.location = loc;
    if (method) s.method = method;
    save();
      };

  view.oninput = (e) => {
    if (!e.target.matches('[data-q]')) return;
    q = e.target.value.trim();
    draw();
  };
  view.onclick = (e) => {
    const c = e.target.closest('[data-city]');
    if (c) {
      const city = CITIES[Number(c.dataset.city)];
      pick({ name: city.name, lat: city.lat, lng: city.lng, tz: city.tz, source: 'city' }, city.method);
      toast(`${icon('check', 18)} ${esc(city.name)} — ${esc(METHODS[city.method].name.split(' — ')[0])}`);
      location.replace('#/home');
      return;
    }
    if (e.target.closest('[data-gps]')) locate(pick);
  };
  return {
    destroy() {
      view.oninput = view.onclick = null;
    },
  };
}

function locate(pick) {
  if (!navigator.geolocation) return toast('تحديد الموقع غير متاح في هذا المتصفح');
  toast('جارٍ تحديد موقعك…');
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = Number(pos.coords.latitude.toFixed(4));
      const lng = Number(pos.coords.longitude.toFixed(4));
      const near = nearestCity(lat, lng);
      let name = near.km < 35 ? near.city.name : '';
      if (!name) {
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=ar`
          );
          const d = await res.json();
          name = d.city || d.locality || d.principalSubdivision || '';
        } catch (e) {
          // Offline: fall back to a generic name.
        }
      }
      // The device's own zone, since this is where the phone is now.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      pick({ name: name || 'موقعي الحالي', lat, lng, tz, source: 'gps' }, near.km < 600 ? near.city.method : null);
      toast(`${icon('check', 18)} ${esc(name || 'موقعك الحالي')}`);
      location.replace('#/home');
    },
    (err) => {
      toast(err.code === 1 ? 'لم يُسمح بالوصول إلى الموقع. فعّله من الإعدادات ← الخصوصية ← خدمات الموقع ← Safari' : 'تعذر تحديد الموقع، اختر مدينتك من القائمة');
    },
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
  );
}

// ---- Calculation method ----

// What each manual correction moves, now that the five prayers themselves are not listed.
const EDIT_NOTE = {
  dhuhr: 'يحدد قيام الشمس (وقت النهي) قبل الظهر',
  asr: 'يحدد بدء وقت النهي بعد العصر',
  maghrib: 'يحدد نهاية وقت النهي وبداية الليل',
  fajr: 'يحدد بدء وقت النهي بعد الفجر ونهاية الليل',
};

export function renderMethod(view) {
  const s = state.settings;
  const draw = () => {
    const t = today().times;
    view.innerHTML = `
      ${pageHeader('طريقة الحساب', { back: '#/settings' })}
      <div class="group list">
        ${Object.entries(METHODS)
          .map(
            ([k, m]) => `<button class="row ${s.method === k ? 'on' : ''}" data-m="${k}">
              <span class="row-label">${esc(m.name)}<small>الفجر ${num(m.fajr)}° • العشاء ${m.ishaMinutes ? `${num(m.ishaMinutes)} دقيقة بعد المغرب` : `${num(m.isha)}°`}</small></span>
              ${s.method === k ? icon('check', 20) : ''}</button>`
          )
          .join('')}
      </div>
      <div class="group">
        <h4>صلاة العصر</h4>
        <div class="seg-mini wide" data-asr>
          <button class="${s.asr === 1 ? 'on' : ''}" data-v="1">الجمهور (ظل الشيء مثله)</button>
          <button class="${s.asr === 2 ? 'on' : ''}" data-v="2">الحنفي (مثلاه)</button>
        </div>
      </div>
      <div class="group">
        <h4>تعديل يدوي بالدقائق</h4>
        ${['sunrise', 'dhuhr', 'asr', 'maghrib', 'fajr']
          .map(
            (k) => `<div class="row"><span class="row-label">${PRAYER_NAMES[k]}<small>${k === 'sunrise' ? `الشروق ${clockText(t.sunrise.hours, s.clock24)} • الضحى ${clockText(t.duha.hours, s.clock24)} إلى ${clockText(t.duhaEnd.hours, s.clock24)}` : EDIT_NOTE[k]}</small></span>
              <div class="stepper" data-off="${k}"><button data-d="-1">−</button><b>${num(s.offsets[k] > 0 ? '+' + s.offsets[k] : s.offsets[k])}</b><button data-d="1">+</button></div></div>`
          )
          .join('')}
        <p class="hint">استعمله ليطابق التطبيق تقويم مسجدك أو وزارة الأوقاف في بلدك. وتتبعه أوقات الضحى ومنتصف الليل والثلث الأخير وأوقات النهي.</p>
      </div>`;
  };
  draw();
  view.onclick = (e) => {
    const m = e.target.closest('[data-m]');
    if (m) s.method = m.dataset.m;
    const a = e.target.closest('[data-asr] [data-v]');
    if (a) s.asr = Number(a.dataset.v);
    const o = e.target.closest('[data-off] [data-d]');
    if (o) {
      const k = o.closest('[data-off]').dataset.off;
      s.offsets[k] = Math.max(-30, Math.min(30, s.offsets[k] + Number(o.dataset.d)));
    }
    if (m || a || o) {
      save();
            const y = window.scrollY;
      draw();
      window.scrollTo(0, y);
    }
  };
  return { destroy: () => (view.onclick = null) };
}

export const APP_ICONS = [
  ['emerald', 'زمردي'],
  ['sky', 'أزرق'],
  ['night', 'ليلي'],
  ['violet', 'بنفسجي'],
  ['parchment', 'ورق المصحف'],
  ['black', 'أسود'],
  ['burgundy', 'عنابي'],
  ['gold', 'ذهبي'],
];

// The home-screen icon. iOS takes it when the app is added to the home screen, so a new
// choice shows after adding it again from Safari (the link carries the choice).
export function renderIcon(view) {
  const s = state.settings;
  const draw = () => {
    const link = `${location.origin}${location.pathname}?icon=${s.appIcon}`;
    view.innerHTML = `
      ${pageHeader('أيقونة التطبيق', { back: '#/settings', sub: 'اختر أيقونة جديدة للتطبيق' })}
      <div class="icon-grid">
        ${APP_ICONS.map(([id, name]) => `<button class="icon-pick ${s.appIcon === id ? 'on' : ''}" data-icon="${id}"><img src="icons/alt/${id}.png?v=4" alt="" width="90" height="90"><span>${name}</span></button>`).join('')}
      </div>
      <div class="group">
        <h4>كيف تظهر الأيقونة الجديدة؟</h4>
        <p class="hint">آبل تأخذ أيقونة تطبيقات الويب عند إضافتها إلى الشاشة الرئيسية فقط، فلا تتغير وحدها بعد ذلك.</p>
        <ol class="steps">
          <li>اختر الأيقونة أعلاه، ثم اضغط «نسخ رابط التطبيق بهذه الأيقونة».</li>
          <li>افتح الرابط في <b>Safari</b> ← زر المشاركة ← <b>إضافة إلى الشاشة الرئيسية</b>.</li>
          <li>انقل بياناتك إلى النسخة الجديدة: من <b>الإعدادات ← النسخ الاحتياطي</b> في القديمة صدّر نسختك، واستعدها في الجديدة، ثم احذف القديمة.</li>
        </ol>
        <button class="btn primary wide" data-icon-link="${esc(link)}">${icon('copy', 20)} نسخ رابط التطبيق بهذه الأيقونة</button>
      </div>`;
  };
  draw();
  view.onclick = (e) => {
    const b = e.target.closest('[data-icon]');
    if (b) {
      s.appIcon = b.dataset.icon;
      save();
      const l = document.querySelector('link[rel=apple-touch-icon]');
      if (l) l.href = `icons/alt/${s.appIcon}.png?v=4`; // ?v= as in index.html: a new address so iOS fetches the icon afresh
      return draw();
    }
    const c = e.target.closest('[data-icon-link]');
    if (c) copyText(c.dataset.iconLink);
  };
  return { destroy: () => (view.onclick = null) };
}

// ---- Fonts ----

export function renderFonts(view) {
  const s = state.settings;
  const picker = (key, weightKey, title) => `
    <div class="group fonts">
      <div class="f-head"><h4>${title}</h4><span>${FONT_NAMES[s[key]]}</span></div>
      <div class="f-grid" data-font="${key}">
        ${Object.keys(FONTS)
          .map(
            (v) => `<button class="${s[key] === v ? 'on' : ''}" data-v="${v}">
              <small>${FONT_NAMES[v]}</small>${s[key] === v ? `<i>${icon('check', 14)}</i>` : ''}
              <b style="font-family:${FONTS[v]}">أبجد هوز · ${num(123)}</b></button>`
          )
          .join('')}
      </div>
      <div class="f-head"><h4>وزن الخط</h4><span>${WEIGHTS.find((w) => w[0] === s[weightKey])?.[1] || ''}</span></div>
      <div class="chips scroll" data-weight="${weightKey}">
        ${WEIGHTS.map(([w, l]) => `<button class="chip-opt ${s[weightKey] === w ? 'on' : ''}" data-v="${w}" style="font-family:${FONTS[s[key]]};font-weight:${w}">${l}</button>`).join('')}
      </div>
    </div>`;
  // A size with − and + and a slider: the adhkar's text scale, or the tasbeeh dhikr's pixels.
  const SIZES = {
    text: { get: () => s.textScale, set: (v) => (s.textScale = Math.round(Math.max(0.85, Math.min(1.5, v)) * 100) / 100), min: 0.85, max: 1.5, step: 0.05, show: (v) => `${num(Math.round(v * 100))}%` },
    tsb: { get: () => state.tasbeeh.fontSize || 40, set: (v) => (state.tasbeeh.fontSize = Math.round(Math.max(22, Math.min(110, v)))), min: 22, max: 110, step: 2, show: (v) => num(v) },
  };
  const sizer = (k, title, shown) => `
    <div class="group fonts">
      <div class="f-head"><h4>${title}</h4><span data-size-out="${k}">${shown}</span></div>
      <div class="f-size">
        <button class="icon-btn ghost" data-size="${k}" data-d="-1" aria-label="أصغر">${icon('minus', 22)}</button>
        <input type="range" min="${SIZES[k].min}" max="${SIZES[k].max}" step="${SIZES[k].step}" value="${SIZES[k].get()}" data-size-range="${k}">
        <button class="icon-btn ghost" data-size="${k}" data-d="1" aria-label="أكبر">${icon('plus', 22)}</button>
      </div>
    </div>`;
  const setSize = (k, v) => {
    const z = SIZES[k];
    z.set(v);
    save();
    $(`[data-size-out="${k}"]`, view).textContent = z.show(z.get());
    $(`[data-size-range="${k}"]`, view).value = z.get();
    if (k === 'text') $('[data-text-sample]', view).style.fontSize = `calc(1.3rem * ${s.textScale})`;
    else $('[data-tsb-sample]', view).style.fontSize = `${Math.min(48, z.get())}px`;
  };
  const draw = () => {
    view.innerHTML = `
      ${pageHeader('الخطوط والألوان', { back: '#/settings' })}
      <div class="group fonts">
        <div class="f-head"><h4>لون التطبيق</h4><span>${esc(ACCENTS.find((a) => a[0] === (s.accent || 'blue'))?.[1] || '')}</span></div>
        <div class="accent-pick" data-accent-pick>
          ${ACCENTS.map(([id, name, c]) => `<button class="${(s.accent || 'blue') === id ? 'on' : ''}" data-v="${id}" style="--c:${c}" aria-label="${name}">${(s.accent || 'blue') === id ? icon('check', 18) : ''}</button>`).join('')}
        </div>
      </div>
      ${picker('fontUi', 'uiWeight', 'خط الواجهة')}
      <div class="group fonts">
        <div class="f-head"><h4>حجم العناوين</h4><span data-head-pct>${num(Math.round(s.headScale * 100))}%</span></div>
        <div class="f-size">
          <button class="icon-btn ghost" data-head="-0.02" aria-label="أصغر">${icon('minus', 22)}</button>
          <input type="range" min="0.8" max="1.3" step="0.01" value="${s.headScale}" data-head-range>
          <button class="icon-btn ghost" data-head="0.02" aria-label="أكبر">${icon('plus', 22)}</button>
        </div>
        <button class="link" data-head-reset>الحجم الأصلي · ${num(100)}%</button>
        <p class="hint">كل حجم نسبة إلى تصميم التطبيق. العناوين البارزة تحتفظ بوزن أثقل لتبقى واضحة.</p>
      </div>
      ${picker('fontText', 'textWeight', 'خط الأذكار')}
      <div class="group fonts">
        <div class="f-head"><h4>خط الآيات القرآنية</h4><span>${QURAN_FONTS[s.fontQuran || 'hafs'][0]}</span></div>
        <div class="f-grid q-grid" data-qfont>
          ${Object.entries(QURAN_FONTS).map(([v, [name, fam]]) => `<button class="${(s.fontQuran || 'hafs') === v ? 'on' : ''}" data-v="${v}"><small>${name}</small>${(s.fontQuran || 'hafs') === v ? `<i>${icon('check', 14)}</i>` : ''}<b style="font-family:${fam}">ٱلۡحَمۡدُ لِلَّهِ</b></button>`).join('')}
        </div>
        <div class="f-head"><h4>لون الآيات</h4><span>${(QURAN_COLORS[s.quranColor] || QURAN_COLORS.blue)[0]}</span></div>
        <div class="q-colors" data-qcolor>
          ${Object.entries(QURAN_COLORS).map(([v, [name, c]]) => `<button class="${(s.quranColor || 'blue') === v ? 'on' : ''}" data-v="${v}" style="--c:${c}" aria-label="${name}">${(s.quranColor || 'blue') === v ? icon('check', 16) : ''}</button>`).join('')}
        </div>
        <div class="f-head"><h4>وزن خط الآيات</h4><span>${QURAN_WEIGHTS.find((w) => w[0] === (s.quranWeight || 400))?.[1] || ''}</span></div>
        <div class="chips scroll" data-qweight>
          ${QURAN_WEIGHTS.map(([w, l]) => `<button class="chip-opt ${(s.quranWeight || 400) === w ? 'on' : ''}" data-v="${w}">${l}</button>`).join('')}
        </div>
        <p class="hafs q-sample" style="font-size:24px;line-height:2;text-align:center;margin:12px 0 0">﴿ٱلۡحَمۡدُ لِلَّهِ رَبِّ ٱلۡعَٰلَمِينَ﴾</p>
      </div>
      ${sizer('text', 'حجم خط الأذكار', `${num(Math.round(s.textScale * 100))}%`)}
      <p class="sample amiri" data-text-sample style="font-size:calc(1.3rem * ${s.textScale})">سبحان الله وبحمده، سبحان الله العظيم</p>
      <p class="hint center">لآيات القرآن خطها ولونها ووزنها في «خط الآيات القرآنية» أعلاه.</p>
      ${picker('fontTsb', 'tsbWeight', 'خط السبحة')}
      ${sizer('tsb', 'حجم خط السبحة', num(state.tasbeeh.fontSize || 40))}
      <p class="sample tsb-sample" data-tsb-sample style="font-size:${Math.min(48, state.tasbeeh.fontSize || 40)}px">سبحان الله وبحمده</p>`;
  };
  draw();
  const setHead = (v) => {
    s.headScale = Math.round(Math.max(0.8, Math.min(1.3, v)) * 100) / 100;
    save();
    $('[data-head-pct]', view).textContent = `${num(Math.round(s.headScale * 100))}%`;
    $('[data-head-range]', view).value = s.headScale;
  };
  view.onclick = (e) => {
    const ac = e.target.closest('[data-accent-pick] [data-v]');
    if (ac) {
      s.accent = ac.dataset.v;
      save();
      const y = window.scrollY;
      draw();
      return window.scrollTo(0, y);
    }
    const qc = e.target.closest('[data-qcolor] [data-v]');
    const qw = e.target.closest('[data-qweight] [data-v]');
    if (qc || qw) {
      if (qc) s.quranColor = qc.dataset.v;
      if (qw) s.quranWeight = Number(qw.dataset.v);
      save();
      const c = QURAN_COLORS[s.quranColor] || QURAN_COLORS.blue;
      const r = document.documentElement.style;
      r.setProperty('--ayah-light', c[1]);
      r.setProperty('--ayah-dark', c[2]);
      r.setProperty('--quran-weight', String(s.quranWeight || 400));
      return draw();
    }
    const qf = e.target.closest('[data-qfont] [data-v]');
    if (qf) {
      s.fontQuran = qf.dataset.v;
      save();
      document.documentElement.style.setProperty('--font-quran', QURAN_FONTS[s.fontQuran][1]);
      return draw();
    }
    const f = e.target.closest('[data-font] [data-v]');
    const w = e.target.closest('[data-weight] [data-v]');
    if (f) s[f.closest('[data-font]').dataset.font] = f.dataset.v;
    if (w) s[w.closest('[data-weight]').dataset.weight] = Number(w.dataset.v);
    if (f || w) {
      save();
      const y = window.scrollY;
      const x = w ? w.parentElement.scrollLeft : 0;
      const which = w?.closest('[data-weight]').dataset.weight;
      draw();
      window.scrollTo(0, y);
      if (which) $(`[data-weight="${which}"]`, view).scrollLeft = x;
      return;
    }
    const z = e.target.closest('[data-size]');
    if (z) return setSize(z.dataset.size, SIZES[z.dataset.size].get() + Number(z.dataset.d) * SIZES[z.dataset.size].step);
    const h = e.target.closest('[data-head]');
    if (h) return setHead(s.headScale + Number(h.dataset.head));
    if (e.target.closest('[data-head-reset]')) setHead(1);
  };
  view.oninput = (e) => {
    if (e.target.matches('[data-head-range]')) setHead(Number(e.target.value));
    if (e.target.matches('[data-size-range]')) setSize(e.target.dataset.sizeRange, Number(e.target.value));
  };
  return { destroy: () => (view.onclick = view.oninput = null) };
}

// ---- Reminders and the iqama ----

// Loaded when the notifications page opens, so a blocked file does not stop the settings.

// «الإقامة»: the minutes between each adhan and its iqama, shown on the home screen after the adhan.
export function renderNotify(view) {
  const s = state.settings;
  const draw = () => {
    view.innerHTML = `
      ${pageHeader('الإقامة', { back: '#/settings' })}
      <div class="group">
        <h4>الإقامة بعد الأذان بالدقائق</h4>
        ${PRAYERS.map(
          (k) => `<div class="row"><span class="row-label">${PRAYER_NAMES[k]}</span>
            <div class="stepper" data-iqama="${k}"><button data-d="-1">−</button><b>${num(s.iqama[k])}</b><button data-d="1">+</button></div></div>`
        ).join('')}
        <p class="hint">تظهر في الرئيسية بعد الأذان: «مضى على الأذان… الإقامة بعد…». اجعلها صفراً لإخفائها.</p>
      </div>`;
  };
  draw();
  view.onclick = (e) => {
    const q = e.target.closest('[data-iqama] [data-d]');
    if (!q) return;
    const k = q.closest('[data-iqama]').dataset.iqama;
    s.iqama[k] = Math.max(0, Math.min(60, s.iqama[k] + Number(q.dataset.d)));
    save();
    const y = window.scrollY;
    draw();
    window.scrollTo(0, y);
  };
  return { destroy: () => (view.onclick = null) };
}

// «ترتيب الرئيسية والأدوات»: move each shortcut and tool up or down, or hide it.
export async function renderOrder(view) {
  const [{ QUICK, SECTIONS }, { TOOLS }, { ordered }] = await Promise.all([import('./home.js'), import('./tools.js'), import('../order.js')]);
  if (location.hash !== '#/settings/order') return; // the user left while it loaded
  const LISTS = { sections: ['أقسام الرئيسية', SECTIONS], home: ['اختصارات الرئيسية', QUICK], tools: ['الأدوات', TOOLS] };
  const s = state.settings;
  const conf = (k) => (s.order ??= {})[k] ??= { list: [], hidden: [] };
  const draw = () => {
    view.innerHTML = `
      ${pageHeader('ترتيب الرئيسية والأدوات', { back: '#/settings' })}
      ${Object.entries(LISTS).map(([k, [title, list]]) => {
        const all = ordered(k, list, true);
        const hidden = conf(k).hidden;
        return `<div class="group"><h4>${title}</h4>
          ${all.map(([href, name, a, b], i) => {
            const ic = k === 'tools' ? b : a;
            const off = hidden.includes(href);
            return `<div class="row ord ${off ? 'off' : ''}"><span class="row-icon">${icon(ic, 20)}</span><span class="row-label">${esc(name)}</span>
              <button class="icon-btn ghost sm" data-mv="${k}|${i}|-1" ${i ? '' : 'disabled'} aria-label="لأعلى">${icon('up', 18)}</button>
              <button class="icon-btn ghost sm" data-mv="${k}|${i}|1" ${i < all.length - 1 ? '' : 'disabled'} aria-label="لأسفل">${icon('down', 18)}</button>
              ${toggle(`show:${k}|${href}`, !off)}</div>`;
          }).join('')}
          <button class="btn ghost wide" data-reset-order="${k}">${icon('reset', 18)} الترتيب الأصلي</button></div>`;
      }).join('')}`;
  };
  draw();
  view.onclick = (e) => {
    const m = e.target.closest('[data-mv]');
    if (m) {
      const [k, i, d] = m.dataset.mv.split('|');
      const list = ordered(k, LISTS[k][1], true).map((x) => x[0]);
      const a = Number(i), b = a + Number(d);
      [list[a], list[b]] = [list[b], list[a]];
      conf(k).list = list;
      save();
      return draw();
    }
    const r = e.target.closest('[data-reset-order]');
    if (r) {
      s.order[r.dataset.resetOrder] = { list: [], hidden: [] };
      save();
      draw();
    }
  };
  view.onchange = (e) => {
    if (!e.target.name?.startsWith('show:')) return;
    const [k, href] = e.target.name.slice(5).split('|');
    const h = conf(k).hidden;
    conf(k).hidden = e.target.checked ? h.filter((x) => x !== href) : [...h, href];
    save();
    draw();
  };
  return { destroy: () => ((view.onclick = null), (view.onchange = null)) };
}
