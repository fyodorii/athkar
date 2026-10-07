<?php
// Sends every reminder that has come due. Run it every minute so prayer times are on time:
//   php /path/to/adhkar/push/cron.php
//   or: wget -q -O - "https://www.example.com/adhkar/push/cron.php?key=CRON_KEY"
require __DIR__ . '/lib.php';

if (PHP_SAPI !== 'cli' && !(isset($_GET['key']) && hash_equals(CRON_KEY, (string) $_GET['key']))) {
    http_response_code(403);
    exit('Forbidden');
}
header('Content-Type: text/plain; charset=utf-8');
set_time_limit(170);

// Skip this run if the previous one is still sending.
$lock = fopen(data_path('cron.lock'), 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit("Already running\n");

$now = time();
$sent = 0;
$gone = 0;
$devices = glob(subs_dir() . '/*.json') ?: [];

foreach ($devices as $file) {
    $outbox = [];
    $sub = null;
    // Take the due reminders out under the lock, then send without holding it.
    sub_update($file, function (&$data) use ($now, &$outbox, &$sub) {
        if (empty($data['endpoint'])) return false;
        $items = isset($data['items']) ? $data['items'] : [];
        $due = [];
        while ($items && $items[0]['at'] <= $now) $due[] = array_shift($items);
        // Only the newest due reminder of each kind, and never stale ones.
        $byTag = [];
        foreach ($due as $it) {
            if ($it['at'] < $now - LATE_MINUTES * 60) continue;
            $byTag[$it['tag'] ?: uniqid()] = $it;
        }
        $outbox = array_values($byTag);
        // When the schedule is about to run out, remind the user to open the app once.
        $lastAt = $items ? $items[count($items) - 1]['at'] : 0;
        if ($lastAt < $now + 2 * 86400 && empty($data['warned'])) {
            $outbox[] = [
                'title' => 'افتح التطبيق لتحديث التنبيهات',
                'body' => 'افتح «أذكار ومواقيت» مرة واحدة لتستمر تنبيهات الصلاة والأذكار في الأيام القادمة',
                'url' => '#/home',
                'tag' => 'refresh',
            ];
            $data['warned'] = true;
        }
        if ($outbox) $data['last'] = end($outbox);
        $data['items'] = $items;
        $sub = $data;
        return true;
    });

    foreach ($outbox as $msg) {
        unset($msg['at']);
        try {
            $status = push_send($sub, $msg);
        } catch (Exception $e) {
            echo 'Error: ' . $e->getMessage() . "\n";
            continue;
        }
        if ($status === 404 || $status === 410) {
            // The device unsubscribed or the app was removed.
            @unlink($file);
            $gone++;
            break;
        }
        if ($status >= 200 && $status < 300) $sent++;
    }
}

file_put_contents(data_path('state.json'), json_encode(['last_run' => $now, 'devices' => count($devices)]));
echo "Devices: " . count($devices) . ", sent: $sent, removed: $gone\n";
