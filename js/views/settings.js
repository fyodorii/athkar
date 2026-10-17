// Settings: location, calculation, display and backup.

import { CITIES, nearestCity } from '../cities.js';
import { clockText, hijriText, minutesText, num } from '../dates.js';
import { icon } from '../icons.js';
import { METHODS, PRAYER_NAMES } from '../prayer.js';
import { exportData, importData, save, state } from '../store.js';
import { today } from '../today.js';
import { $, copyText, esc, FONT_NAMES, FONTS, pageHeader, toast, toggle } from '../ui.js';
import { isDesktop } from '../desktop.js';
import { APP_VERSION } from '../config.js';

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
      ${isDesktop ? '' : row('#/settings/icon', 'stars', 'أيقونة التطبيق', APP_ICONS.find((x) => x[0] === s.appIcon)?.[1] || '')}
    </div>
    <div class="group">
      <h4>العرض</h4>
      <div class="row"><span class="row-icon">${icon('palette', 20)}</span><span class="row-label">المظهر</span>
        <div class="seg-mini" data-theme>
          ${[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(([v, l]) => `<button class="${s.theme === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}
        </div></div>
      <div class="row"><span class="row-icon">${icon('type', 20)}</span><span class="row-label">خط الأذكار</span>
        <div class="seg-mini" data-font-text>
          ${Object.entries(FONT_NAMES).map(([v, l]) => `<button class="${s.fontText === v ? 'on' : ''}" data-v="${v}" style="font-family:${FONTS[v].replaceAll('"', "'")}">${l}</button>`).join('')}
        </div></div>
      <div class="row"><span class="row-icon">${icon('type', 20)}</span><span class="row-label">خط عريض للأذكار</span>${toggle('textBold', s.textBold)}</div>
      <div class="row"><span class="row-icon">${icon('type', 20)}</span><span class="row-label">حجم خط الأذكار</span>
        <input type="range" min="0.85" max="1.5" step="0.05" value="${s.textScale}" data-scale></div>
      <p class="sample amiri" data-sample style="font-size:calc(1.3rem * ${s.textScale})">سبحان الله وبحمده، سبحان الله العظيم</p>
      <div class="row"><span class="row-icon">${icon('palette', 20)}</span><span class="row-label">خط الواجهة</span>
        <div class="seg-mini" data-font-ui>
          ${Object.entries(FONT_NAMES).map(([v, l]) => `<button class="${s.fontUi === v ? 'on' : ''}" data-v="${v}" style="font-family:${FONTS[v].replaceAll('"', "'")}">${l}</button>`).join('')}
        </div></div>
      <div class="row"><span class="row-icon">${icon('palette', 20)}</span><span class="row-label">خط عريض للواجهة</span>${toggle('uiBold', s.uiBold)}</div>
      <p class="hint">آيات القرآن تبقى بخط مصحف المدينة.</p>
      <div class="row"><span class="row-icon">${icon('clock', 20)}</span><span class="row-label">نظام ٢٤ ساعة</span>${toggle('clock24', s.clock24)}</div>
      <div class="row"><span class="row-icon">${icon('type', 20)}</span><span class="row-label">الأرقام العربية (١٢٣)</span>${toggle('digits', s.digits === 'arab')}</div>
      <div class="row"><span class="row-icon">${icon('calendar', 20)}</span><span class="row-label">تعديل التاريخ الهجري</span>
        <div class="stepper" data-hijri><button data-d="-1">−</button><b>${num(s.hijriAdjust > 0 ? '+' + s.hijriAdjust : s.hijriAdjust)}</b><button data-d="1">+</button></div></div>
      <p class="hint">اليوم: ${hijriText(today().day, s.hijriAdjust)}. عدّله يوماً إن خالف رؤية الهلال في بلدك.</p>
      <div class="row"><span class="row-icon">${icon('vibrate', 20)}</span><span class="row-label">الاهتزاز عند العدّ</span>${toggle('haptics', s.haptics)}</div>
    </div>
    <div class="group">
      <h4>بياناتك</h4>
      <button class="row" data-export><span class="row-icon">${icon('download', 20)}</span><span class="row-label">نسخة احتياطية</span><span class="row-value">تصدير</span></button>
      <label class="row"><span class="row-icon">${icon('upload', 20)}</span><span class="row-label">استعادة نسخة</span><span class="row-value">استيراد</span><input type="file" accept="application/json,.json" hidden data-import></label>
      <p class="hint">أذكارك ودفترك محفوظة على جهازك فقط. احفظ نسخة احتياطية في ملفاتك أو iCloud بين حين وآخر.</p>
    </div>
    <div class="group about">
      <img src="icons/icon-192.png" alt="" width="64" height="64">
      <b>أذكار ومواقيت</b>
      <p>الأذكار من الكتاب والسنة الصحيحة، وأوقات الشروق والضحى والثلث الأخير وأوقات النهي تُحسب على جهازك دون إنترنت.</p>
      <p class="muted">«ألا بذكر الله تطمئن القلوب»</p>
      <small class="muted">الإصدار ${num(APP_VERSION)}</small>
    </div>`;

  const onChange = (e) => {
    const t = e.target;
    if (t.name === 'clock24') s.clock24 = t.checked;
    if (t.name === 'digits') s.digits = t.checked ? 'arab' : 'latn';
    if (t.name === 'haptics') s.haptics = t.checked;
    if (t.name === 'textBold') s.textBold = t.checked;
    if (t.name === 'uiBold') s.uiBold = t.checked;
    if (t.matches('[data-scale]')) s.textScale = Number(t.value);
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
    if (t.name === 'clock24' || t.name === 'digits') {
            render(view);
    }
  };
  const onInput = (e) => {
    if (e.target.matches('[data-scale]')) $('[data-sample]', view).style.fontSize = `calc(1.3rem * ${e.target.value})`;
  };
  const onClick = (e) => {
    const ft = e.target.closest('[data-font-text] [data-v], [data-font-ui] [data-v]');
    if (ft) {
      if (ft.closest('[data-font-text]')) s.fontText = ft.dataset.v;
      else s.fontUi = ft.dataset.v;
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
    if (e.target.closest('[data-export]')) exportBackup();
  };
  view.onchange = onChange;
  view.oninput = onInput;
  view.onclick = onClick;
  return {
    destroy() {
      view.onchange = view.oninput = view.onclick = null;
    },
  };
}

async function exportBackup() {
  const text = exportData();
  const name = `adhkar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'نسخة احتياطية — أذكار ومواقيت' });
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
      location.hash = '#/home';
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
      location.hash = '#/home';
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
            (k) => `<div class="row"><span class="row-label">${PRAYER_NAMES[k]}<small>${k === 'sunrise' ? `الشروق ${clockText(t.sunrise.hours, s.clock24)} • الضحى ${clockText(t.duha.hours, s.clock24)}` : EDIT_NOTE[k]}</small></span>
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
  ['night', 'ليلي'],
  ['violet', 'بنفسجي'],
  ['sky', 'سماوي'],
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
        ${APP_ICONS.map(([id, name]) => `<button class="icon-pick ${s.appIcon === id ? 'on' : ''}" data-icon="${id}"><img src="icons/alt/${id}.png" alt="" width="90" height="90"><span>${name}</span></button>`).join('')}
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
      if (l) l.href = s.appIcon === 'emerald' ? 'icons/apple-touch-icon.png' : `icons/alt/${s.appIcon}.png`;
      return draw();
    }
    const c = e.target.closest('[data-icon-link]');
    if (c) copyText(c.dataset.iconLink);
  };
  return { destroy: () => (view.onclick = null) };
}
