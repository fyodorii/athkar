// Where the notification scripts (push/*.php) are served: relative to the app, or a
// full address when the app itself is hosted elsewhere (e.g. the GitHub Pages preview).
export const PUSH_URL = location.hostname.endsWith('github.io') ? 'https://www.al-amen.com/adhkar/push/' : 'push/';

// Shown in the settings; raise it with VERSION in sw.js on every release.
export const APP_VERSION = 4;

// Shown on the widget and at the end of shared adhkar.
export const APP_NAME = 'أذكار ومواقيت';
