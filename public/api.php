<?php
declare(strict_types=1);
// Koncha experimental ciphertext relay. Not production-grade E2EE. See docs/SECURITY.md.
require_once __DIR__ . '/push-service.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

function reply(int $code, array $data): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
function exact(mixed $value, int $length): bool {
    return is_string($value) && strlen($value) === $length && preg_match('/^[A-Za-z0-9_-]+$/D', $value) === 1;
}
function validRoom(mixed $value): bool { return exact($value, 24); }
function validToken(mixed $value): bool { return exact($value, 43); }
function authToken(): ?string {
    $raw = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!is_string($raw) || !str_starts_with($raw, 'Bearer ')) return null;
    $token = substr($raw, 7);
    return validToken($token) ? $token : null;
}
function postJson(): array {
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length < 0 || $length > 14000) reply(413, ['error' => 'Request too large']);
    $raw = file_get_contents('php://input', false, null, 0, 14001);
    if ($raw === false || strlen($raw) > 14000) reply(413, ['error' => 'Request too large']);
    try { $data = json_decode($raw, true, 16, JSON_THROW_ON_ERROR); }
    catch (Throwable) { reply(400, ['error' => 'Invalid JSON']); }
    if (!is_array($data)) reply(400, ['error' => 'Invalid payload']);
    return $data;
}
function validEnvelope(mixed $value): bool {
    return is_array($value) && ($value['v'] ?? null) === 1
        && is_string($value['id'] ?? null)
        && preg_match('/^[a-f0-9-]{36}$/D', $value['id']) === 1
        && exact($value['iv'] ?? null, 16)
        && is_string($value['ciphertext'] ?? null)
        && strlen($value['ciphertext']) <= 11000
        && preg_match('/^[A-Za-z0-9_-]{24,11000}$/D', $value['ciphertext']) === 1;
}
function validInvitePayload(mixed $value): bool {
    return is_array($value) && exact($value['iv'] ?? null, 16)
        && is_string($value['ciphertext'] ?? null)
        && strlen($value['ciphertext']) <= 1200
        && preg_match('/^[A-Za-z0-9_-]{32,1200}$/D', $value['ciphertext']) === 1;
}
function cleanMessages(array &$state): bool {
    $before = count($state['messages'] ?? []);
    $now = time();
    $state['messages'] = array_values(array_filter($state['messages'] ?? [], static function ($msg) use ($now) {
        return is_array($msg) && isset($msg['storedAt']) && is_int($msg['storedAt'])
            && ($now - $msg['storedAt'] < 604800);
    }));
    if (count($state['messages']) > 300) $state['messages'] = array_slice($state['messages'], -300);
    return $before !== count($state['messages']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) reply(405, ['error' => 'Method not allowed']);
if ($method === 'POST' && !str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) reply(415, ['error' => 'Expected application/json']);
$action = $_GET['action'] ?? '';
if (!in_array($action, ['init', 'list', 'send', 'invite_create', 'invite_claim', 'invite_revoke', 'invite_status', 'invite_check', 'heartbeat', 'presence', 'push_config', 'push_subscribe', 'push_unsubscribe'], true)) reply(404, ['error' => 'Unknown action']);
if ((in_array($action, ['list', 'invite_status', 'presence', 'push_config'], true)) !== ($method === 'GET')) reply(405, ['error' => 'Method not allowed']);
$body = $method === 'POST' ? postJson() : [];
$room = $method === 'POST' ? ($body['roomId'] ?? null) : ($_GET['room'] ?? null);
if (!validRoom($room)) reply(400, ['error' => 'Invalid room']);
$claim = in_array($action, ['invite_claim', 'invite_check'], true);
$token = $claim ? null : authToken();
if (!$claim && $token === null) reply(401, ['error' => 'Missing authorization']);
if ($action === 'send' && !validEnvelope($body['envelope'] ?? null)) reply(400, ['error' => 'Invalid envelope']);
if ($action === 'invite_create' && (!exact($body['inviteId'] ?? null, 22) || !validToken($body['verifier'] ?? null) || !validInvitePayload($body['payload'] ?? null))) reply(400, ['error' => 'Invalid invitation']);
if ($claim && (!exact($body['inviteId'] ?? null, 22) || !validToken($body['verifier'] ?? null))) reply(400, ['error' => 'Invalid invitation']);
if ($action === 'heartbeat' && !exact($body['presenceId'] ?? null, 16)) reply(400, ['error' => 'Invalid presence token']);
if ($action === 'send' && isset($body['senderPresenceId']) && !exact($body['senderPresenceId'], 16)) reply(400, ['error' => 'Invalid sending device']);
if (in_array($action, ['push_subscribe', 'push_unsubscribe'], true)) {
    if (!exact($body['deviceId'] ?? null, 16) || !pushEndpointAllowed($body['endpoint'] ?? null)) reply(400, ['error' => 'Invalid push subscription']);
    if ($action === 'push_subscribe' && (!pushPrivateKey() || !pushSubject() || !function_exists('curl_init'))) reply(503, ['error' => 'Push is not configured']);
}

// The directory must be OUTSIDE the document root. File locking makes one-time claims atomic.
$directory = getenv('KONCHA_DATA_DIR') ?: dirname(__DIR__) . '/var/rooms';
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) reply(500, ['error' => 'Storage unavailable']);
$path = rtrim($directory, '/') . '/' . $room . '.json';
if ($action !== 'init' && !is_file($path)) reply($claim ? 410 : 404, ['error' => $claim ? 'invite_unavailable' : 'Room not found']);
$pendingPush = [];
$handle = fopen($path, 'c+');
if (!$handle) reply(500, ['error' => 'Storage unavailable']);
@chmod($path, 0600);
try {
    if (!flock($handle, LOCK_EX)) reply(503, ['error' => 'Storage busy']);
    rewind($handle);
    $raw = stream_get_contents($handle);
    $state = ($raw !== false && trim($raw) !== '') ? json_decode($raw, true) : null;
    if ($state !== null && (!is_array($state) || !isset($state['verifier']) || !is_string($state['verifier']))) reply(500, ['error' => 'Invalid room state']);
    $modified = false;
    if ($state === null) {
        if ($action !== 'init') reply(404, ['error' => 'Room not found']);
        $state = ['verifier' => hash('sha256', $token), 'createdAt' => time(), 'messages' => [], 'invite' => null, 'presence' => [], 'claimed' => false, 'push' => []];
        $modified = true;
    } elseif (!$claim && !hash_equals($state['verifier'], hash('sha256', $token))) {
        reply(403, ['error' => 'Access denied']);
    }
    $modified = cleanMessages($state) || $modified;
    // Purge subscriptions not refreshed for 30 days (lazy cleanup, no telemetry).
    $existingPush = $state['push'] ?? [];
    $state['push'] = array_values(array_filter(is_array($existingPush) ? $existingPush : [], static function($sub) {
        return is_array($sub) && exact($sub['deviceId'] ?? null, 16)
          && pushEndpointAllowed($sub['endpoint'] ?? null)
          && is_int($sub['updatedAt'] ?? null) && $sub['updatedAt'] >= time() - 30 * 86400;
    }));
    if ($existingPush !== $state['push']) $modified = true;
    $recent = [];
    foreach ($state['presence'] ?? [] as $id => $seen) {
        if (exact($id, 16) && is_int($seen) && $seen > time() - 70) $recent[$id] = $seen;
    }
    if ($recent !== ($state['presence'] ?? [])) { $state['presence'] = $recent; $modified = true; }

    if ($claim) {
        $invite = $state['invite'] ?? null;
        if (!is_array($invite) || !hash_equals($invite['id'], $body['inviteId'])) reply(410, ['error' => 'invite_unavailable']);
        if (!hash_equals($invite['verifier'], $body['verifier'])) reply(403, ['error' => 'invite_invalid']);
        if ($invite['expiresAt'] <= time()) {
            // Retain a minimal tombstone so the recipient sees "expired", not "unknown".
            // Never retain the encrypted room secret after an expiry is observed.
            unset($invite['payload']);
            $state['invite'] = $invite;
            rewind($handle);
            $encoded = json_encode($state, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            if (!ftruncate($handle, 0) || fwrite($handle, $encoded) !== strlen($encoded)) reply(500, ['error' => 'Storage write failed']);
            fflush($handle);
            reply(410, ['error' => 'invite_expired']);
        }
        if (!isset($invite['payload'])) reply(410, ['error' => 'invite_expired']);
        if ($action === 'invite_check') reply(200, ['expiresAt' => $invite['expiresAt']]);
        $payload = $invite['payload'];
        $state['invite'] = null; // atomic one-time redemption under exclusive lock
        $state['claimed'] = true; // one room is always for exactly two peers
        $modified = true;
    } elseif ($action === 'invite_create') {
        if (!empty($state['claimed'])) reply(409, ['error' => 'room_already_joined']);
        $state['invite'] = [
            'id' => $body['inviteId'], 'verifier' => $body['verifier'],
            'payload' => $body['payload'], 'expiresAt' => time() + 3600,
        ];
        $modified = true;
    } elseif ($action === 'invite_revoke') {
        $state['invite'] = null;
        $modified = true;
    } elseif ($action === 'push_subscribe') {
        $state['push'] = array_values(array_filter($state['push'], static fn($s) => $s['deviceId'] !== $body['deviceId']));
        if (count($state['push']) >= 4) reply(429, ['error' => 'Too many devices']);
        $state['push'][] = [ 'deviceId' => $body['deviceId'], 'endpoint' => $body['endpoint'], 'updatedAt' => time() ];
        $modified = true;
    } elseif ($action === 'push_unsubscribe') {
        $state['push'] = array_values(array_filter($state['push'], static fn($s) => !($s['deviceId'] === $body['deviceId'] && $s['endpoint'] === $body['endpoint'])));
        $modified = true;
    } elseif ($action === 'heartbeat') {
        $state['presence'][$body['presenceId']] = time();
        // Protect the file-backed demo relay from unbounded presence entries.
        if (count($state['presence']) > 4) $state['presence'] = array_slice($state['presence'], -4, null, true);
        $modified = true;
    } elseif ($action === 'send') {
        $envelope = $body['envelope'];
        $exists = false;
        foreach ($state['messages'] as $msg) {
            if ($msg['id'] === $envelope['id']) { $exists = true; break; }
        }
        if (!$exists) {
            $envelope = array_intersect_key($envelope, array_flip(['v','id','iv','ciphertext']));
            $envelope['storedAt'] = time();
            $state['messages'][] = $envelope;
            $modified = true;
            $source = $body['senderPresenceId'] ?? '';
            // Notification target is device-local opaque id, never a human name.
            foreach ($state['push'] as $subscription) {
                if ($subscription['deviceId'] !== $source) $pendingPush[] = $subscription['endpoint'];
            }
        }
        cleanMessages($state);
    }
    if ($modified) {
        rewind($handle);
        $encoded = json_encode($state, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (!ftruncate($handle, 0) || fwrite($handle, $encoded) !== strlen($encoded)) reply(500, ['error' => 'Storage write failed']);
        fflush($handle);
    }
    if ($action === 'invite_claim') reply(200, ['payload' => $payload]);
    if ($action === 'invite_create') reply(200, ['expiresAt' => $state['invite']['expiresAt']]);
    if ($action === 'invite_status') reply(200, ['expiresAt' => (($state['invite']['expiresAt'] ?? 0) > time()) ? $state['invite']['expiresAt'] : null]);
    if ($action === 'list') reply(200, ['messages' => $state['messages']]);
    if ($action === 'presence') reply(200, ['presence' => $state['presence']]);
    if ($action === 'push_config') {
        $vapidKey = pushPrivateKey(); $subject = pushSubject();
        reply(200, ['enabled' => (bool) ($vapidKey && $subject && function_exists('curl_init')), 'publicKey' => ($vapidKey && $subject) ? pushPublicKey($vapidKey) : null]);
    }
    if ($action !== 'send') reply(200, ['ok' => true]);
} finally {
    flock($handle, LOCK_UN);
    fclose($handle);
}

// Release the file lock BEFORE contacting third-party push infrastructure.
// Web Push is best-effort. Message delivery must never depend on push success.
if ($action === 'send') {
    pushDeliver($pendingPush);
    reply(200, ['ok' => true]);
}
