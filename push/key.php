<?php
// The public VAPID key the app needs to subscribe to notifications.
require __DIR__ . '/lib.php';
allow_cors();

try {
    json_out(['publicKey' => vapid_keys()['public']]);
} catch (Exception $e) {
    json_out(['error' => $e->getMessage()], 500);
}
