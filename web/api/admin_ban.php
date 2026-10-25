<?php
// admin_ban.php — Kara liste (perma-ban) yönetimi. Mod (key ile) + Launcher kontrol paneli (admin token) kullanır.
// pw_bans tablosu mc_auth.php ile ORTAK (giriş anında kontrol edilir).
//
// action:
//   ban   {target, hwid?, reason, byAdmin}  → kalıcı ban (username + varsa HWID)
//   unban {target}                          → banı kaldır (owner/ghost yetkisi — mod tarafında sınırlı)
//   list                                    → aktif banlar
//
// Yetki: key (mod, OP/ghost kontrolü mod'da) VEYA username+token (launcher, admin).

require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

$d = pw_body();

// yetki: mod key VEYA launcher admin token
$authed = false;
if (isset($d['key']) && hash_equals($DEPO_KEY, (string)$d['key'])) {
    $authed = true;   // mod (yetkiyi mod tarafı OP4/ghost ile zaten sınırladı)
} else {
    $user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
    if ($user && pw_is_admin($user)) $authed = true;
}
if (!$authed) pw_fail('Yetkisiz.');

mysqli_query($link, "CREATE TABLE IF NOT EXISTS pw_bans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32),
    hwid VARCHAR(64),
    reason VARCHAR(255) DEFAULT '',
    by_admin VARCHAR(32) DEFAULT '',
    until BIGINT DEFAULT 0,
    created_at BIGINT DEFAULT 0,
    INDEX(username), INDEX(hwid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$action = strtolower(trim($d['action'] ?? 'list'));

if ($action === 'ban') {
    $target = strtolower(trim($d['target'] ?? ''));
    $hwid   = trim($d['hwid'] ?? '');
    $reason = trim($d['reason'] ?? 'Kural ihlali');
    $by     = trim($d['byAdmin'] ?? 'system');
    if ($target === '') pw_fail('Hedef gerekli.');
    $t = mysqli_real_escape_string($link, $target);
    $h = mysqli_real_escape_string($link, $hwid);
    $r = mysqli_real_escape_string($link, $reason);
    $ba = mysqli_real_escape_string($link, $by);
    $now = round(microtime(true) * 1000);
    // aynı kullanıcı için eski aktif banı temizle, yenisini ekle (until=0 = kalıcı)
    mysqli_query($link, "DELETE FROM pw_bans WHERE username='$t'");
    $ok = mysqli_query($link, "INSERT INTO pw_bans (username, hwid, reason, by_admin, until, created_at)
          VALUES ('$t','$h','$r','$ba',0,$now)");
    if (!$ok) pw_fail('Ban yazılamadı: ' . mysqli_error($link));
    pw_json(['success' => true, 'message' => "$target kalıcı olarak yasaklandı."]);
}

if ($action === 'unban') {
    $target = strtolower(trim($d['target'] ?? ''));
    if ($target === '') pw_fail('Hedef gerekli.');
    $t = mysqli_real_escape_string($link, $target);
    mysqli_query($link, "DELETE FROM pw_bans WHERE username='$t'");
    pw_json(['success' => true, 'message' => "$target yasağı kaldırıldı."]);
}

if ($action === 'list') {
    $rows = [];
    $res = mysqli_query($link, "SELECT username, hwid, reason, by_admin, created_at
                                FROM pw_bans WHERE until=0 OR until>" . round(microtime(true)*1000) . "
                                ORDER BY id DESC LIMIT 300");
    while ($res && ($r = mysqli_fetch_assoc($res))) {
        $rows[] = ['username' => $r['username'], 'reason' => $r['reason'],
                   'byAdmin' => $r['by_admin'], 'hasHwid' => ($r['hwid'] !== '')];
    }
    pw_json(['success' => true, 'bans' => $rows]);
}

pw_fail('Bilinmeyen işlem.');
