<?php
/**
 * track.php — Page visit logger
 * Called from index.html on page load (fire-and-forget fetch)
 * Logs: time, IP, device, browser, referrer — no image involved
 */
header('Access-Control-Allow-Origin: https://isupportblueeconomy.click');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$ip = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']
       ?? $_SERVER['HTTP_X_REAL_IP']
       ?? $_SERVER['REMOTE_ADDR']
       ?? 'unknown')[0]);

$ua      = $_SERVER['HTTP_USER_AGENT'] ?? '';
$referer = $_SERVER['HTTP_REFERER']    ?? 'direct';
$lang    = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';

function det($ua, $patterns){
    foreach($patterns as $k => $p){ if(preg_match($p, $ua)) return $k; } return 'Unknown';
}
$device  = det($ua, ['iPhone'=>'/iPhone/','iPad'=>'/iPad/','Android'=>'/Android/','Windows'=>'/Windows/','Mac'=>'/Macintosh/']);
$browser = det($ua, ['Chrome iOS'=>'/CriOS/','Firefox iOS'=>'/FxiOS/','Chrome'=>'/Chrome/','Firefox'=>'/Firefox/','Safari'=>'/Safari/','Edge'=>'/Edge/']);

$entry = [
    'type'      => 'visit',
    'datetime'  => date('Y-m-d H:i:s'),
    'ip'        => $ip,
    'device'    => $device,
    'browser'   => $browser,
    'language'  => substr($lang, 0, 20),
    'referer'   => substr($referer, 0, 200),
];

$logDir  = __DIR__ . '/logs';
$logFile = $logDir . '/visits-log.json';
if (!is_dir($logDir)) { @mkdir($logDir, 0755, true); }

$htaccess = $logDir . '/.htaccess';
if (!file_exists($htaccess)) {
    file_put_contents($htaccess, "Order deny,allow\nDeny from all\n");
}

file_put_contents($logFile, json_encode($entry) . "\n", FILE_APPEND | LOCK_EX);
echo json_encode(['ok' => true]);
