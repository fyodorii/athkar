<?php
// Settings for the notification scripts. Edit these before uploading.

// Contact address sent to the push services (Apple, Google, Mozilla) with each notification.
define('PUSH_CONTACT', 'alwaledi@outlook.sa');

// Secret for running cron.php from a URL (cron jobs that use wget/curl instead of php).
// Change it to any long random text.
define('CRON_KEY', 'change-me-to-a-long-random-text');

// Other addresses the app runs on that may use these scripts (the GitHub Pages preview).
define('ALLOWED_ORIGINS', ['https://fyodorii.github.io']);

// A reminder that the server finds more than this many minutes late is dropped
// rather than sent (e.g. after the cron job stopped for a while).
define('LATE_MINUTES', 20);

// Most devices one server keeps.
define('MAX_DEVICES', 50000);
