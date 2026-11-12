// «حساب Google»: sign in, and keep a copy of the app's data in the user's Google Drive.

import { icon } from '../icons.js';
import { finishSignIn, googleAccount, googleReady, restoreFromDrive, saveToDrive, setAuto, signIn, signOut } from '../google.js';
import { confirmSheet, esc, pageHeader, toast, toggle } from '../ui.js';

const when = (ms) => {
  const d = new Date(ms);
  return d.toLocaleString('ar', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
};

export function render(view) {
  let busy = '';
  const draw = () => {
    const a = googleAccount();
    const live = a.token && a.expires > Date.now() + 60000;
    view.innerHTML = `
      ${pageHeader('حساب Google', { back: '#/settings' })}
      ${
        !googleReady()
          ? `<div class="group"><div class="empty"><div class="empty-art">${icon('lock', 40)}</div><b>الدخول بحساب Google غير مُعدّ بعد</b>
               <p>يحتاج صاحب التطبيق إلى معرّف OAuth من Google Cloud، يُوضع في <code>GOOGLE_CLIENT_ID</code> في ملف <code>js/config.js</code>.</p></div></div>`
          : !a.email
            ? `<section class="card acct-in">
                 <div class="acct-g">${GOOGLE_G}</div>
                 <b>احفظ بياناتك في حسابك</b>
                 <p>ادخل بحساب Google لتُحفظ أذكارك ومتابعتك وختماتك في Google Drive الخاص بك، فتستعيدها على أي جهاز.</p>
                 <button class="btn g-btn wide" data-in>${GOOGLE_G} الدخول بحساب Google</button>
                 <small>يُحفظ في مجلد خاص بالتطبيق داخل Drive لا يراه غيره، ولا يطّلع التطبيق على ملفاتك الأخرى.</small>
               </section>`
            : `<section class="card acct">
                 ${a.picture ? `<img src="${esc(a.picture)}" alt="" width="56" height="56" referrerpolicy="no-referrer">` : `<span class="acct-av">${esc((a.name || a.email)[0])}</span>`}
                 <span><b>${esc(a.name || '')}</b><small>${esc(a.email)}</small></span>
               </section>
               <div class="group">
                 <div class="row"><span class="row-icon">${icon('upload', 20)}</span><span class="row-label">آخر حفظ في Drive<small>${a.savedAt ? when(a.savedAt) : 'لم يُحفظ بعد'}</small></span></div>
                 <div class="row"><span class="row-icon">${icon('reset', 20)}</span><span class="row-label">حفظ تلقائي<small>بعد كل تغيير، ما دام الدخول سارياً (ساعة تقريباً)</small></span>${toggle('auto', a.auto !== false)}</div>
                 ${live ? '' : `<p class="hint">انتهت جلسة الدخول؛ الحفظ يطلب الدخول مرة أخرى.</p>`}
                 <button class="btn primary wide" data-save ${busy ? 'disabled' : ''}>${icon('upload', 20)} ${busy === 'save' ? 'جارٍ الحفظ…' : 'احفظ الآن'}</button>
                 <button class="btn ghost wide" data-restore ${busy ? 'disabled' : ''}>${icon('download', 20)} ${busy === 'restore' ? 'جارٍ الاستعادة…' : 'استعد من حسابك'}</button>
               </div>
               <button class="btn ghost wide acct-out" data-out>تسجيل الخروج</button>`
      }`;
  };

  // A step that needs Google: when the sign-in has run out, it goes to Google first and the
  // user taps again on return.
  const run = async (kind, fn, done) => {
    const a = googleAccount();
    if (!(a.token && a.expires > Date.now() + 60000)) return signIn('#/settings/account', true);
    busy = kind;
    draw();
    try {
      await fn();
      toast(`${icon('check', 18)} ${done}`);
    } catch (e) {
      toast(e.message || 'تعذّر الاتصال');
      if (e.expired) signIn('#/settings/account', true);
    }
    busy = '';
    draw();
  };

  draw();

  // Back from Google: who it is, and what to do with a copy already in their Drive.
  if (googleAccount().fresh) {
    finishSignIn()
      .then(async (file) => {
        draw();
        if (!file) return run('save', saveToDrive, 'حُفظت بياناتك في حسابك');
        const restore = await confirmSheet(`في حسابك نسخة محفوظة (${when(Date.parse(file.modifiedTime))}). تستعيدها مكان بيانات هذا الجهاز؟`, { ok: 'استعد النسخة', danger: false });
        if (restore) run('restore', restoreFromDrive, 'استُعيدت بياناتك من حسابك');
        draw();
      })
      .catch((e) => {
        toast(e.message || 'تعذّر الدخول');
        draw();
      });
  }

  view.onclick = async (e) => {
    if (e.target.closest('[data-in]')) return signIn('#/settings/account');
    if (e.target.closest('[data-save]')) return run('save', saveToDrive, 'حُفظت بياناتك في حسابك');
    if (e.target.closest('[data-restore]')) {
      if (!(await confirmSheet('تستبدل بيانات هذا الجهاز بالنسخة المحفوظة في حسابك؟', { ok: 'استعد', danger: false }))) return;
      return run('restore', restoreFromDrive, 'استُعيدت بياناتك من حسابك');
    }
    if (e.target.closest('[data-out]')) {
      if (!(await confirmSheet('تسجيل الخروج من حساب Google؟ تبقى بياناتك على هذا الجهاز وفي حسابك.', { ok: 'خروج', danger: false }))) return;
      await signOut();
      draw();
    }
  };
  view.onchange = (e) => {
    if (e.target.name !== 'auto') return;
    setAuto(e.target.checked);
  };
  return { destroy: () => (view.onclick = view.onchange = null) };
}

// Google's «G» mark, as Google asks it to be shown on its sign-in button.
const GOOGLE_G = `<svg class="g-mark" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
