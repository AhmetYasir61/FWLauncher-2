<?php
// report_tamper.php — Launcher bütünlük ihlali raporu → otomatik kara liste.
// Launcher (IntegrityGuard) tamper tespit edince çağırır: {username, hwid, reason}.
// Sonuç: kullanıcı + HWID kalıcı olarak pw_bans'e eklenir (owner/ghost kaldırana dek).
//
// NOT: Bu client raporudur; sahte rapor gönderilebilir (kullanıcı kendini banlatabilir ama başkasını
// banlatmak için o kullanıcının token'ı gerekmez — bu yüzden username güvenilmez, HWID esas alınır).
// Kötüye kullanım (başkasını banlatma) HWID kendi cihazı olduğu için sınırlıdır.

require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$username = strtolower(trim($d['username'] ?? ''));
$hwid     = trim($d['hwid'] ?? '');
$reason   = 'Launcher bütünlük ihlali: ' . trim($d['reason'] ?? 'bilinmeyen');

if ($hwid === '' && $username === '') pw_json(['success' => false]);

mysqli_query($link, "CREATE TABLE IF NOT EXISTS pw_bans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32), hwid VARCHAR(64), reason VARCHAR(255) DEFAULT '',
    by_admin VARCHAR(32) DEFAULT '', until BIGINT DEFAULT 0, created_at BIGINT DEFAULT 0,
    INDEX(username), INDEX(hwid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$u = mysqli_real_escape_string($link, $username);
$h = mysqli_real_escape_string($link, $hwid);
$r = mysqli_real_escape_string($link, $reason);
$now = round(microtime(true) * 1000);

// zaten banlı mı? (spam önle)
$exists = false;
$chk = mysqli_query($link, "SELECT 1 FROM pw_bans WHERE (username='$u' OR (hwid<>'' AND hwid='$h')) AND until=0 LIMIT 1");
if ($chk && mysqli_num_rows($chk) > 0) $exists = true;

if (!$exists) {
    mysqli_query($link, "INSERT INTO pw_bans (username, hwid, reason, by_admin, until, created_at)
        VALUES ('$u','$h','$r','auto-integrity',0,$now)");
}

pw_json(['success' => true]);
