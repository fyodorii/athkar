<?php
// Status page: open https://<your site>/adhkar/push/check.php after uploading.
require __DIR__ . '/lib.php';

$checks = [];
$checks[] = ['إصدار PHP ' . PHP_VERSION, version_compare(PHP_VERSION, '7.1', '>='), 'يلزم 7.1 أو أحدث'];
$checks[] = ['OpenSSL', extension_loaded('openssl'), 'فعّل إضافة openssl من لوحة الاستضافة'];
$checks[] = ['cURL', function_exists('curl_init'), 'فعّل إضافة curl من لوحة الاستضافة'];
$writable = is_writable(__DIR__ . '/data');
$checks[] = ['مجلد push/data قابل للكتابة', $writable, 'اجعل صلاحيات المجلد 755 أو 775'];

$keyError = '';
try {
    if ($writable) vapid_keys();
} catch (Exception $e) {
    $keyError = $e->getMessage();
}
$checks[] = ['مفاتيح الإشعارات (VAPID)', $writable && !$keyError, $keyError ?: 'تعتمد على الخطوات السابقة'];
$checks[] = ['تشفير نص الإشعار', can_encrypt(), 'يعمل بدونه (يجلب الجهاز النص من الخادم)، لكن PHP 7.3+ أفضل'];
$checks[] = ['تغيير CRON_KEY في config.php', CRON_KEY !== 'change-me-to-a-long-random-text', 'غيّر CRON_KEY إلى نص عشوائي طويل'];

$devices = $writable ? count(glob(subs_dir() . '/*.json') ?: []) : 0;
$state = store_read('state.json');
$lastRun = isset($state['last_run']) ? date('Y-m-d H:i', $state['last_run']) . ' (توقيت الخادم)' : 'لم يعمل بعد';
$late = !isset($state['last_run']) || $state['last_run'] < time() - 180;

$cronCommand = '';
if (isset($_GET['key']) && hash_equals(CRON_KEY, (string) $_GET['key'])) {
    $php = '/usr/local/bin/php';
    foreach (['#^(/opt/cpanel/ea-php\d+/root/usr)/s?bin/#', '#^(/opt/alt/php\d+/usr)/s?bin/#'] as $pattern) {
        if (preg_match($pattern, PHP_BINARY, $m) && @is_executable($m[1] . '/bin/php')) $php = $m[1] . '/bin/php';
    }
    $cronCommand = $php . ' ' . __DIR__ . '/cron.php >/dev/null 2>&1';
}
?>
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>حالة تنبيهات أذكار ومواقيت</title>
<style>
  body { font-family: -apple-system, Tahoma, sans-serif; background: #f4f0e6; color: #15302a; max-width: 640px; margin: 0 auto; padding: 20px 16px; line-height: 1.8; }
  h1 { color: #0e6b57; font-size: 1.4em; }
  li { background: #fff; border: 1px solid #e5dfd0; border-radius: 12px; padding: 8px 14px; margin: 6px 0; list-style: none; }
  ul { padding: 0; }
  .ok { color: #1d7a46; font-weight: bold; }
  .bad { color: #b42318; font-weight: bold; }
  small { color: #64748b; display: block; }
  h2 { color: #0e6b57; font-size: 1.15em; margin-top: 24px; }
  pre { direction: ltr; text-align: left; background: #fff; border: 2px solid #0e6b57; border-radius: 12px; padding: 12px;
        white-space: pre-wrap; word-break: break-all; font-size: 14px; user-select: all; -webkit-user-select: all; }
</style>
</head>
<body>
<h1>حالة تنبيهات «أذكار ومواقيت»</h1>
<ul>
<?php foreach ($checks as $c): ?>
  <li><span class="<?= $c[1] ? 'ok' : 'bad' ?>"><?= $c[1] ? '✔' : '✘' ?></span> <?= htmlspecialchars($c[0]) ?>
    <?php if (!$c[1]): ?><small><?= htmlspecialchars($c[2]) ?></small><?php endif; ?></li>
<?php endforeach; ?>
  <li>الأجهزة المشتركة: <b><?= $devices ?></b></li>
  <li><span class="<?= $late ? 'bad' : 'ok' ?>"><?= $late ? '✘' : '✔' ?></span> آخر تشغيل لمهمة الإرسال (cron): <b><?= htmlspecialchars($lastRun) ?></b>
    <?php if ($late): ?><small>يجب أن تعمل كل دقيقة. افتح هذه الصفحة بإضافة ?key=CRON_KEY لترى الأمر.</small><?php endif; ?></li>
</ul>
<?php if ($cronCommand): ?>
<h2>أمر cron لهذا الخادم</h2>
<p>في cPanel ← <b>Cron Jobs</b>: من «الإعدادات العامة» اختر <b>مرة كل دقيقة (* * * * *)</b>، ثم انسخ السطر التالي كما هو والصقه في خانة <b>الأمر</b>، واضغط «إضافة مهمة Cron جديدة»:</p>
<pre><?= htmlspecialchars($cronCommand) ?></pre>
<?php endif; ?>
</body>
</html>
