<?php
// Saves a device's subscription with its reminder schedule (worked out by the app),
// removes it, or sends it a test notification.
//   POST {"subscription": {...}, "schedule": [{"at": ms, "title", "body", "url", "tag"}, ...], "place": "..."}
//   POST {"endpoint": "...", "remove": true}
//   POST {"endpoint": "...", "test": true}
require __DIR__ . '/lib.php';
allow_cors();

const MAX_ITEMS = 1500;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_out(['error' => 'POST only'], 405);

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) json_out(['error' => 'Bad JSON'], 400);

$endpoint = isset($in['subscription']['endpoint']) ? $in['subscription']['endpoint'] : (isset($in['endpoint']) ? $in['endpoint'] : '');
if (!endpoint_allowed($endpoint)) json_out(['error' => 'Unknown push service'], 400);
$file = sub_file($endpoint);

try {
    if (!empty($in['remove'])) {
        @unlink($file);
        json_out(['ok' => true]);
    }

    if (!empty($in['test'])) {
        $sub = is_file($file) ? json_decode(file_get_contents($file), true) : null;
        if (!$sub) json_out(['error' => 'Not subscribed'], 404);
        $status = push_send($sub, [
            'title' => 'أذكار ومواقيت',
            'body' => 'تعمل التنبيهات على جهازك ✔ «ألا بذكر الله تطمئن القلوب»',
            'url' => '#/home',
            'tag' => 'test',
        ]);
        json_out(['ok' => $status >= 200 && $status < 300, 'status' => $status]);
    }

    if (!is_file($file) && count(glob(subs_dir() . '/*.json')) >= MAX_DEVICES) json_out(['error' => 'Too many devices'], 503);

    $now = time() * 1000;
    $items = [];
    foreach (isset($in['schedule']) && is_array($in['schedule']) ? $in['schedule'] : [] as $it) {
        if (!is_array($it) || !isset($it['at']) || !is_numeric($it['at'])) continue;
        $at = (int) round($it['at'] / 1000);
        if ($at * 1000 < $now - 60000 || $at * 1000 > $now + 45 * 86400000) continue;
        $url = clip(isset($it['url']) ? $it['url'] : '', 120);
        $items[] = [
            'at' => $at,
            'title' => clip(isset($it['title']) ? $it['title'] : '', 80),
            'body' => clip(isset($it['body']) ? $it['body'] : '', 240),
            'url' => preg_match('/^#\/[\w\/-]*$/', $url) ? $url : '#/home',
            'tag' => clip(isset($it['tag']) ? preg_replace('/[^\w-]/', '', $it['tag']) : '', 40),
        ];
        if (count($items) >= MAX_ITEMS) break;
    }
    usort($items, function ($a, $b) { return $a['at'] - $b['at']; });

    $keys = isset($in['subscription']['keys']) && is_array($in['subscription']['keys']) ? $in['subscription']['keys'] : [];
    sub_update($file, function (&$sub) use ($endpoint, $keys, $items, $in) {
        $sub = [
            'endpoint' => $endpoint,
            'keys' => [
                'p256dh' => isset($keys['p256dh']) ? (string) $keys['p256dh'] : '',
                'auth' => isset($keys['auth']) ? (string) $keys['auth'] : '',
            ],
            'place' => clip(isset($in['place']) ? $in['place'] : '', 60),
            'items' => $items,
            'updated' => time(),
            'warned' => false,
        ];
        return true;
    });
    json_out(['ok' => true, 'count' => count($items)]);
} catch (Exception $e) {
    json_out(['error' => $e->getMessage()], 500);
}
