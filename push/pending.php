<?php
// For servers whose PHP cannot encrypt payloads (older than 7.3): the push arrives
// empty, and the service worker asks here for the text of the last one sent.
//   POST {"endpoint": "..."}
require __DIR__ . '/lib.php';
allow_cors();

$in = json_decode(file_get_contents('php://input'), true);
$endpoint = is_array($in) && isset($in['endpoint']) ? $in['endpoint'] : '';
if (!endpoint_allowed($endpoint)) json_out(['error' => 'Unknown push service'], 400);
$file = sub_file($endpoint);
$sub = is_file($file) ? json_decode(file_get_contents($file), true) : null;
json_out($sub && !empty($sub['last']) ? $sub['last'] : ['title' => 'أذكار ومواقيت', 'body' => '']);
