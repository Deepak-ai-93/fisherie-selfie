<?php
/**
 * upload.php — Blue Economy Selfie Filter
 * isupportblueeconomy.click
 *
 * Handles:
 *  1. Photo upload (saves PNG to /uploads/)
 *  2. Consent + visitor logging (appends to /logs/consent-log.json)
 *
 * SETUP on Hostinger:
 *  - Create folders: /uploads/ (chmod 755) and /logs/ (chmod 755)
 *  - Place this file in the domain root
 *  - Visit /upload.php directly — healthy response: {"ok":false,"error":"POST only"}
 */

/* ── CORS ──────────────────────────────────────────────── */
header('Access-Control-Allow-Origin: https://isupportblueeconomy.click');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'POST only']);
    exit;
}

/* ── Parse body ────────────────────────────────────────── */
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!isset($data['image'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'no image']);
    exit;
}

/* ── Decode image ──────────────────────────────────────── */
$img = $data['image'];
if (strpos($img, ',') !== false) { $img = explode(',', $img, 2)[1]; }
$bytes = base64_decode($img, true);

if ($bytes === false || strlen($bytes) < 1000) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad image data']);
    exit;
}
if (strlen($bytes) > 8 * 1024 * 1024) {
    http_response_code(413);
    echo json_encode(['ok' => false, 'error' => 'image too large (max 8MB)']);
    exit;
}

/* ── Verify it's actually a PNG ────────────────────────── */
if (substr($bytes, 0, 4) !== "\x89PNG") {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'not a valid PNG']);
    exit;
}

/* ── Save image ────────────────────────────────────────── */
$uploadDir = __DIR__ . '/uploads';
if (!is_dir($uploadDir)) { @mkdir($uploadDir, 0755, true); }
if (!is_writable($uploadDir)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'uploads folder not writable']);
    exit;
}

$timestamp = date('Ymd_His');
$uid       = substr(bin2hex(random_bytes(6)), 0, 10);
$filename  = 'selfie_' . $timestamp . '_' . $uid . '.png';
$filepath  = $uploadDir . '/' . $filename;

if (file_put_contents($filepath, $bytes) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write failed']);
    exit;
}

/* ── Collect visitor data ──────────────────────────────── */
$ip         = $_SERVER['HTTP_X_FORWARDED_FOR']
              ?? $_SERVER['HTTP_X_REAL_IP']
              ?? $_SERVER['REMOTE_ADDR']
              ?? 'unknown';

// Take only the first IP if comma-separated (proxy chain)
$ip = trim(explode(',', $ip)[0]);

$userAgent  = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
$referer    = $_SERVER['HTTP_REFERER']    ?? 'direct';
$language   = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? 'unknown';

// Basic device/platform detection from UA
function detectDevice($ua) {
    if (preg_match('/iPhone/', $ua))  return 'iPhone';
    if (preg_match('/iPad/', $ua))    return 'iPad';
    if (preg_match('/Android/', $ua)) return 'Android';
    if (preg_match('/Windows/', $ua)) return 'Windows';
    if (preg_match('/Macintosh/', $ua)) return 'Mac';
    return 'Unknown';
}
function detectBrowser($ua) {
    if (preg_match('/CriOS/', $ua))   return 'Chrome iOS';
    if (preg_match('/FxiOS/', $ua))   return 'Firefox iOS';
    if (preg_match('/EdgA/', $ua))    return 'Edge Android';
    if (preg_match('/Chrome/', $ua))  return 'Chrome';
    if (preg_match('/Firefox/', $ua)) return 'Firefox';
    if (preg_match('/Safari/', $ua))  return 'Safari';
    if (preg_match('/Edge/', $ua))    return 'Edge';
    return 'Unknown';
}

/* ── Build log entry ───────────────────────────────────── */
$logEntry = [
    // Identity & time
    'id'            => $uid,
    'datetime'      => date('Y-m-d H:i:s'),
    'timestamp_utc' => gmdate('Y-m-d H:i:s') . ' UTC',

    // Consent (always true if this endpoint is reached — gate enforces it)
    'consent'       => true,
    'consent_text'  => 'I consent to my photo being stored and used by the Gujarat Fisheries campaign.',
    'campaign'      => 'I Support Blue Economy — Gujarat Fisheries',

    // Visitor info
    'ip'            => $ip,
    'device'        => detectDevice($userAgent),
    'browser'       => detectBrowser($userAgent),
    'language'      => substr($language, 0, 20),
    'referer'       => substr($referer, 0, 200),
    'user_agent'    => substr($userAgent, 0, 300),

    // File saved
    'file'          => 'uploads/' . $filename,
    'file_size_kb'  => round(strlen($bytes) / 1024, 1),
];

/* ── Append to consent log ─────────────────────────────── */
$logDir  = __DIR__ . '/logs';
$logFile = $logDir . '/consent-log.json';

if (!is_dir($logDir)) { @mkdir($logDir, 0755, true); }

// Protect the log folder from web access
$htaccess = $logDir . '/.htaccess';
if (!file_exists($htaccess)) {
    file_put_contents($htaccess, "Order deny,allow\nDeny from all\n");
}

// Append as newline-delimited JSON (one JSON object per line — easy to parse)
$line = json_encode($logEntry, JSON_UNESCAPED_UNICODE) . "\n";
file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);

/* ── Respond ───────────────────────────────────────────── */
echo json_encode([
    'ok'   => true,
    'id'   => $uid,
    'file' => 'uploads/' . $filename,
]);
