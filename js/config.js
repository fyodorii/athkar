// Shown in the settings; raise it with VERSION in sw.js on every release.
export const APP_VERSION = 76;

// Shown on the widget and at the end of shared adhkar.
export const APP_NAME = 'مواقيت';

// OAuth client ID (Google Cloud Console → APIs & Services → Credentials → «Web application»)
// for «الدخول بحساب Google». Its authorised JavaScript origins and redirect URIs must hold the
// app's address, e.g. https://fyodorii.github.io and https://fyodorii.github.io/athkar/ ; the
// Google Drive API must be enabled in the same project. Empty: the feature says it is not set up.
export const GOOGLE_CLIENT_ID = '1076457962437-sut610crfbqicgjbegt7pvkjbl3ma1ss.apps.googleusercontent.com';

// The designer of the app, shown in the settings and on the share card.
export const DESIGNER = 'ALWALEED';

// The push server (push/worker.js on Cloudflare) that sends the reminders while the app is
// closed, and its public VAPID key. Empty URL: not set up yet, the option is hidden.
export const PUSH_URL = 'https://mawaqit-reminders.mawaqit-athkar.workers.dev';
export const VAPID_PUBLIC = 'BDzdxre9XdCws1qvbYZdU8sB384yM_Te0fM1WgXxeRx5M57VYKtlYsscEcF45AdW9LgeBG___t38Bdc0T92qmM4';
