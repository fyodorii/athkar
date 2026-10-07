// Small shared pieces of UI: escaping, toasts, bottom sheets, copy/share, haptics.

import { icon } from './icons.js';
import { state } from './store.js';
import { APP_NAME } from './config.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let toastTimer;
export function toast(message, kind = '') {
  const el = $('#toast');
  el.className = `toast show ${kind}`;
  el.innerHTML = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 2600);
}

// A light tap feel where the device supports it (Android); iOS web has no vibration API.
export function haptic(ms = 12) {
  if (state.settings.haptics && navigator.vibrate) navigator.vibrate(ms);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast(`${icon('check', 18)} نُسخ النص`);
}

export async function shareText(text) {
  const body = `${text}\n\n— ${APP_NAME}`;
  if (navigator.share) {
    try {
      await navigator.share({ text: body });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  copyText(body);
}

// Bottom sheet. `content` is HTML; `onMount(sheetEl, close)` wires it up.
export function openSheet(content, onMount, { title = '' } = {}) {
  const root = $('#sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop"></div>
    <div class="sheet" role="dialog" aria-modal="true">
      <div class="sheet-grip"></div>
      ${title ? `<div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn ghost" data-close aria-label="إغلاق">${icon('close', 20)}</button></div>` : ''}
      <div class="sheet-body">${content}</div>
    </div>`;
  root.appendChild(wrap);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    wrap.classList.remove('open');
    setTimeout(() => {
      wrap.remove();
      if (!root.children.length) document.body.classList.remove('sheet-open');
    }, 260);
  };
  wrap.querySelector('.sheet-backdrop').addEventListener('click', close);
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  onMount?.(wrap.querySelector('.sheet'), close);
  return close;
}

export function confirmSheet(message, { ok = 'حذف', danger = true } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openSheet(
      `<p class="confirm-text">${esc(message)}</p>
       <div class="sheet-actions">
         <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>
         <button class="btn ghost" data-close>إلغاء</button>
       </div>`,
      (el, close) => {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          answered = true;
          resolve(true);
          close();
        });
        el.querySelectorAll('[data-close]').forEach((b) =>
          b.addEventListener('click', () => {
            if (!answered) resolve(false);
          })
        );
        el.parentElement.querySelector('.sheet-backdrop').addEventListener('click', () => {
          if (!answered) resolve(false);
        });
      }
    );
  });
}

// Segmented control linking sibling pages (e.g. الأذكار | أذكاري | المسبحة).
export function segmented(items, active) {
  return `<div class="segmented" role="tablist">${items
    .map(([href, label]) => `<a href="${href}" role="tab" class="${href === active ? 'on' : ''}">${esc(label)}</a>`)
    .join('')}</div>`;
}

export function pageHeader(title, { back, actions = '', sub = '' } = {}) {
  return `<header class="page-head ${back ? 'with-back' : ''}">
    ${back ? `<a class="icon-btn ghost back" href="${back}" aria-label="رجوع">${icon('back', 24)}</a>` : ''}
    <div class="page-title"><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
    <div class="page-actions">${actions}</div>
  </header>`;
}

// Toggle switch markup; the caller listens for "change" on the input.
export function toggle(name, on, attrs = '') {
  return `<label class="switch"><input type="checkbox" name="${name}" ${on ? 'checked' : ''} ${attrs}><span></span></label>`;
}

// Circular progress ring (SVG) for counters.
export function ring(fraction, size = 56, stroke = 5) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fraction));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-fg"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}
