// «العداد»: a quiet counter, one dhikr to a page. A tap anywhere counts; a swipe moves to the
// next dhikr (or stay on one page, from the settings). Its adhkar are the tasbeeh's list.

import { num } from '../dates.js';
import { icon } from '../icons.js';
import { save, state } from '../store.js';
import { tick, unlockAudio } from '../timers.js';
import { $, confirmSheet, esc, haptic, hapticSwitch, openSheet, toast, toggle } from '../ui.js';
import { tasbeehList } from './adhkar.js';

const SIZES = [['auto', 'تلقائي'], ['xs', 'صغير جداً', 24], ['s', 'صغير', 30], ['m', 'متوسط', 36], ['l', 'كبير', 44], ['xl', 'كبير جداً', 54]];
const OPACITY = [100, 80, 60, 40, 20, 10];
const ALERTS = [[33, 'كل ٣٣'], [100, 'كل ١٠٠'], [-1, 'مخصص…'], [0, 'بدون اهتزاز']];

const cfg = () => {
  state.counter ??= {};
  const c = state.counter;
  c.counts ??= {};
  c.i ??= 0;
  c.vib ??= true;
  c.alertEvery ??= 33;
  c.opacity ??= 100;
  c.size ??= 'auto';
  c.mode ??= 'pages';
  c.mute ??= true;
  return c;
};

const list = () => tasbeehList();
const countOf = (text) => cfg().counts[text] || 0;
const total = () => list().reduce((n, x) => n + countOf(x), 0);
const sizeOf = (text) => {
  const s = SIZES.find(([k]) => k === cfg().size);
  if (s?.[2]) return s[2];
  return text.length > 140 ? 24 : text.length > 80 ? 28 : text.length > 40 ? 34 : 40; // the longer, the smaller
};

export function render(view) {
  const c = cfg();
  c.i = Math.max(0, Math.min(list().length - 1, c.i));
  const cur = () => list()[c.i] || '';

  const draw = () => {
    const items = list();
    view.innerHTML = `
      <section class="ct" data-area>
        <div class="ct-top" data-ui>
          <a class="ct-btn" href="#/home" aria-label="رجوع">${icon('back', 22)}</a>
          <span class="ct-top-end">
            <button class="ct-btn" data-reset aria-label="تصفير">${icon('reset', 21)}</button>
            <button class="ct-btn" data-list aria-label="قائمة الأذكار">${icon('rows', 21)}</button>
            <button class="ct-btn" data-more aria-label="المزيد">${icon('more', 22)}</button>
          </span>
        </div>
        <label class="ct-tap" ${c.vib && state.settings.haptics ? `for="${hapticSwitch()}"` : ''}>
          <p class="ct-text" style="font-size:${sizeOf(cur())}px">${esc(cur())}</p>
          <b class="ct-num" data-num style="opacity:${c.opacity / 100}">${num(countOf(cur()))}</b>
        </label>
        ${c.mode === 'pages' && items.length > 1 ? `<div class="ct-dots">${items.map((_, k) => `<i class="${k === c.i ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      </section>`;
  };
  draw();

  const count = () => {
    const text = cur();
    if (!text) return;
    if (!c.mute) {
      unlockAudio();
      tick();
    }
    c.counts[text] = countOf(text) + 1;
    save();
    const n = c.counts[text];
    $('[data-num]', view).textContent = num(n);
    const every = c.alertEvery;
    if (every > 0 && n % every === 0) {
      haptic(300, true, true);
      toast(`${icon('check', 18)} ${num(n)}`);
    } else if (c.vib && navigator.vibrate) haptic(10); // the iPhone ticks through the label
  };

  const go = (d) => {
    const n = list().length;
    if (n < 2) return;
    c.i = (c.i + d + n) % n;
    save();
    draw();
  };

  const reset = () => {
    c.counts[cur()] = 0;
    save();
    draw();
    haptic(30);
  };

  const editSheet = (old) => {
    openSheet(
      `<form class="form ct-form">
        <label class="field"><span>${old ? 'الذكر' : 'أضف ذكراً جديداً'}</span><textarea name="text" rows="3" required>${esc(old || '')}</textarea></label>
        <div class="sheet-actions"><button class="btn primary" type="submit">${old ? 'حفظ' : 'أضف'}</button><button class="btn ghost" type="button" data-close>إلغاء</button></div>
      </form>`,
      (el, close) => {
        const f = el.querySelector('form');
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          const text = f.text.value.trim();
          if (!text) return;
          const l = list();
          if (old) {
            const k = l.indexOf(old);
            if (k >= 0) l[k] = text;
            if (old !== text) {
              c.counts[text] = c.counts[old] || 0;
              delete c.counts[old];
            }
          } else if (!l.includes(text)) {
            l.push(text);
            c.i = l.length - 1;
          }
          save();
          close();
          draw();
        });
        setTimeout(() => f.text.focus(), 250);
      },
      { title: old ? 'تعديل الذكر' : 'أضف ذكراً' }
    );
  };

  const listSheet = () => {
    openSheet(
      `<div data-body></div>`,
      (el, close) => {
        const body = el.querySelector('[data-body]');
        const drawList = () => {
          body.innerHTML = `
            <div class="ct-list-tools"><button class="btn ghost" data-add>${icon('plus', 18)} أضف ذكراً</button><button class="btn ghost" data-all>${icon('reset', 18)} تصفير الكل</button></div>
            <div class="menu ct-list">${list()
              .map((x, k) => `<div class="ct-row ${k === c.i ? 'on' : ''}" data-k="${k}"><span>${esc(x)}</span><b>${num(countOf(x))}</b><button class="icon-btn ghost sm" data-act="${k}" aria-label="خيارات">${icon('more', 18)}</button></div>`)
              .join('')}</div>
            <p class="hint center">اضغط على الذكر لفتحه، ومن «⋯» تعديله أو تصفيره أو حذفه.</p>
            <div class="ct-total"><small>المجموع</small><b>${num(total())}</b></div>`;
        };
        drawList();
        body.addEventListener('click', async (e) => {
          if (e.target.closest('[data-add]')) {
            close();
            return editSheet();
          }
          if (e.target.closest('[data-all]')) {
            if (!(await confirmSheet('تصفير عداد كل الأذكار؟', { ok: 'تصفير' }))) return;
            c.counts = {};
            save();
            draw();
            return drawList();
          }
          const a = e.target.closest('[data-act]');
          if (a) {
            const x = list()[Number(a.dataset.act)];
            openSheet(
              `<div class="menu"><button data-o="edit">${icon('edit', 20)} تعديل</button><button data-o="zero">${icon('reset', 20)} تصفير العداد</button><button data-o="del" class="danger">${icon('trash', 20)} حذف</button></div>`,
              (m, closeM) => {
                m.addEventListener('click', async (ev) => {
                  const o = ev.target.closest('[data-o]')?.dataset.o;
                  if (!o) return;
                  closeM();
                  if (o === 'edit') {
                    close();
                    return editSheet(x);
                  }
                  if (o === 'zero') c.counts[x] = 0;
                  if (o === 'del') {
                    if (list().length < 2) return toast('يبقى ذكر واحد على الأقل');
                    if (!(await confirmSheet('حذف هذا الذكر من القائمة؟'))) return;
                    list().splice(list().indexOf(x), 1);
                    delete c.counts[x];
                    c.i = Math.min(c.i, list().length - 1);
                  }
                  save();
                  draw();
                  drawList();
                });
              },
              { title: x.length > 40 ? x.slice(0, 38) + '…' : x }
            );
            return;
          }
          const row = e.target.closest('[data-k]');
          if (row) {
            c.i = Number(row.dataset.k);
            save();
            close();
            draw();
          }
        });
      },
      { title: 'قائمة الأذكار' }
    );
  };

  const settingsSheet = () => {
    openSheet(
      `<div data-body></div>`,
      (el) => {
        const body = el.querySelector('[data-body]');
        const sel = (name, opts, val) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
        const drawS = () => {
          const custom = ![33, 100, 0].includes(c.alertEvery);
          body.innerHTML = `
            <div class="ct-preview"><p style="font-size:${Math.min(28, sizeOf(cur()))}px">${esc(cur())}</p><b style="opacity:${c.opacity / 100}">${num(countOf(cur()))}</b><small>معاينة</small></div>
            <h4 class="sheet-sub">الاهتزاز</h4>
            <div class="group ct-group">
              <div class="row"><span class="row-label">الاهتزاز مع كل عدّة</span>${toggle('vib', c.vib)}</div>
              <div class="row"><span class="row-label">اهتزاز التنبيه${custom ? `<small>كل ${num(c.alertEvery)}</small>` : ''}</span>${sel('alert', ALERTS, custom ? -1 : c.alertEvery)}</div>
            </div>
            <h4 class="sheet-sub">الخط</h4>
            <div class="group ct-group">
              <div class="row"><span class="row-label">درجة وضوح خط العداد</span>${sel('opacity', OPACITY.map((v) => [v, `${num(v)}٪`]), c.opacity)}</div>
              <div class="row"><span class="row-label">حجم خط الذكر</span>${sel('size', SIZES.map(([k, l]) => [k, l]), c.size)}</div>
            </div>
            <h4 class="sheet-sub">شكل القسم</h4>
            <div class="seg-mini wide" data-mode>
              <button class="${c.mode !== 'pages' ? 'on' : ''}" data-v="page">صفحة</button>
              <button class="${c.mode === 'pages' ? 'on' : ''}" data-v="pages">صفحات</button>
            </div>
            <p class="hint">«صفحات»: اسحب يميناً أو يساراً للانتقال بين الأذكار. «صفحة»: ذكر واحد، وتختار غيره من القائمة.</p>`;
        };
        drawS();
        body.addEventListener('change', (e) => {
          const t = e.target;
          if (t.name === 'vib') c.vib = t.checked;
          if (t.name === 'opacity') c.opacity = Number(t.value);
          if (t.name === 'size') c.size = t.value;
          if (t.name === 'alert') {
            let v = Number(t.value);
            if (v === -1) {
              v = Math.round(Number(prompt('كل كم عدّة يهتز الجوال؟', String(c.alertEvery > 0 ? c.alertEvery : 50))));
              if (!(v > 0)) v = c.alertEvery;
            }
            c.alertEvery = v;
          }
          save();
          draw();
          drawS();
        });
        body.addEventListener('click', (e) => {
          const m = e.target.closest('[data-mode] [data-v]');
          if (!m) return;
          c.mode = m.dataset.v;
          save();
          draw();
          drawS();
        });
      },
      { title: 'إعدادات العداد' }
    );
  };

  const moreSheet = () => {
    openSheet(
      `<div class="menu">
        <button data-m="edit">${icon('edit', 20)} تعديل الذكر</button>
        <button data-m="mute">${icon('sound', 20)} ${c.mute ? 'شغّل صوت العداد' : 'أغلق صوت العداد'}</button>
        <button data-m="settings">${icon('gear', 20)} إعدادات العداد…</button>
        <button data-m="zero">${icon('reset', 20)} تصفير عداد الصفحة</button>
      </div>
      <p class="ct-sum">المجموع الكلي: <b>${num(total())}</b></p>`,
      (el, close) => {
        el.addEventListener('click', (e) => {
          const m = e.target.closest('[data-m]')?.dataset.m;
          if (!m) return;
          close();
          if (m === 'edit') editSheet(cur());
          if (m === 'mute') {
            c.mute = !c.mute;
            if (!c.mute) {
              unlockAudio();
              tick();
            }
            save();
            toast(c.mute ? 'أُغلق صوت العداد' : 'صوت العداد مفعّل — لا يُسمع والجوال على الصامت');
          }
          if (m === 'settings') settingsSheet();
          if (m === 'zero') reset();
        });
      }
    );
  };

  // A sideways swipe moves between the pages and does not count.
  let from = null;
  let swiped = 0;
  const onStart = (e) => (from = e.touches.length === 1 ? [e.touches[0].clientX, e.touches[0].clientY] : null);
  const onMove = (e) => {
    if (!e.target.closest('.sheet-wrap')) e.preventDefault();
  };
  const onEnd = (e) => {
    if (!from) return;
    const [dx, dy] = [e.changedTouches[0].clientX - from[0], e.changedTouches[0].clientY - from[1]];
    from = null;
    if (c.mode !== 'pages' || Math.abs(dx) < 45 || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
    swiped = Date.now();
    go(dx > 0 ? 1 : -1); // right to left reading: a swipe to the right brings the next
  };
  const onClick = (e) => {
    if (Date.now() - swiped < 400) return e.preventDefault();
    if (e.target.closest('[data-reset]')) return reset();
    if (e.target.closest('[data-list]')) return listSheet();
    if (e.target.closest('[data-more]')) return moreSheet();
    if (e.target.closest('[data-ui], a, button')) return;
    count();
  };
  const onKey = (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      count();
    }
    if (e.key === 'ArrowLeft') go(1);
    if (e.key === 'ArrowRight') go(-1);
  };
  view.addEventListener('touchstart', onStart, { passive: true });
  view.addEventListener('touchmove', onMove, { passive: false });
  view.addEventListener('touchend', onEnd);
  view.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  return {
    destroy() {
      view.removeEventListener('touchstart', onStart);
      view.removeEventListener('touchmove', onMove);
      view.removeEventListener('touchend', onEnd);
      view.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    },
  };
}
