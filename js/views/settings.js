// Settings: location, calculation, notifications, display, widget and backup.

import { CITIES, nearestCity } from '../cities.js';
import { clockText, countdown, GREG_MONTHS, hijri, HIJRI_MONTHS, hijriText, minutesText, num, weekday } from '../dates.js';
import { icon, PRAYER_ICONS } from '../icons.js';
import { addDays, iqamaTime, METHODS, PRAYER_NAMES } from '../prayer.js';
import { disablePush, enablePush, isIOS, isStandalone, pushActive, pushSupported, sendTest, syncSchedule } from '../push.js';
import { exportData, importData, save, state } from '../store.js';
import { today } from '../today.js';
import { $, copyText, esc, FONT_NAMES, FONTS, pageHeader, toast, toggle } from '../ui.js';
import { themeByWord, widgetScript, WIDGET_STYLES, WIDGET_THEMES } from '../widget.js';
import { sunnahNow } from '../sunnah.js';
import { APP_VERSION } from '../config.js';
import { AYAT, dailyFor } from '../daily-data.js';
import { DAILY } from '../adhkar-data.js';

const row = (href, ic, label, value = '') =>
  `<a class="row" href="${href}"><span class="row-icon">${icon(ic, 20)}</span><span class="row-label">${label}</span><span class="row-value">${value}</span>${icon('chevron', 18, 'muted')}</a>`;

// ---- Main list ----

export function render(view) {
  const s = state.settings;
  const n = s.notify;
  view.innerHTML = `
    ${pageHeader('الإعدادات', { back: '#/home' })}
    <div class="group">
      <h4>الصلاة</h4>
      ${row('#/settings/location', 'pin', 'الموقع', esc(s.location.name))}
      ${row('#/settings/method', 'mosque', 'طريقة الحساب', esc(METHODS[s.method]?.name.split(' — ')[0]))}
      ${row('#/qibla', 'compass', 'اتجاه القبلة')}
    </div>
    <div class="group">
      <h4>التنبيهات والويدجت</h4>
      ${row('#/settings/notify', 'bell', 'الإشعارات والتنبيهات', n.enabled ? 'مفعّلة' : 'متوقفة')}
      ${row('#/settings/widget', 'widget', 'ويدجت الشاشة الرئيسية')}
      ${row('#/settings/icon', 'stars', 'أيقونة التطبيق', APP_ICONS.find((x) => x[0] === s.appIcon)?.[1] || '')}
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
      <p>الأذكار من الكتاب والسنة الصحيحة، ومواقيت الصلاة تُحسب على جهازك دون إنترنت.</p>
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
          syncSchedule(true);
          render(view);
        } catch (err) {
          toast(err.message || 'تعذرت قراءة الملف');
        }
      });
      return;
    }
    save();
    if (t.name === 'clock24' || t.name === 'digits') {
      syncSchedule();
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
      syncSchedule();
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
    syncSchedule();
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
        ${['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
          .map(
            (k) => `<div class="row"><span class="row-label">${PRAYER_NAMES[k]}<small>${clockText(t[k].hours, s.clock24)}</small></span>
              <div class="stepper" data-off="${k}"><button data-d="-1">−</button><b>${num(s.offsets[k] > 0 ? '+' + s.offsets[k] : s.offsets[k])}</b><button data-d="1">+</button></div></div>`
          )
          .join('')}
        <p class="hint">استعمله ليطابق التطبيق تقويم مسجدك أو وزارة الأوقاف في بلدك.</p>
      </div>
      <div class="group">
        <h4>الإقامة (دقائق بعد الأذان)</h4>
        ${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
          .map(
            (k) => `<div class="row"><span class="row-label">${PRAYER_NAMES[k]}<small>الإقامة ${clockText(iqamaTime(t, k, s.iqama).hours, s.clock24)}</small></span>
              <div class="stepper" data-iq="${k}"><button data-d="-1">−</button><b>${num(s.iqama[k])}</b><button data-d="1">+</button></div></div>`
          )
          .join('')}
        <p class="hint">عدّلها لتوافق إقامة مسجدك. ويصلك تنبيه عند الإقامة من إعدادات الإشعارات.</p>
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
    const q = e.target.closest('[data-iq] [data-d]');
    if (q) {
      const k = q.closest('[data-iq]').dataset.iq;
      s.iqama[k] = Math.max(0, Math.min(60, s.iqama[k] + Number(q.dataset.d)));
    }
    if (m || a || o || q) {
      save();
      syncSchedule();
      const y = window.scrollY;
      draw();
      window.scrollTo(0, y);
    }
  };
  return { destroy: () => (view.onclick = null) };
}

// ---- Notifications ----

const AYAT_SHORT = AYAT.filter(([, plain]) => plain.length <= 50).map(([, plain, ref]) => [plain, ref]);
const BEFORE = [0, 5, 10, 15, 20, 30];
const PRAYER_OPTS = ['off', 0, 5, 10, 15, 20, 30];
const SUNRISE_OPTS = ['off', 0, 10, 15, 20, 30];
const DELAYS = [0, 15, 30, 45, 60, 90];

export function renderNotify(view) {
  const s = state.settings;
  const n = s.notify;
  let active = false;

  const draw = () => {
    const blocked = !pushSupported();
    const needsInstall = isIOS() && !isStandalone();
    const select = (name, values, value, label) =>
      `<select name="${name}">${values.map((v) => `<option value="${v}" ${v === value ? 'selected' : ''}>${label(v)}</option>`).join('')}</select>`;
    const lab = (ic, text, small = '') => `<span class="row-icon">${icon(ic, 20)}</span><span class="row-label">${text}${small ? `<small>${small}</small>` : ''}</span>`;
    const timeRow = (name) => `<div class="row sub"><span class="row-label">الساعة</span><input type="time" name="${name}" value="${esc(n[name])}"></div>`;
    view.innerHTML = `
      ${pageHeader('الإشعارات', { back: '#/settings', sub: 'اختر ما يصلك ومتى' })}
      ${
        needsInstall
          ? `<div class="banner info">${icon('info', 22)}<div><b>أضف التطبيق إلى الشاشة الرئيسية أولاً</b>
              <span>على الآيفون لا تصل الإشعارات إلا للتطبيق المثبّت: اضغط زر المشاركة ${icon('share', 15)} في Safari ثم «إضافة إلى الشاشة الرئيسية»، وافتحه من أيقونته.</span></div></div>`
          : ''
      }
      <div class="group">
        <div class="row big"><span class="row-icon">${icon('bell', 22)}</span>
          <span class="row-label">تفعيل الإشعارات<small data-status>${n.enabled ? (active ? 'تصلك التنبيهات حتى والتطبيق مغلق' : 'جارٍ التحقق…') : 'متوقفة'}</small></span>
          ${toggle('enabled', n.enabled, blocked && !needsInstall ? 'disabled' : '')}</div>
        ${n.enabled ? `<button class="btn ghost wide" data-test>${icon('bell', 18)} إرسال إشعار تجريبي</button>` : ''}
      </div>
      <div class="group">
        <h4>مواقيت الصلاة</h4>
        ${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
          .map((k) => {
            const v = n.prayers[k] ? n.beforeBy?.[k] ?? n.before : 'off';
            return `<div class="row">${lab(PRAYER_ICONS[k], PRAYER_NAMES[k])}${select('pb-' + k, PRAYER_OPTS, v, (x) => (x === 'off' ? 'متوقف' : x ? `في الموعد وقبله ${minutesText(x)}` : 'في الموعد'))}</div>`;
          })
          .join('')}
        <div class="row">${lab('sunrise', 'الشروق', 'خروج وقت الفجر')}${select('sunriseOpt', SUNRISE_OPTS, n.sunrise ? n.sunriseBefore || 0 : 'off', (x) => (x === 'off' ? 'متوقف' : x ? `قبل الشروق بـ${minutesText(x)}` : 'عند الشروق'))}</div>
        <div class="row">${lab('moonStar', 'موعد الفجر والشروق', 'تنبيه ليلي بوقت الفجر والشروق القادمين')}${toggle('fajrInfo', n.fajrInfo)}</div>
        ${n.fajrInfo ? timeRow('fajrInfoTime') : ''}
        <div class="row">${lab('mosque', 'الإقامة', `${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => `${PRAYER_NAMES[k]} ${num(s.iqama[k])}`).join(' • ')} دقيقة — <a class="link" href="#/settings/method">تعديل</a>`)}${toggle('iqama', n.iqama)}</div>
        <div class="row">${lab('check', 'بعد الأذان', '«هل صليت؟» وأذكار ما بعد الصلاة')}${select('afterAdhan', BEFORE, n.afterAdhan, (v) => (v ? `بعد ${minutesText(v)}` : 'متوقف'))}</div>
        <div class="row">${lab('clock', 'خروج وقت الصلاة', 'قبل أن ينتهي وقت كل صلاة')}${select('prayerEnd', [0, 10, 15, 20, 30, 45, 60], n.prayerEnd, (v) => (v ? `قبل ${minutesText(v)}` : 'متوقف'))}</div>
        <p class="hint">ينتهي وقت الفجر بالشروق، والظهر بدخول العصر، والعصر بالغروب (ويُكره تأخيرها إلى اصفرار الشمس)، والمغرب بدخول العشاء، والعشاء بمنتصف الليل.</p>
      </div>
      <div class="group">
        <h4>أوقات أخرى</h4>
        <div class="row">${lab('sun', 'صلاة الضحى')}${toggle('duha', n.duha)}</div>
        ${n.duha ? `<div class="row sub"><span class="row-label">بعد الشروق بـ</span>${select('duhaDelay', [15, 30, 60, 90, 120, 180], n.duhaDelay, (v) => (v >= 60 ? (v === 60 ? 'ساعة' : v === 120 ? 'ساعتين' : v === 180 ? '٣ ساعات' : 'ساعة ونصف') : minutesText(v)))}</div>` : ''}
        <div class="row">${lab('moon', 'منتصف الليل', 'آخر وقت العشاء')}${toggle('midnight', n.midnight)}</div>
        <div class="row">${lab('moonStar', 'القيلولة', 'عند بدء الساعة السادسة قبل الزوال')}${toggle('qailulah', n.qailulah)}</div>
        <div class="row">${lab('info', 'وقت النهي قبل الظهر', 'عند قيام الشمس، قبل الظهر بـ١٠ دقائق')}${toggle('nahy', n.nahy)}</div>
        <div class="row">${lab('stars', 'الثلث الأخير من الليل', 'لقيام الليل والدعاء')}${toggle('lastThird', n.lastThird)}</div>
      </div>
      <div class="group">
        <h4>القرآن</h4>
        <div class="row">${lab('mountain', 'سورة الكهف', 'كل يوم جمعة')}${toggle('kahf', n.kahf)}</div>
        ${n.kahf ? timeRow('kahfTime') : ''}
        <div class="row">${lab('crown', 'سورة الملك', 'كل ليلة')}${toggle('mulk', n.mulk)}</div>
        ${n.mulk ? timeRow('mulkTime') : ''}
        <div class="row">${lab('shield', 'سورة البقرة')}${select('baqarah', [0, 1, 2, 3, 7], n.baqarah, (v) => ({ 0: 'متوقف', 1: 'كل يوم', 2: 'كل يومين', 3: 'كل ٣ أيام', 7: 'كل أسبوع' })[v])}</div>
        ${n.baqarah ? timeRow('baqarahTime') : ''}
        <div class="row">${lab('book', 'تذكير الختمة', state.khatma.start ? 'وردك اليومي من القرآن' : 'ابدأ ختمة من قسم القرآن')}${toggle('khatma', n.khatma)}</div>
        ${n.khatma ? timeRow('khatmaTime') : ''}
      </div>
      <div class="group">
        <h4>الأذكار</h4>
        <div class="row">${lab('sunrise', 'أذكار الصباح')}${toggle('morning', n.morning)}</div>
        ${n.morning ? `<div class="row sub"><span class="row-label">بعد الفجر بـ</span>${select('morningDelay', DELAYS, n.morningDelay, (v) => (v ? minutesText(v) : 'عند الأذان'))}</div>` : ''}
        <div class="row">${lab('moonStar', 'أذكار المساء')}${toggle('evening', n.evening)}</div>
        ${n.evening ? `<div class="row sub"><span class="row-label">بعد العصر بـ</span>${select('eveningDelay', DELAYS, n.eveningDelay, (v) => (v ? minutesText(v) : 'عند الأذان'))}</div>` : ''}
        <div class="row">${lab('moon', 'أذكار النوم')}${toggle('sleep', n.sleep)}</div>
        ${n.sleep ? timeRow('sleepTime') : ''}
        <div class="row">${lab('heart', 'الصلاة على النبي ﷺ', 'من ٩ صباحاً إلى ٩ مساءً')}${toggle('salawat', n.salawat)}</div>
        ${n.salawat ? `<div class="row sub"><span class="row-label">كل</span>${select('salawatHours', [1, 2, 3, 4, 6], n.salawatHours, (v) => (v === 1 ? 'ساعة' : v === 2 ? 'ساعتين' : `${num(v)} ساعات`))}</div>` : ''}
        <p class="hint">ولكل ذكر في «أذكاري» تذكيره الخاص بالوقت الذي تختاره.</p>
      </div>
      <div class="group">
        <h4>الصيام والمناسبات</h4>
        <div class="row">${lab('leaf', 'صيام الاثنين والخميس', 'مساء الأحد والأربعاء')}${toggle('fasting', n.fasting)}</div>
        ${n.fasting ? timeRow('fastingTime') : ''}
        <div class="row">${lab('moon', 'صيام الأيام البيض', '١٣ و١٤ و١٥ — مساء اليوم الثاني عشر')}${toggle('whiteDays', n.whiteDays)}</div>
        ${n.whiteDays ? timeRow('whiteDaysTime') : ''}
        <div class="row">${lab('calendar', 'المناسبات', 'رمضان، والعشر، وعرفة، والعيدان، وعاشوراء… مساء اليوم السابق — <a class="link" href="#/occasions">عرضها</a>')}${toggle('occasions', n.occasions)}</div>
        ${n.occasions ? timeRow('occasionsTime') : ''}
      </div>
      <div class="group">
        <h4>تذكيرات أخرى</h4>
        <div class="row">${lab('mosque', 'يوم الجمعة', 'الصلاة على النبي ﷺ وساعة الإجابة')}${toggle('friday', n.friday)}</div>
        <div class="row">${lab('check', 'متابعة العبادات', 'كل ليلة الساعة ٩:٣٠ مساءً')}${toggle('worship', n.worship)}</div>
      </div>
      <p class="hint center">التنبيهات تُرسل من خادم التطبيق في وقتها، فافتح التطبيق مرة كل بضعة أسابيع ليبقى جدولها محدّثاً.</p>`;
  };
  draw();
  pushActive().then((on) => {
    active = on;
    const el = $('[data-status]', view);
    if (el && n.enabled) el.textContent = on ? 'تصلك التنبيهات حتى والتطبيق مغلق' : 'اضغط المفتاح مرة أخرى لإكمال التفعيل';
    if (n.enabled && !on) {
      n.enabled = false;
      save();
      draw();
    }
  });

  view.onchange = async (e) => {
    const t = e.target;
    if (t.name === 'enabled') {
      if (t.checked) {
        t.disabled = true;
        try {
          await enablePush();
          n.enabled = true;
          active = true;
          toast(`${icon('check', 18)} فُعّلت الإشعارات`);
        } catch (err) {
          n.enabled = false;
          const msg = {
            ADD_TO_HOME: 'أضف التطبيق إلى الشاشة الرئيسية أولاً، ثم افتحه منها وفعّل الإشعارات',
            DENIED: 'رُفض الإذن. فعّله من إعدادات الآيفون ← الإشعارات ← أذكار',
            SERVER: 'تعذر الاتصال بخادم التنبيهات. تأكد من الإنترنت ثم حاول مرة أخرى',
          }[err.message];
          toast(msg || 'هذا المتصفح لا يدعم الإشعارات');
        }
      } else {
        n.enabled = false;
        disablePush();
      }
      save();
      return draw();
    }
    if (t.name.startsWith('pb-')) {
      const k = t.name.slice(3);
      n.prayers[k] = t.value !== 'off';
      if (t.value !== 'off') (n.beforeBy ??= {})[k] = Number(t.value);
    } else if (t.name === 'sunriseOpt') {
      n.sunrise = t.value !== 'off';
      if (n.sunrise) n.sunriseBefore = Number(t.value);
    } else if (t.type === 'checkbox') n[t.name] = t.checked;
    else if (t.type === 'time') n[t.name] = t.value || n[t.name];
    else n[t.name] = Number(t.value);
    save();
    syncSchedule();
    if (['morning', 'evening', 'sleep', 'salawat', 'duha', 'kahf', 'mulk', 'baqarah', 'khatma', 'fasting', 'whiteDays', 'occasions', 'fajrInfo'].includes(t.name)) draw();
  };
  view.onclick = async (e) => {
    if (!e.target.closest('[data-test]')) return;
    try {
      await syncSchedule(true);
      await sendTest();
      toast('أُرسل إشعار تجريبي، سيصلك خلال لحظات');
    } catch (err) {
      toast('تعذر إرسال الإشعار التجريبي');
    }
  };
  return {
    destroy() {
      view.onchange = view.onclick = null;
    },
  };
}

// ---- Widget ----

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

let widgetStyle = 'times';
let widgetTheme = ''; // '' = the style's own colours

export function renderWidget(view) {
  const draw = () => {
    const st = WIDGET_STYLES.find((w) => w.id === widgetStyle) || WIDGET_STYLES[0];
    const theme = themeByWord(widgetTheme || st.theme);
    const param = widgetTheme && widgetTheme !== st.theme ? `${st.word} ${widgetTheme}` : st.word;
    view.innerHTML = `
      ${pageHeader('الويدجت', { back: '#/settings', sub: `${num(WIDGET_STYLES.length)} شكلاً و${num(WIDGET_THEMES.length)} لوناً للشاشة الرئيسية وشاشة القفل` })}
      <div class="wg-stage">${widgetPreview(st.id, theme)}</div>
      <div class="wg-chips">${WIDGET_STYLES.map((w) => `<button class="${w.id === st.id ? 'on' : ''}" data-wstyle="${w.id}">${w.title}</button>`).join('')}</div>
      <p class="hint center">${esc(st.desc)}</p>
      <button class="wg-param" data-param="${esc(param)}"><span>اكتب في خانة <b>Parameter</b></span><b class="wg-word">${esc(param)}</b>${icon('copy', 18)}</button>
      <div class="group list wg-colors">
        <h4>ألوان الويدجت</h4>
        ${WIDGET_THEMES.map(
          (t) => `<button class="row" data-wtheme="${t.word}">
            <span class="wg-swatch" style="${themeVars(t)}">${num(12)}</span>
            <span class="row-label">${esc(t.name)}${t.word === st.theme ? '<small>لون هذا الشكل الأصلي</small>' : ''}</span>
            ${t.word === theme.word ? `<span class="wg-check">${icon('check', 16)}</span>` : ''}</button>`
        ).join('')}
      </div>
      <div class="group">
        <h4>كيف أضيف الويدجت؟</h4>
        <p class="hint">آبل لا تسمح لتطبيقات الويب بإضافة ويدجت، لذلك نستعمل تطبيق <b>Scriptable</b> المجاني. كود واحد يكفي لكل الأشكال والألوان، ويعمل دون إنترنت.</p>
        <ol class="steps">
          <li>ثبّت تطبيق <b>Scriptable</b> من App Store.</li>
          <li>اضغط «نسخ كود الويدجت» بالأسفل.</li>
          <li>افتح Scriptable، واضغط <b>+</b>، والصق الكود، وسمِّه «أذكار».</li>
          <li>اضغط مطولاً على الشاشة الرئيسية ← <b>+</b> ← Scriptable، واختر الحجم وأضفه.</li>
          <li>اضغط على الويدجت مطولاً ← تعديل الأداة ← <b>Script</b>: «أذكار»، وفي <b>Parameter</b> اكتب الكلمة الظاهرة أعلاه (الشكل ثم اللون إن شئت). أضف أكثر من ويدجت بكلمات مختلفة.</li>
        </ol>
        <button class="btn primary wide" data-copy>${icon('copy', 20)} نسخ كود الويدجت</button>
        <p class="hint">لكل شكل الأحجام الثلاثة وويدجت شاشة القفل. ويدجت الوضوء: اضغط عليه عند الوضوء ومرة أخرى إذا انتقض، فيفتح Scriptable لحظة ويحفظ الحالة. وإذا غيّرت مدينتك أو طريقة الحساب أو أذكارك فانسخ الكود من جديد والصقه مكان القديم.</p>
      </div>`;
  };
  draw();
  view.onclick = (e) => {
    if (e.target.closest('[data-copy]')) return copyText(widgetScript(state.settings));
    const p = e.target.closest('[data-param]');
    if (p) return copyText(p.dataset.param);
    const st = e.target.closest('[data-wstyle]');
    if (st) {
      widgetStyle = st.dataset.wstyle;
      draw();
      return $(`[data-wstyle="${widgetStyle}"]`, view)?.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
    const th = e.target.closest('[data-wtheme]');
    if (th) {
      widgetTheme = th.dataset.wtheme;
      draw();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  return { destroy: () => (view.onclick = null) };
}

const themeVars = (t) => `--w1:${t.bg[0]};--w2:${t.bg[1]};--wf:${t.fg};--wa:${t.acc};--wc:${t.light ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.12)'}`;

// A look-alike of each widget, drawn with the chosen colours.
function widgetPreview(id, theme) {
  const s = state.settings;
  const info = today();
  const next = info.next;
  const h = hijri(info.day, s.hijriAdjust);
  const d = dailyFor(info.day);
  const ct = (k) => clockText(info.times[k].hours, s.clock24);
  const bare = (k) => ct(k).replace(/ [صم]$/, '');
  const fard = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const now = Date.now();
  const iq = s.iqama?.[next.key] || 0;
  const hijriNum = num(`${h.year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`);
  const gregNum = num(`${info.day.y}-${String(info.day.m).padStart(2, '0')}-${String(info.day.d).padStart(2, '0')}`);
  const frac = (k) => {
    const i = fard.indexOf(k);
    const a = info.times[k].at;
    const b = i < 4 ? info.times[fard[i + 1]].at : info.tomorrow.fajr.at;
    return Math.max(0, Math.min(1, (now - a) / (b - a)));
  };
  const wrap = (size, html) => `<div class="wgp ${size}" style="${themeVars(theme)}">${html}</div>`;
  const sn = sunnahNow(info.times, now, s.iqama, info.isFriday);
  switch (id) {
    case 'circle': {
      const f = Math.max(0, Math.min(1, (now - info.prev.at) / (next.at - info.prev.at)));
      return wrap('m', `<div class="wgp-circle">
        <div class="wgp-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" class="tr"/><circle cx="50" cy="50" r="45" class="pr" style="stroke-dasharray:${(f * 282.7).toFixed(1)} 400"/></svg>
          <b>${esc(next.name)}</b><span class="acc">${countdown(next.at - now)}</span></div>
        <div class="wgp-boxes"><div><span class="ic">${icon('sun', 18)}</span><small>الأذان</small><b>${clockText(next.hours, s.clock24)}</b></div>
          <div><span class="ic">${icon('mosque', 18)}</span><small>الإقامة</small><b>${iq ? clockText(next.hours + iq / 60, s.clock24) : '—'}</b></div></div></div>`);
    }
    case 'track':
      return wrap('m', `<div class="wgp-head"><b>${weekday(info.day)}</b><small>${esc(s.location.name)}</small></div>
        <div class="wgp-track">${fard
          .map((k) => `<div class="${k === next.key ? 'on' : ''}"><span>${info.times[k].name}</span><i><em style="width:${Math.round(frac(k) * 100)}%"></em></i><b>${bare(k)}</b></div>`)
          .join('')}</div>
        <div class="wgp-head soft"><small>${gregNum}</small><small>${hijriNum}</small></div>`);
    case 'timeayah': {
      // Two-digit hour and minutes, in 12- or 24-hour time as in the settings (as the widget shows them).
      const mins = Math.round(next.hours * 60) % 1440;
      const hh = s.clock24 ? Math.floor(mins / 60) : Math.floor(mins / 60) % 12 || 12;
      const c = `${String(hh).padStart(2, '0')}${String(mins % 60).padStart(2, '0')}`;
      const short = AYAT_SHORT[info.day.d % AYAT_SHORT.length];
      return wrap('m', `<div class="wgp-ta">
        <div class="wgp-ta-r"><b class="ayah">${esc(short[0])}</b><span class="pill2"><em>${weekday(info.day)}</em><b>${num(info.day.d)}</b></span><small>${hijriNum}</small></div>
        <div class="wgp-ta-l"><b class="digits">${num(c.slice(0, 2))}<span>${num(c.slice(2))}</span></b><span>${esc(next.name)}</span></div></div>`);
    }
    case 'week': {
      const wd = new Date(Date.UTC(info.day.y, info.day.m - 1, info.day.d)).getUTCDay();
      const days = Array.from({ length: 7 }, (_, i) => {
        const dd = addDays(info.day, i - wd);
        return `<span class="${i === wd ? 'on' : ''}"><small>${['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'][i]}</small><b>${num(hijri(dd, s.hijriAdjust).day)}</b></span>`;
      }).join('');
      return wrap('m', `<div class="wgp-week"><div class="wgp-week-cal"><div class="wgp-head"><b>${HIJRI_MONTHS[h.month - 1]}</b><small>${num(h.year)}</small></div>
          <div class="card2"><div class="days">${days}</div><p>${esc(state.custom[0]?.text || DAILY[0].text)}</p></div></div>
        <div class="card2 wgp-week-next">${icon('sun', 18)}<b>${esc(next.name)}</b><span>${countdown(next.at - now)}</span><b>${clockText(next.hours, s.clock24)}</b><small>${esc(s.location.name)}</small></div></div>`);
    }
    case 'countdown':
      return wrap('s', `<small>الصلاة القادمة</small><b class="xl">${esc(next.name)}</b><b class="acc lg">${countdown(next.at - now)}</b><small>الساعة ${clockText(next.hours, s.clock24)}</small>`);
    case 'sunnah':
      return wrap('s', `<div class="wgp-head"><span class="ic acc">${icon('stars', 22)}</span><small>الآن</small></div><span class="grow"></span><b class="lg">${esc(sn.title)}</b><small>${esc(sn.sub)}</small>`);
    case 'date':
      return wrap('m', `<div class="wgp-date"><b class="huge">${num(h.day)}</b><div><b>${HIJRI_MONTHS[h.month - 1]} ${num(h.year)}</b><b class="acc">${weekday(info.day)}</b><span>${num(info.day.d)} ${GREG_MONTHS[info.day.m - 1]} ${num(info.day.y)}</span></div></div>`);
    case 'night':
      return wrap('m', `<b class="wgp-night-h">${esc(s.location.name)} <span>${weekday(info.day)}</span> ${num(info.day.d)} ${GREG_MONTHS[info.day.m - 1]}</b>
        <div class="wgp-cols">${['sunrise', 'midnight', 'lastThird'].map((k) => `<div><small>${info.times[k].name}</small><b>${bare(k)}</b></div>`).join('')}</div>`);
    case 'wudu':
      return wrap('s', `<div class="wgp-wudu">${icon('hand', 34)}<b>لست على وضوء</b><small>اضغط لتسجيل وضوئك</small><span class="btn2">${icon('reset', 16)}</span></div>`);
    case 'ayah':
    case 'dhikr':
    case 'mine': {
      const body = id === 'ayah' ? `﴿${d.ayah.plain}﴾` : id === 'mine' ? state.custom[0]?.text || 'أذكارك الخاصة' : DAILY[0].text;
      return wrap('s', `<small class="acc">${id === 'ayah' ? 'آية اليوم' : id === 'mine' ? 'من أذكاري' : 'ذكر'}</small><span class="grow"></span><p class="wgp-text">${esc(body)}</p><span class="grow"></span><small>${id === 'ayah' ? esc(d.ayah.ref) : weekday(info.day)}</small>`);
    }
    default:
      return wrap('m', `<div class="wgp-times"><ul>${['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
        .map((k) => `<li class="${k === next.key ? 'on' : ''}"><span>${PRAYER_NAMES[k]}</span><b>${ct(k)}</b></li>`)
        .join('')}</ul><div><small class="acc">${weekday(info.day)} • ${hijriText(info.day, s.hijriAdjust)}</small><span class="grow"></span><small>الصلاة القادمة</small><b class="lg">${esc(next.name)}</b><b class="lg">${clockText(next.hours, s.clock24)}</b><small class="acc">${countdown(next.at - now)}</small></div></div>`);
  }
}
