// Inside the Windows app (desktop/, Tauri): links to other sites open in the browser, not
// inside the app's window, and the page gets a `desktop` class for the wide layout.

const T = window.__TAURI__ || null;
export const isDesktop = !!T;

export function startDesktop() {
  if (!T) return;
  document.documentElement.classList.add('desktop');
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin === location.origin || !/^https?:$/.test(url.protocol)) return;
    e.preventDefault();
    T.opener.openUrl(url.href);
  });
}
