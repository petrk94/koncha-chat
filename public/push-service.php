<?php
declare(strict_types=1);
/**
 * Standards-based Web Push with an EMPTY payload: no chat text, sender name,
 * room identifier or ciphertext is ever passed to a push provider.
 * Experimental and explicitly opt-in. See docs/WEB_PUSH_0_7.md.
 */
function pushB64(string $raw): string {
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}
function pushPrivateKey(): OpenSSLAsymmetricKey|null {
    $path = getenv('KONCHA_VAPID_PRIVATE_KEY_FILE');
    if (!$path || !is_file($path)) return null;
    $file = realpath($path);
    $docroot = realpath(__DIR__);
    // The VAPID PRIVATE key must never be served from public/ or a subdirectory.
    if ($file === false || $docroot === false || str_starts_with($file, $docroot . DIRECTORY_SEPARATOR)) return null;
    $raw = @file_get_contents($file);
    if (!is_string($raw) || strlen($raw) > 8192) return null;
    $key = @openssl_pkey_get_private($raw);
    if (!$key instanceof OpenSSLAsymmetricKey) return null;
    $details = openssl_pkey_get_details($key);
    if (($details['type'] ?? null) !== OPENSSL_KEYTYPE_EC || ($details['ec']['curve_name'] ?? null) !== 'prime256v1') return null;
    return $key;
}
function pushPublicKey(OpenSSLAsymmetricKey $key): string {
    $details = openssl_pkey_get_details($key);
    if (!is_array($details) || strlen($details['ec']['x'] ?? '') !== 32 || strlen($details['ec']['y'] ?? '') !== 32) {
        throw new RuntimeException('Invalid VAPID key material');
    }
    return pushB64("\x04" . $details['ec']['x'] . $details['ec']['y']);
}
function pushSubject(): ?string {
    $subject = getenv('KONCHA_VAPID_SUBJECT') ?: '';
    return preg_match('/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/D', $subject) ? $subject : null;
}
/** Restrict outbound requests to known Web Push vendor hosts to prevent SSRF. */
function pushEndpointAllowed(mixed $endpoint): bool {
    if (!is_string($endpoint) || strlen($endpoint) < 40 || strlen($endpoint) > 2048) return false;
    $parts = parse_url($endpoint);
    if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user'], $parts['pass']) || isset($parts['fragment']) || isset($parts['port'])) return false;
    if (isset($parts['user']) || isset($parts['pass'])) return false;
    $host = strtolower(rtrim($parts['host'], '.'));
    $known = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'updates.push.services.mozilla.org'];
    if (in_array($host, $known, true)) return true;
    return preg_match('/^(?:[a-z0-9-]+\.)+push\.apple\.com$/D', $host) === 1
        || preg_match('/^(?:[a-z0-9-]+\.)+notify\.windows\.com$/D', $host) === 1;
}
/** Convert a DER-encoded ECDSA P-256 signature to JOSE's 64-byte r||s format. */
function pushJoseSignature(string $der): string {
    $bytes = array_values(unpack('C*', $der));
    $at = 0;
    if (($bytes[$at++] ?? null) !== 0x30) throw new RuntimeException('Invalid ECDSA signature');
    $length = $bytes[$at++] ?? -1;
    if ($length >= 0x80 || $length !== count($bytes) - $at) throw new RuntimeException('Invalid ECDSA signature length');
    $components = [];
    for ($i = 0; $i < 2; $i++) {
        if (($bytes[$at++] ?? null) !== 0x02) throw new RuntimeException('Invalid signature integer');
        $len = $bytes[$at++] ?? -1;
        if ($len < 1 || $len > 33 || $at + $len > count($bytes)) throw new RuntimeException('Invalid signature component');
        $int = array_slice($bytes, $at, $len); $at += $len;
        while (count($int) > 1 && $int[0] === 0) array_shift($int);
        if (count($int) > 32) throw new RuntimeException('Invalid signature size');
        $components[] = str_repeat("\0", 32 - count($int)) . pack('C*', ...$int);
    }
    if ($at !== count($bytes)) throw new RuntimeException('Trailing signature bytes');
    return implode('', $components);
}
function pushVapidJwt(OpenSSLAsymmetricKey $key, string $endpoint, string $subject, ?int $now = null): string {
    if (!pushEndpointAllowed($endpoint)) throw new InvalidArgumentException('Invalid push endpoint');
    $parts = parse_url($endpoint);
    $audience = 'https://' . strtolower($parts['host']);
    $now ??= time();
    $header = pushB64('{"typ":"JWT","alg":"ES256"}');
    $claims = pushB64(json_encode(['aud' => $audience, 'exp' => $now + 3600, 'sub' => $subject], JSON_THROW_ON_ERROR));
    $message = $header . '.' . $claims;
    if (!openssl_sign($message, $signature, $key, OPENSSL_ALGO_SHA256)) throw new RuntimeException('VAPID signing failed');
    return $message . '.' . pushB64(pushJoseSignature($signature));
}
/**
 * Returns HTTP status or 0 for a transport error. No message payload is sent.
 * Background delivery is best-effort; sending messages does not depend on Push.
 */
function pushSendEmpty(string $endpoint, OpenSSLAsymmetricKey $key, string $subject): int {
    if (!pushEndpointAllowed($endpoint) || !function_exists('curl_init')) return 0;
    $jwt = pushVapidJwt($key, $endpoint, $subject);
    $curl = curl_init($endpoint);
    if ($curl === false) return 0;
    try {
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => '',
            CURLOPT_HTTPHEADER => [
                'Authorization: vapid t=' . $jwt . ', k=' . pushPublicKey($key),
                'TTL: 60', 'Urgency: normal', 'Content-Length: 0',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT_MS => 1200, CURLOPT_TIMEOUT_MS => 2500,
            CURLOPT_FOLLOWLOCATION => false, CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        curl_exec($curl);
        return (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    } finally { curl_close($curl); }
}
function pushDeliver(array $endpoints): void {
    $key = pushPrivateKey(); $subject = pushSubject();
    if (!$key || !$subject || !$endpoints) return;
    // Hard cap, even in case a corrupt storage file has more entries.
    foreach (array_slice(array_unique($endpoints), 0, 4) as $endpoint) {
        if (is_string($endpoint)) pushSendEmpty($endpoint, $key, $subject);
    }
}
