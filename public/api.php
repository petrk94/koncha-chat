<?php
declare(strict_types=1);
// Koncha v0.1: experimental ciphertext relay. NOT production-grade secure messaging.
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
function validRoom(mixed $value): bool {
    return is_string($value) && preg_match('/^[A-Za-z0-9_-]{24}$/D', $value) === 1;
}
function validToken(mixed $value): bool {
    return is_string($value) && preg_match('/^[A-Za-z0-9_-]{43}$/D', $value) === 1;
}
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
        && is_string($value['iv'] ?? null)
        && preg_match('/^[A-Za-z0-9_-]{16}$/D', $value['iv']) === 1
        && is_string($value['ciphertext'] ?? null)
        && strlen($value['ciphertext']) <= 11000
        && preg_match('/^[A-Za-z0-9_-]{24,11000}$/D', $value['ciphertext']) === 1;
}
function cleanMessages(array &$state): bool {
    $before = count($state['messages'] ?? []);
    $now = time();
    $state['messages'] = array_values(array_filter($state['messages'] ?? [], static function ($msg) use ($now) {
        return is_array($msg) && isset($msg['storedAt']) && is_int($msg['storedAt'])
            && ($now - $msg['storedAt'] < 86400);
    }));
    if (count($state['messages']) > 300) $state['messages'] = array_slice($state['messages'], -300);
    return $before !== count($state['messages']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) reply(405, ['error' => 'Method not allowed']);
if ($method === 'POST' && !str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) reply(415, ['error' => 'Expected application/json']);
$action = $_GET['action'] ?? '';
$body = $method === 'POST' ? postJson() : [];
$room = $method === 'POST' ? ($body['roomId'] ?? null) : ($_GET['room'] ?? null);
$token = authToken();
if (!validRoom($room) || $token === null) reply(400, ['error' => 'Invalid room or authorization']);
if (!in_array($action, ['init', 'list', 'send'], true)) reply(404, ['error' => 'Unknown action']);
if (($action === 'init' || $action === 'send') && $method !== 'POST') reply(405, ['error' => 'Method not allowed']);
if ($action === 'list' && $method !== 'GET') reply(405, ['error' => 'Method not allowed']);
if ($action === 'send' && !validEnvelope($body['envelope'] ?? null)) reply(400, ['error' => 'Invalid envelope']);

// The directory must be OUTSIDE the document root in production.
$directory = getenv('KONCHA_DATA_DIR') ?: dirname(__DIR__) . '/var/rooms';
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) reply(500, ['error' => 'Storage unavailable']);
$path = rtrim($directory, '/') . '/' . $room . '.json';
// Do not create empty room files in response to arbitrary read/send requests.
if ($action !== 'init' && !is_file($path)) reply(404, ['error' => 'Room not found']);
$handle = fopen($path, 'c+');
if (!$handle) reply(500, ['error' => 'Storage unavailable']);
@chmod($path, 0600);
try {
    if (!flock($handle, LOCK_EX)) reply(503, ['error' => 'Storage busy']);
    rewind($handle);
    $raw = stream_get_contents($handle);
    $state = ($raw !== false && trim($raw) !== '') ? json_decode($raw, true) : null;
    if ($state !== null && (!is_array($state) || !isset($state['verifier']))) reply(500, ['error' => 'Invalid room state']);
    $verifier = hash('sha256', $token);
    $modified = false;
    if ($state === null) {
        if ($action !== 'init') reply(404, ['error' => 'Room not found']);
        $state = ['verifier' => $verifier, 'createdAt' => time(), 'messages' => []];
        $modified = true;
    } elseif (!hash_equals($state['verifier'], $verifier)) {
        reply(403, ['error' => 'Access denied']);
    }
    $modified = cleanMessages($state) || $modified;
    if ($action === 'send') {
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
        }
        cleanMessages($state);
    }
    if ($modified) {
        rewind($handle);
        $encoded = json_encode($state, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (!ftruncate($handle, 0) || fwrite($handle, $encoded) !== strlen($encoded)) reply(500, ['error' => 'Storage write failed']);
        fflush($handle);
    }
    if ($action === 'list') reply(200, ['messages' => $state['messages']]);
    reply(200, ['ok' => true]);
} finally {
    flock($handle, LOCK_UN);
    fclose($handle);
}
