// Settings: location, calculation, notifications, display, widget and backup.

import { CITIES, nearestCity } from '../cities.js';
import { clockText, countdown, gregText, hijri, HIJRI_MONTHS, hijriText, minutesText, num, weekday } from '../dates.js';
import { icon } from '../icons.js';
import { iqamaTime, METHODS, PRAYER_NAMES } from '../prayer.js';
import { disablePush, enablePush, isIOS, isStandalone, pushActive, pushSupported, sendTest, syncSchedule } from '../push.js';
import { exportData, importData, save, state } from '../store.js';
import { today } from '../today.js';
import { $, copyText, esc, FONT_NAMES, FONTS, pageHeader, toast, toggle } from '../ui.js';
import { widgetScript, WIDGET_STYLES } from '../widget.js';
import { APP_VERSION } from '../config.js';
import { dailyFor } from '../daily-data.js';
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

const BEFORE = [0, 5, 10, 15, 20, 30];
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
    view.innerHTML = `
      ${pageHeader('الإشعارات والتنبيهات', { back: '#/settings' })}
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
        <h4>الأذان</h4>
        ${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
          .map((k) => `<div class="row"><span class="row-label">${PRAYER_NAMES[k]}</span>${toggle('p-' + k, n.prayers[k])}</div>`)
          .join('')}
        <div class="row"><span class="row-label">الشروق<small>نهاية وقت الفجر</small></span>${toggle('sunrise', n.sunrise)}</div>
        <div class="row"><span class="row-label">الإقامة<small>${['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((k) => `${PRAYER_NAMES[k]} ${num(s.iqama[k])}`).join(' • ')} دقيقة — <a class="link" href="#/settings/method">تعديل</a></small></span>${toggle('iqama', n.iqama)}</div>
        <div class="row"><span class="row-label">تنبيه قبل الأذان</span>${select('before', BEFORE, n.before, (v) => (v ? `قبل ${minutesText(v)}` : 'بلا تنبيه'))}</div>
        <div class="row"><span class="row-label">تنبيه بعد الأذان<small>«هل صليت؟» وأذكار ما بعد الصلاة</small></span>${select('afterAdhan', BEFORE, n.afterAdhan, (v) => (v ? `بعد ${minutesText(v)}` : 'بلا تنبيه'))}</div>
        <div class="row"><span class="row-label">خروج وقت الصلاة<small>قبل أن ينتهي وقت كل صلاة</small></span>${select('prayerEnd', [0, 10, 15, 20, 30, 45, 60], n.prayerEnd, (v) => (v ? `قبل ${minutesText(v)}` : 'بلا تنبيه'))}</div>
        <p class="hint">ينتهي وقت الفجر بالشروق، والظهر بدخول العصر، والعصر بالغروب (ويُكره تأخيرها إلى اصفرار الشمس)، والمغرب بدخول العشاء، والعشاء بمنتصف الليل.</p>
      </div>
      <div class="group">
        <h4>أوقات أخرى</h4>
        <div class="row"><span class="row-label">صلاة الضحى</span>${toggle('duha', n.duha)}</div>
        ${n.duha ? `<div class="row sub"><span class="row-label">بعد الشروق بـ</span>${select('duhaDelay', [15, 30, 60, 90, 120, 180], n.duhaDelay, (v) => (v >= 60 ? (v === 60 ? 'ساعة' : v === 120 ? 'ساعتين' : v === 180 ? '٣ ساعات' : 'ساعة ونصف') : minutesText(v)))}</div>` : ''}
        <div class="row"><span class="row-label">منتصف الليل<small>آخر وقت العشاء</small></span>${toggle('midnight', n.midnight)}</div>
        <div class="row"><span class="row-label">القيلولة<small>عند بدء الساعة السادسة قبل الزوال</small></span>${toggle('qailulah', n.qailulah)}</div>
        <div class="row"><span class="row-label">وقت النهي قبل الظهر<small>عند قيام الشمس، قبل الظهر بـ١٠ دقائق</small></span>${toggle('nahy', n.nahy)}</div>
        <div class="row"><span class="row-label">الثلث الأخير من الليل<small>لقيام الليل والدعاء</small></span>${toggle('lastThird', n.lastThird)}</div>
      </div>
      <div class="group">
        <h4>القرآن</h4>
        <div class="row"><span class="row-label">سورة الكهف<small>كل يوم جمعة</small></span>${toggle('kahf', n.kahf)}</div>
        ${n.kahf ? `<div class="row sub"><span class="row-label">الساعة</span><input type="time" name="kahfTime" value="${esc(n.kahfTime)}"></div>` : ''}
        <div class="row"><span class="row-label">سورة الملك<small>كل ليلة</small></span>${toggle('mulk', n.mulk)}</div>
        ${n.mulk ? `<div class="row sub"><span class="row-label">الساعة</span><input type="time" name="mulkTime" value="${esc(n.mulkTime)}"></div>` : ''}
        <div class="row"><span class="row-label">سورة البقرة</span>${select('baqarah', [0, 1, 2, 3, 7], n.baqarah, (v) => ({ 0: 'بلا تنبيه', 1: 'كل يوم', 2: 'كل يومين', 3: 'كل ٣ أيام', 7: 'كل أسبوع' })[v])}</div>
        ${n.baqarah ? `<div class="row sub"><span class="row-label">الساعة</span><input type="time" name="baqarahTime" value="${esc(n.baqarahTime)}"></div>` : ''}
        <div class="row"><span class="row-label">ورد الختمة<small>${state.khatma.start ? 'وردك اليومي من القرآن' : 'ابدأ ختمة من قسم القرآن'}</small></span>${toggle('khatma', n.khatma)}</div>
        ${n.khatma ? `<div class="row sub"><span class="row-label">الساعة</span><input type="time" name="khatmaTime" value="${esc(n.khatmaTime)}"></div>` : ''}
      </div>
      <div class="group">
        <h4>الأذكار</h4>
        <div class="row"><span class="row-label">أذكار الصباح</span>${toggle('morning', n.morning)}</div>
        ${n.morning ? `<div class="row sub"><span class="row-label">بعد الفجر بـ</span>${select('morningDelay', DELAYS, n.morningDelay, (v) => (v ? minutesText(v) : 'عند الأذان'))}</div>` : ''}
        <div class="row"><span class="row-label">أذكار المساء</span>${toggle('evening', n.evening)}</div>
        ${n.evening ? `<div class="row sub"><span class="row-label">بعد العصر بـ</span>${select('eveningDelay', DELAYS, n.eveningDelay, (v) => (v ? minutesText(v) : 'عند الأذان'))}</div>` : ''}
        <div class="row"><span class="row-label">أذكار النوم</span>${toggle('sleep', n.sleep)}</div>
        ${n.sleep ? `<div class="row sub"><span class="row-label">الساعة</span><input type="time" name="sleepTime" value="${esc(n.sleepTime)}"></div>` : ''}
        <div class="row"><span class="row-label">الصلاة على النبي ﷺ<small>من ٩ صباحاً إلى ٩ مساءً</small></span>${toggle('salawat', n.salawat)}</div>
        ${n.salawat ? `<div class="row sub"><span class="row-label">كل</span>${select('salawatHours', [1, 2, 3, 4, 6], n.salawatHours, (v) => (v === 1 ? 'ساعة' : v === 2 ? 'ساعتين' : `${num(v)} ساعات`))}</div>` : ''}
        <p class="hint">ولكل ذكر في «أذكاري» تذكيره الخاص بالوقت الذي تختاره.</p>
      </div>
      <div class="group">
        <h4>تذكيرات أخرى</h4>
        <div class="row"><span class="row-label">يوم الجمعة<small>الصلاة على النبي ﷺ وساعة الإجابة</small></span>${toggle('friday', n.friday)}</div>
        <div class="row"><span class="row-label">صيام الاثنين والخميس<small>مساء اليوم السابق</small></span>${toggle('fasting', n.fasting)}</div>
        <div class="row"><span class="row-label">الأيام البيض<small>١٣ و١٤ و١٥ من كل شهر هجري</small></span>${toggle('whiteDays', n.whiteDays)}</div>
        <div class="row"><span class="row-label">متابعة العبادات<small>كل ليلة الساعة ٩:٣٠ مساءً</small></span>${toggle('worship', n.worship)}</div>
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
    if (t.name.startsWith('p-')) n.prayers[t.name.slice(2)] = t.checked;
    else if (t.type === 'checkbox') n[t.name] = t.checked;
    else if (t.type === 'time') n[t.name] = t.value || n[t.name];
    else n[t.name] = Number(t.value);
    save();
    syncSchedule();
    if (['morning', 'evening', 'sleep', 'salawat', 'duha', 'kahf', 'mulk', 'baqarah', 'khatma'].includes(t.name)) draw();
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

export function renderWidget(view) {
  const s = state.settings;
  const info = today();
  const next = info.next;
  const d = dailyFor(info.day);
  const h = hijri(info.day, s.hijriAdjust);
  const rows = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']
    .map((k) => `<li class="${k === next.key ? 'on' : ''}"><span>${PRAYER_NAMES[k]}</span><b>${clockText(info.times[k].hours, s.clock24)}</b></li>`)
    .join('');
  const previews = {
    مواقيت: `<div class="wg wg-m"><ul>${rows}</ul><div class="wg-side"><small class="gold">${hijriText(info.day, s.hijriAdjust)}</small><span class="wg-label">الصلاة القادمة</span><b class="wg-name">${esc(next.name)}</b><b class="wg-time">${clockText(next.hours, s.clock24)}</b></div></div>`,
    عداد: `<div class="wg wg-s blue"><span class="wg-label">الصلاة القادمة</span><b class="wg-name">${esc(next.name)}</b><b class="wg-time gold">${countdown(next.at - Date.now())}</b><small class="wg-place">${info.current ? `يخرج وقت ${esc(info.current.name)} ${clockText(info.current.end.hours, s.clock24)}` : ''}</small></div>`,
    التاريخ: `<div class="wg wg-s gold-bg"><b>${weekday(info.day)}</b><b class="wg-big">${num(h.day)}</b><span class="gold">${HIJRI_MONTHS[h.month - 1]} ${num(h.year)}</span><small class="wg-place">${gregText(info.day)}</small></div>`,
    آية: `<div class="wg wg-s"><small class="gold">آية اليوم</small><p class="wg-text">﴿${esc(d.ayah.plain)}﴾</p><small class="wg-place">${esc(d.ayah.ref)}</small></div>`,
    ذكر: `<div class="wg wg-s violet"><small class="gold">ذكر</small><p class="wg-text">${esc(DAILY[0].text)}</p></div>`,
    أذكاري: `<div class="wg wg-s rose"><small class="gold">من أذكاري</small><p class="wg-text">${esc(state.custom[0]?.text.slice(0, 80) || 'أذكارك الخاصة')}</p></div>`,
    الليل: `<div class="wg wg-s night"><small class="gold">${hijriText(info.day, s.hijriAdjust)}</small><ul>${['sunrise', 'duha', 'midnight', 'lastThird'].map((k) => `<li><span>${info.times[k].name}</span><b>${clockText(info.times[k].hours, s.clock24)}</b></li>`).join('')}</ul></div>`,
  };
  view.innerHTML = `
    ${pageHeader('الويدجت', { back: '#/settings', sub: `${num(WIDGET_STYLES.length)} أشكال للشاشة الرئيسية وشاشة القفل` })}
    <div class="wg-gallery">
      ${WIDGET_STYLES.map(
        (w) => `<figure class="wg-item">${previews[w.word]}<figcaption><b>${w.title}</b><span>${w.desc}</span><button class="chip-opt" data-word="${w.word}">الكلمة: ${w.word} ${icon('copy', 14)}</button></figcaption></figure>`
      ).join('')}
      <figure class="wg-item"><div class="wg wg-lock"><b>${esc(next.name)} ${clockText(next.hours, s.clock24)}</b><span>${hijriText(info.day, s.hijriAdjust)}</span></div>
        <figcaption><b>شاشة القفل</b><span>المستطيل والدائري والسطر، لكل الأشكال السابقة</span></figcaption></figure>
    </div>

    <div class="group">
      <h4>كيف أضيف الويدجت؟</h4>
      <p class="hint">آبل لا تسمح لتطبيقات الويب بإضافة ويدجت، لذلك نستعمل تطبيق <b>Scriptable</b> المجاني. كود واحد يكفي لكل الأشكال، ويعمل دون إنترنت.</p>
      <ol class="steps">
        <li>ثبّت تطبيق <b>Scriptable</b> من App Store.</li>
        <li>اضغط «نسخ كود الويدجت» بالأسفل.</li>
        <li>افتح Scriptable، واضغط <b>+</b>، والصق الكود، وسمِّه «أذكار».</li>
        <li>اضغط مطولاً على الشاشة الرئيسية ← <b>+</b> ← Scriptable، واختر الحجم وأضفه.</li>
        <li>اضغط على الويدجت مطولاً ← تعديل الأداة ← <b>Script</b>: «أذكار»، وفي <b>Parameter</b> اكتب كلمة الشكل الذي تريده (مثل: التاريخ). أضف أكثر من ويدجت بكلمات مختلفة.</li>
      </ol>
      <button class="btn primary wide" data-copy>${icon('copy', 20)} نسخ كود الويدجت</button>
      <p class="hint">إذا غيّرت مدينتك أو طريقة الحساب أو أذكارك فانسخ الكود من جديد والصقه مكان القديم.</p>
    </div>`;
  view.onclick = (e) => {
    if (e.target.closest('[data-copy]')) copyText(widgetScript(s));
    const w = e.target.closest('[data-word]');
    if (w) copyText(w.dataset.word);
  };
  return { destroy: () => (view.onclick = null) };
}
