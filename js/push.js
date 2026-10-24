// The service worker keeps the app on the device (opens instantly, works offline) and
// installs new releases; plus two checks for the iPhone home-screen install hint.

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.navigator.standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;

let registration;
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  if (!registration) {
    // A new release takes over the page while it is open: reload once so the new
    // files show now rather than on the next launch. Not on the very first install.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
    registration = navigator.serviceWorker.register('sw.js').catch(() => null);
  }
  return registration;
}

// Asks the server for a newer release; an iPhone home-screen app can stay open for days.
export function checkForUpdate() {
  registerServiceWorker().then((reg) => reg?.update().catch(() => {}));
}
