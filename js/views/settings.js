// Settings: location, calculation, display and backup.

import { CITIES, nearestCity } from '../cities.js';
import { googleAccount } from '../google.js';
import { APP_NAME, APP_VERSION, DESIGNER } from '../config.js';
import { clockText, hijriText, minutesText, num } from '../dates.js';
import { icon } from '../icons.js';
import { METHODS, PRAYER_NAMES } from '../prayer.js';
import { exportData, importData, save, state } from '../store.js';
import { today } from '../today.js';
import { askPermission, notifyPermission, primeReminders, testReminder } from '../notify.js';
import { PRAYERS } from '../today.js';
import { $, copyText, esc, FONT_NAMES, FONTS, openSheet, pageHeader, toast, toggle, WEIGHTS } from '../ui.js';

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
      ${row('#/settings/notify', s.notify.on ? 'bell' : 'bellOff', 'التنبيهات والإقامة', s.notify.on ? 'مفعّلة' : 'متوقفة')}
      ${row('#/settings/icon', 'stars', 'أيقونة التطبيق', APP_ICONS.find((x) => x[0] === s.appIcon)?.[1] || '')}
    </div>
    <div class="group">
      <h4>العرض</h4>
      <div class="row"><span class="row-icon">${icon('palette', 20)}</span><span class="row-label">المظهر</span>
        <div class="seg-mini" data-theme>
          ${[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(([v, l]) => `<button class="${s.theme === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}
        </div></div>
      <div class="row"><span class="row-icon">${icon('layers', 20)}</span><span class="row-label">تصميم مسطّح<small>ضوء مسطّح وألوان أقل، بلا زجاج سائل</small></span>${toggle('flat', s.flat)}</div>
      ${row('#/settings/fonts', 'type', 'الخطوط وأحجامها', `${FONT_NAMES[s.fontUi] || ''} · ${WEIGHTS.find((w) => w[0] === s.uiWeight)?.[1] || ''}`)}
      <div class="row"><span class="row-icon">${icon('clock', 20)}</span><span class="row-label">نظام ٢٤ ساعة</span>${toggle('clock24', s.clock24)}</div>
      <div class="row"><span class="row-icon">${icon('digits', 20)}</span><span class="row-label">نوع الأرقام</span>
        <div class="seg-mini" data-digits>
          ${[['arab', '١٢٣'], ['latn', '123']].map(([v, l]) => `<button class="${s.digits === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}
        </div></div>
      <div class="row"><span class="row-icon">${icon('calendar', 20)}</span><span class="row-label">تعديل التاريخ الهجري</span>
        <div class="stepper" data-hijri><button data-d="-1">−</button><b>${num(s.hijriAdjust > 0 ? '+' + s.hijriAdjust : s.hijriAdjust)}</b><button data-d="1">+</button></div></div>
      <p class="hint">اليوم: ${hijriText(today().day, s.hijriAdjust)}. عدّله يوماً إن خالف رؤية الهلال في بلدك.</p>
      <div class="row"><span class="row-icon">${icon('vibrate', 20)}</span><span class="row-label">الاهتزاز<small>عند العدّ والتسجيل، حيث يدعمه الجهاز</small></span>${toggle('haptics', s.haptics)}</div>
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
    if (t.name === 'flat') s.flat = t.checked;
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
    if (t.name === 'clock24') render(view);
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
  ['sky', 'أزرق'],
  ['night', 'ليلي'],
  ['violet', 'بنفسجي'],
  ['emerald', 'زمردي'],
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
      if (l) l.href = `icons/alt/${s.appIcon}.png?v=3`; // ?v= as in index.html: a new address so iOS fetches the icon afresh
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
      ${pageHeader('الخطوط', { back: '#/settings' })}
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
      ${sizer('text', 'حجم خط الأذكار', `${num(Math.round(s.textScale * 100))}%`)}
      <p class="sample amiri" data-text-sample style="font-size:calc(1.3rem * ${s.textScale})">سبحان الله وبحمده، سبحان الله العظيم</p>
      <p class="hint center">آيات القرآن تبقى بخط المصحف.</p>
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

export function renderNotify(view) {
  const s = state.settings;
  const n = s.notify;
  const sw = (name, label, on, sub = '', ic = 'bell') =>
    `<div class="row"><span class="row-icon">${icon(ic, 20)}</span><span class="row-label">${label}${sub ? `<small>${sub}</small>` : ''}</span>${toggle(name, on)}</div>`;
  const draw = () => {
    const t = today().times;
    const perm = notifyPermission();
    const status =
      perm === 'granted'
        ? 'إشعارات النظام مسموحة.'
        : perm === 'denied'
          ? 'إشعارات النظام مرفوضة لهذا التطبيق؛ اسمح بها من إعدادات الجهاز. التنبيه داخل التطبيق يعمل.'
          : perm === 'unsupported'
            ? 'هذا المتصفح لا يعرض إشعارات النظام (على الآيفون: أضف التطبيق إلى الشاشة الرئيسية أولاً). التنبيه داخل التطبيق يعمل.'
            : 'لم يُطلب إذن الإشعارات بعد.';
    view.innerHTML = `
      ${pageHeader('التنبيهات والإقامة', { back: '#/settings' })}
      <div class="group">
        ${sw('on', 'تفعيل التنبيهات', n.on, 'إشعار وصوت عند دخول الوقت', n.on ? 'bell' : 'bellOff')}
        <p class="hint">${status}</p>
        <p class="hint">يظهر التنبيه ما دام التطبيق مفتوحاً أو حيّاً في الخلفية، وما فاتك في آخر ${num(20)} دقيقة يظهر عند فتحه. تطبيقات الويب لا تستطيع جدولة إشعار وهي مغلقة تماماً، فلا تعتمد عليه وحده للاستيقاظ.</p>
        ${n.on ? `<button class="btn ghost wide" data-test>${icon('bell', 18)} جرّب التنبيه</button>` : ''}
      </div>
      <div class="group ${n.on ? '' : 'off'}">
        <h4>الصلوات</h4>
        ${PRAYERS.map((k) => sw(`p:${k}`, PRAYER_NAMES[k], n.prayers[k], clockText(t[k].hours, s.clock24), 'mosque')).join('')}
        <div class="row"><span class="row-icon">${icon('clock', 20)}</span><span class="row-label">تنبيه قبل الأذان<small>${n.before ? `قبله بـ${minutesText(n.before)}` : 'بلا تنبيه مسبق'}</small></span>
          <div class="stepper" data-before><button data-d="-5">−</button><b>${num(n.before)}</b><button data-d="5">+</button></div></div>
        ${sw('iqama', 'تنبيه الإقامة', n.iqama, 'عند انقضاء مدة الانتظار بعد الأذان', 'minaret')}
      </div>
      <div class="group">
        <h4>الإقامة بعد الأذان بالدقائق</h4>
        ${PRAYERS.map(
          (k) => `<div class="row"><span class="row-label">${PRAYER_NAMES[k]}</span>
            <div class="stepper" data-iqama="${k}"><button data-d="-1">−</button><b>${num(s.iqama[k])}</b><button data-d="1">+</button></div></div>`
        ).join('')}
        <p class="hint">تظهر في الرئيسية بعد الأذان: «مضى على الأذان… الإقامة بعد…». اجعلها صفراً لإخفائها.</p>
      </div>
      <div class="group ${n.on ? '' : 'off'}">
        <h4>أوقات وأذكار</h4>
        ${sw('duha', 'دخول وقت الضحى', n.duha, clockText(t.duha.hours, s.clock24), 'sun')}
        ${sw('duhaEnd', 'قرب نهاية الضحى', n.duhaEnd, `قبل ${clockText(t.duhaEnd.hours, s.clock24)} بربع ساعة`, 'sun')}
        ${sw('lastThird', 'الثلث الأخير من الليل', n.lastThird, clockText(t.lastThird.hours, s.clock24), 'stars')}
        ${sw('morning', 'أذكار الصباح', n.morning, 'بعد الفجر بنصف ساعة', 'sunrise')}
        ${sw('evening', 'أذكار المساء', n.evening, 'بعد العصر بنصف ساعة', 'sunset')}
        <p class="hint">تذكير ورد القرآن يُضبط لكل ختمة من «ختماتي».</p>
        ${sw('debts', 'الديون المستحقة', n.debts, 'قبل الاستحقاق بثلاثة أيام وفي يومه', 'wallet')}
        ${sw('sound', 'صوت التنبيه', n.sound, '', 'radio')}
      </div>`;
  };
  draw();
  view.onchange = async (e) => {
    const t = e.target;
    if (t.name === 'on') {
      n.on = t.checked;
      if (n.on) {
        const p = await askPermission();
        primeReminders();
        if (p !== 'granted') toast('التنبيه يعمل داخل التطبيق؛ إشعارات النظام غير مسموحة');
      }
    } else if (t.name?.startsWith('p:')) n.prayers[t.name.slice(2)] = t.checked;
    else if (t.name in n) n[t.name] = t.checked;
    else return;
    save();
    draw();
  };
  view.onclick = (e) => {
    if (e.target.closest('[data-test]')) return testReminder();
    const b = e.target.closest('[data-before] [data-d]');
    if (b) n.before = Math.max(0, Math.min(30, n.before + Number(b.dataset.d)));
    const q = e.target.closest('[data-iqama] [data-d]');
    if (q) {
      const k = q.closest('[data-iqama]').dataset.iqama;
      s.iqama[k] = Math.max(0, Math.min(60, s.iqama[k] + Number(q.dataset.d)));
    }
    if (!b && !q) return;
    save();
    const y = window.scrollY;
    draw();
    window.scrollTo(0, y);
  };
  return { destroy: () => (view.onchange = view.onclick = null) };
}
