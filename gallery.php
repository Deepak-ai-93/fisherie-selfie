<?php
/**
 * gallery.php — Marketing Team Photo Gallery
 * isupportblueeconomy.click/gallery.php
 *
 * SETUP:
 *  1. Upload this file to the domain root
 *  2. Change the password below before uploading
 *  3. Share the URL + password with your team — nothing else
 *
 * Team accesses: https://isupportblueeconomy.click/gallery.php
 * They see: all selfies in a grid, download button, total count
 * They cannot: access server, see logs, touch any other file
 */

define('GALLERY_PASSWORD', 'BlueEconomy@Fisheries2025'); // ← CHANGE THIS

/* ── Rate limiting — max 10 wrong attempts per IP per hour ── */
session_start();
$ip          = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '')[0]);
$attemptKey  = 'attempts_' . md5($ip);
$lockKey     = 'locked_' . md5($ip);

if (!isset($_SESSION[$attemptKey])) $_SESSION[$attemptKey] = 0;
if (!isset($_SESSION[$lockKey]))    $_SESSION[$lockKey]    = 0;

$locked = $_SESSION[$lockKey] > time();
$error  = '';

/* ── Logout ─────────────────────────────────────────────── */
if (isset($_POST['logout'])) {
    session_destroy();
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}

/* ── Login ──────────────────────────────────────────────── */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password']) && !$locked) {
    if ($_POST['password'] === GALLERY_PASSWORD) {
        $_SESSION['gallery_auth'] = true;
        $_SESSION[$attemptKey]    = 0;
    } else {
        $_SESSION[$attemptKey]++;
        if ($_SESSION[$attemptKey] >= 10) {
            $_SESSION[$lockKey] = time() + 3600; // lock for 1 hour
            $error = 'Too many wrong attempts. Try again in 1 hour.';
        } else {
            $remaining = 10 - $_SESSION[$attemptKey];
            $error = 'Wrong password. ' . $remaining . ' attempt' . ($remaining !== 1 ? 's' : '') . ' remaining.';
        }
    }
}

if ($locked && empty($_SESSION['gallery_auth'])) {
    $error = 'Too many wrong attempts. Try again later.';
}

$authed = !empty($_SESSION['gallery_auth']);

/* ── Load photos ─────────────────────────────────────────── */
$photos = [];
if ($authed) {
    $uploadDir = __DIR__ . '/uploads';
    if (is_dir($uploadDir)) {
        $files = glob($uploadDir . '/selfie_*.png');
        if ($files) {
            rsort($files); // newest first
            foreach ($files as $f) {
                $name = basename($f);
                // parse date from filename: selfie_YYYYMMDD_HHiiss_uid.png
                preg_match('/selfie_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_(\w+)\.png/', $name, $m);
                $date = isset($m[1])
                    ? $m[3].'/'.$m[2].'/'.$m[1].' '.$m[4].':'.$m[5].':'.$m[6]
                    : date('d/m/Y H:i', filemtime($f));
                $photos[] = [
                    'name' => $name,
                    'url'  => 'uploads/' . $name,
                    'date' => $date,
                    'size' => round(filesize($f) / 1024) . ' KB',
                ];
            }
        }
    }
}

$total = count($photos);

// Pagination
$perPage = 24;
$page    = max(1, (int)($_GET['page'] ?? 1));
$totalPages = max(1, (int)ceil($total / $perPage));
$page    = min($page, $totalPages);
$slice   = array_slice($photos, ($page - 1) * $perPage, $perPage);
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Campaign Gallery — I Support Blue Economy</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:#f0f4f8;color:#1a2a3a;min-height:100vh;}

/* Header */
.header{
  background:#04263f;color:#fff;
  padding:16px 24px;
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;
  position:sticky;top:0;z-index:10;box-shadow:0 2px 12px rgba(0,0,0,.3);
}
.header-left h1{font-size:17px;font-weight:800;}
.header-left small{font-size:11px;opacity:.65;display:block;margin-top:1px;}
.header-right{display:flex;align-items:center;gap:10px;}
.badge-count{
  background:rgba(255,255,255,.15);color:#fff;
  font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px;
}
form.logout-form button{
  background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
  color:#fff;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;
}

/* Stats bar */
.stats{
  display:flex;gap:14px;padding:18px 24px 0;flex-wrap:wrap;
}
.stat{
  background:#fff;border-radius:12px;padding:14px 18px;flex:1;min-width:120px;
  box-shadow:0 1px 4px rgba(0,0,0,.07);
}
.stat .num{font-size:26px;font-weight:800;color:#04263f;}
.stat .lbl{font-size:11px;color:#789;margin-top:2px;}

/* Search + filter */
.toolbar{padding:14px 24px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
.toolbar input{
  flex:1;min-width:200px;max-width:380px;padding:10px 14px;
  border:1.5px solid #d0dde8;border-radius:10px;font-size:14px;outline:none;
  background:#fff;
}
.toolbar input:focus{border-color:#1b8fc4;}
.dl-all{
  background:#04263f;color:#fff;border:none;padding:10px 18px;
  border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;
  display:inline-flex;align-items:center;gap:6px;
}

/* Grid */
.grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(160px,1fr));
  gap:14px;padding:0 24px 24px;
}
.card{
  background:#fff;border-radius:14px;overflow:hidden;
  box-shadow:0 1px 6px rgba(0,0,0,.08);transition:transform .15s,box-shadow .15s;
  cursor:pointer;
}
.card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.13);}
.card img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;background:#e8f2f8;}
.card-info{padding:8px 10px 10px;}
.card-date{font-size:10px;color:#789;font-weight:600;}
.card-size{font-size:10px;color:#aab;margin-top:1px;}
.card-dl{
  display:block;width:100%;margin-top:6px;background:#eaf4fb;color:#04263f;
  border:none;border-radius:7px;padding:6px;font-size:11px;font-weight:700;
  cursor:pointer;text-align:center;text-decoration:none;
}
.card-dl:hover{background:#1b8fc4;color:#fff;}

/* Lightbox */
#lightbox{
  display:none;position:fixed;inset:0;z-index:100;
  background:rgba(2,14,26,.92);align-items:center;justify-content:center;flex-direction:column;
}
#lightbox.show{display:flex;}
#lightbox img{max-width:92vw;max-height:80vh;border-radius:12px;object-fit:contain;}
#lightbox .lb-bar{
  display:flex;align-items:center;gap:12px;margin-top:14px;
}
#lightbox .lb-bar a{
  background:#1b8fc4;color:#fff;border:none;padding:10px 20px;border-radius:10px;
  font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;
}
#lightbox .lb-close{
  position:absolute;top:16px;right:16px;background:rgba(255,255,255,.15);
  border:none;color:#fff;font-size:22px;width:40px;height:40px;
  border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;
}
#lb-date{color:#aac;font-size:12px;margin-top:6px;}

/* Pagination */
.pages{display:flex;justify-content:center;gap:8px;padding:0 24px 28px;flex-wrap:wrap;}
.pages a,.pages span{
  padding:8px 14px;border-radius:9px;font-size:13px;font-weight:700;text-decoration:none;
}
.pages a{background:#fff;color:#04263f;box-shadow:0 1px 4px rgba(0,0,0,.08);}
.pages a:hover{background:#04263f;color:#fff;}
.pages span{background:#04263f;color:#fff;}

/* Empty */
.empty{text-align:center;padding:60px 24px;color:#789;}
.empty svg{opacity:.3;margin-bottom:12px;}

/* Login */
.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
.login-card{
  background:#fff;border-radius:18px;padding:36px 30px;
  max-width:360px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,.1);
}
.login-logo{width:90px;height:auto;margin-bottom:16px;}
.login-card h2{font-size:20px;font-weight:800;color:#04263f;margin-bottom:4px;}
.login-card p{font-size:13px;color:#789;margin-bottom:20px;line-height:1.5;}
.login-card input{
  width:100%;padding:12px 14px;border:1.5px solid #d0dde8;
  border-radius:10px;font-size:15px;margin-bottom:12px;outline:none;
}
.login-card input:focus{border-color:#1b8fc4;}
.login-card button[type=submit]{
  width:100%;background:#04263f;color:#fff;border:none;
  padding:13px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;
}
.login-card button:hover{background:#0a4d72;}
.err{background:#fdecea;color:#b42828;font-size:13px;padding:10px 12px;
  border-radius:8px;margin-bottom:12px;font-weight:600;}
.locked-msg{background:#fff3cd;color:#856404;font-size:13px;padding:10px 12px;
  border-radius:8px;margin-bottom:12px;font-weight:600;}

@media(max-width:480px){
  .grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;padding:0 14px 24px;}
  .stats,.toolbar{padding-left:14px;padding-right:14px;}
  .header{padding:14px 16px;}
}
</style>
</head>
<body>

<?php if (!$authed): ?>
<!-- ── Login screen ─────────────────────────────────── -->
<div class="login-wrap">
  <div class="login-card">
    <img class="login-logo"
         src="https://isupportblueeconomy.click/fisheries.svg"
         alt="Gujarat Fisheries"
         onerror="this.style.display='none'">
    <h2>Campaign Gallery</h2>
    <p>I Support Blue Economy — Gujarat Fisheries.<br>Marketing team access only.</p>
    <?php if ($locked): ?>
      <div class="locked-msg">🔒 Account locked. Try again in 1 hour.</div>
    <?php elseif ($error): ?>
      <div class="err"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>
    <?php if (!$locked): ?>
    <form method="POST">
      <input type="password" name="password"
             placeholder="Team password" autofocus autocomplete="current-password">
      <button type="submit">View gallery</button>
    </form>
    <?php endif; ?>
  </div>
</div>

<?php else: ?>
<!-- ── Authenticated gallery ─────────────────────────── -->

<div class="header">
  <div class="header-left">
    <h1>📸 Campaign Gallery</h1>
    <small>I Support Blue Economy — Gujarat Fisheries</small>
  </div>
  <div class="header-right">
    <span class="badge-count"><?= $total ?> photo<?= $total !== 1 ? 's' : '' ?></span>
    <form class="logout-form" method="POST">
      <button name="logout" value="1">Log out</button>
    </form>
  </div>
</div>

<?php
// Stats
$today     = 0; $thisWeek = 0;
$totalSize = 0;
$now       = time();
foreach($photos as $p){
    $uploadDir = __DIR__ . '/uploads';
    $mt = filemtime($uploadDir . '/' . $p['name']);
    if(date('Y-m-d',$mt) === date('Y-m-d')) $today++;
    if(($now - $mt) < 604800) $thisWeek++;
    $totalSize += (int)$p['size'];
}
?>
<div class="stats">
  <div class="stat">
    <div class="num"><?= $total ?></div>
    <div class="lbl">Total selfies</div>
  </div>
  <div class="stat">
    <div class="num"><?= $today ?></div>
    <div class="lbl">Today</div>
  </div>
  <div class="stat">
    <div class="num"><?= $thisWeek ?></div>
    <div class="lbl">This week</div>
  </div>
</div>

<div class="toolbar">
  <input type="text" id="searchBox" placeholder="Search by date or filename…" oninput="filterCards()">
</div>

<?php if ($slice): ?>
<div class="grid" id="photoGrid">
  <?php foreach ($slice as $p): ?>
  <div class="card" data-search="<?= htmlspecialchars($p['date'] . ' ' . $p['name']) ?>">
    <img src="<?= htmlspecialchars($p['url']) ?>"
         alt="Selfie"
         loading="lazy"
         onclick="openLightbox('<?= htmlspecialchars($p['url']) ?>','<?= htmlspecialchars($p['date']) ?>','<?= htmlspecialchars($p['name']) ?>')">
    <div class="card-info">
      <div class="card-date"><?= htmlspecialchars($p['date']) ?></div>
      <div class="card-size"><?= htmlspecialchars($p['size']) ?></div>
      <a class="card-dl"
         href="<?= htmlspecialchars($p['url']) ?>"
         download="<?= htmlspecialchars($p['name']) ?>">
        ↓ Download
      </a>
    </div>
  </div>
  <?php endforeach; ?>
</div>

<?php if ($totalPages > 1): ?>
<div class="pages">
  <?php if ($page > 1): ?>
    <a href="?page=<?= $page-1 ?>">← Prev</a>
  <?php endif; ?>
  <?php for($i=max(1,$page-2); $i<=min($totalPages,$page+2); $i++): ?>
    <?php if($i===$page): ?>
      <span><?= $i ?></span>
    <?php else: ?>
      <a href="?page=<?= $i ?>"><?= $i ?></a>
    <?php endif; ?>
  <?php endfor; ?>
  <?php if ($page < $totalPages): ?>
    <a href="?page=<?= $page+1 ?>">Next →</a>
  <?php endif; ?>
</div>
<?php endif; ?>

<?php else: ?>
<div class="empty">
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#789"
       stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <path d="M21 15l-5-5L5 21"/>
  </svg>
  <p>No photos yet. They'll appear here once people use the filter.</p>
</div>
<?php endif; ?>

<!-- Lightbox -->
<div id="lightbox" onclick="if(event.target===this)closeLightbox()">
  <button class="lb-close" onclick="closeLightbox()">✕</button>
  <img id="lb-img" src="" alt="Selfie">
  <div id="lb-date"></div>
  <div class="lb-bar">
    <a id="lb-dl" href="#" download>↓ Download</a>
  </div>
</div>

<script>
function openLightbox(url, date, name){
  document.getElementById('lb-img').src = url;
  document.getElementById('lb-date').textContent = date;
  document.getElementById('lb-dl').href = url;
  document.getElementById('lb-dl').download = name;
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox(){
  document.getElementById('lightbox').classList.remove('show');
  document.getElementById('lb-img').src = '';
}
document.addEventListener('keydown', e => { if(e.key==='Escape') closeLightbox(); });

function filterCards(){
  const q = document.getElementById('searchBox').value.toLowerCase();
  document.querySelectorAll('#photoGrid .card').forEach(c => {
    c.style.display = c.dataset.search.toLowerCase().includes(q) ? '' : 'none';
  });
}
</script>
<?php endif; ?>

</body>
</html>
