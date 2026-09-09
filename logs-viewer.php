<?php
/**
 * logs-viewer.php — Consent Log Viewer
 * Upload to: isupportblueeconomy.click/logs-viewer.php
 *
 * IMPORTANT: Change the password below before uploading.
 * Access: https://isupportblueeconomy.click/logs-viewer.php
 */

define('VIEWER_PASSWORD', 'Topclues@2025'); // ← CHANGE THIS

/* ── Auth ──────────────────────────────────────────────── */
session_start();
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if ($_POST['password'] === VIEWER_PASSWORD) {
        $_SESSION['log_auth'] = true;
    } else {
        $error = 'Wrong password.';
    }
}
if (isset($_POST['logout'])) {
    session_destroy();
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}

$authed = !empty($_SESSION['log_auth']);

/* ── Load log ──────────────────────────────────────────── */
$entries = [];
$logFile = __DIR__ . '/logs/consent-log.json';
if ($authed && file_exists($logFile)) {
    $lines = file($logFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach (array_reverse($lines) as $line) {
        $entry = json_decode($line, true);
        if ($entry) $entries[] = $entry;
    }
}
$total = count($entries);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Consent Log — Blue Economy Campaign</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:#f0f4f8;color:#1a2a3a;min-height:100vh;}
.header{background:#04263f;color:#fff;padding:18px 24px;display:flex;
  align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;}
.header h1{font-size:18px;font-weight:800;}
.header small{opacity:.7;font-size:12px;display:block;margin-top:2px;}
.logout{background:rgba(255,255,255,.15);border:none;color:#fff;
  padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;}
.stats{display:flex;gap:16px;padding:20px 24px;flex-wrap:wrap;}
.stat{background:#fff;border-radius:14px;padding:16px 20px;flex:1;min-width:140px;
  box-shadow:0 1px 4px rgba(0,0,0,.08);}
.stat .num{font-size:28px;font-weight:800;color:#04263f;}
.stat .lbl{font-size:12px;color:#567;margin-top:2px;}
.search{padding:0 24px 16px;}
.search input{width:100%;max-width:400px;padding:10px 14px;border-radius:10px;
  border:1.5px solid #d0dde8;font-size:14px;outline:none;}
.table-wrap{overflow-x:auto;padding:0 24px 32px;}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.08);}
th{background:#04263f;color:#dff3fb;font-size:12px;font-weight:700;
  text-align:left;padding:12px 14px;letter-spacing:.04em;white-space:nowrap;}
td{padding:11px 14px;font-size:13px;border-bottom:1px solid #edf2f7;vertical-align:top;}
tr:last-child td{border-bottom:none;}
tr:hover td{background:#f4f9fc;}
.badge{display:inline-block;padding:3px 9px;border-radius:20px;
  font-size:11px;font-weight:700;}
.badge.yes{background:#eafaf1;color:#1a8a4a;}
.ip{font-family:monospace;font-size:12px;color:#567;}
.file{font-size:11px;color:#789;font-family:monospace;}
/* Login */
.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
.login-card{background:#fff;border-radius:18px;padding:36px 32px;max-width:360px;width:100%;
  box-shadow:0 8px 32px rgba(0,0,0,.12);}
.login-card h2{font-size:20px;font-weight:800;color:#04263f;margin-bottom:6px;}
.login-card p{font-size:13px;color:#567;margin-bottom:24px;}
.login-card input{width:100%;padding:12px 14px;border:1.5px solid #d0dde8;
  border-radius:10px;font-size:15px;margin-bottom:12px;outline:none;}
.login-card button{width:100%;background:#04263f;color:#fff;border:none;
  padding:13px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;}
.err{color:#b42828;font-size:13px;margin-bottom:12px;}
</style>
</head>
<body>
<?php if (!$authed): ?>
<div class="login-wrap">
  <div class="login-card">
    <h2>🔒 Consent Log Viewer</h2>
    <p>Blue Economy Campaign — Gujarat Fisheries</p>
    <?php if ($error): ?><p class="err"><?= htmlspecialchars($error) ?></p><?php endif; ?>
    <form method="POST">
      <input type="password" name="password" placeholder="Enter password" autofocus>
      <button type="submit">View logs</button>
    </form>
  </div>
</div>
<?php else: ?>

<?php
// Quick stats
$devices  = array_count_values(array_column($entries, 'device'));
$browsers = array_count_values(array_column($entries, 'browser'));
arsort($devices); arsort($browsers);
$topDevice  = $devices  ? array_key_first($devices)  . ' (' . reset($devices)  . ')' : '—';
$topBrowser = $browsers ? array_key_first($browsers) . ' (' . reset($browsers) . ')' : '—';
?>

<div class="header">
  <div>
    <h1>Consent Log — I Support Blue Economy</h1>
    <small>Gujarat Fisheries Campaign</small>
  </div>
  <form method="POST">
    <button class="logout" name="logout" value="1">Log out</button>
  </form>
</div>

<div class="stats">
  <div class="stat"><div class="num"><?= $total ?></div><div class="lbl">Total consents</div></div>
  <div class="stat"><div class="num"><?= $total > 0 ? date('d M', strtotime($entries[0]['datetime'])) : '—' ?></div><div class="lbl">Latest entry</div></div>
  <div class="stat"><div class="num" style="font-size:16px"><?= $topDevice ?></div><div class="lbl">Top device</div></div>
  <div class="stat"><div class="num" style="font-size:16px"><?= $topBrowser ?></div><div class="lbl">Top browser</div></div>
</div>

<div class="search">
  <input type="text" id="searchBox" placeholder="Search by IP, device, date…" oninput="filterRows()">
</div>

<div class="table-wrap">
  <table id="logTable">
    <thead>
      <tr>
        <th>#</th>
        <th>Date &amp; Time</th>
        <th>Consent</th>
        <th>Device</th>
        <th>Browser</th>
        <th>Language</th>
        <th>IP</th>
        <th>File</th>
        <th>Size</th>
      </tr>
    </thead>
    <tbody>
    <?php foreach ($entries as $i => $e): ?>
      <tr>
        <td><?= $total - $i ?></td>
        <td><?= htmlspecialchars($e['datetime'] ?? '') ?></td>
        <td><span class="badge yes">✓ Given</span></td>
        <td><?= htmlspecialchars($e['device'] ?? '—') ?></td>
        <td><?= htmlspecialchars($e['browser'] ?? '—') ?></td>
        <td><?= htmlspecialchars(substr($e['language'] ?? '—', 0, 8)) ?></td>
        <td class="ip"><?= htmlspecialchars($e['ip'] ?? '—') ?></td>
        <td class="file"><?= htmlspecialchars($e['id'] ?? '—') ?></td>
        <td><?= htmlspecialchars(($e['file_size_kb'] ?? '—') . ' KB') ?></td>
      </tr>
    <?php endforeach; ?>
    <?php if (!$entries): ?>
      <tr><td colspan="9" style="text-align:center;padding:32px;color:#789;">No entries yet.</td></tr>
    <?php endif; ?>
    </tbody>
  </table>
</div>

<script>
function filterRows(){
  const q = document.getElementById('searchBox').value.toLowerCase();
  document.querySelectorAll('#logTable tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}
</script>
<?php endif; ?>
</body>
</html>
