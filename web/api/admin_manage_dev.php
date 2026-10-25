<?php
// admin_manage_dev.php — Launcher'dan dev/owner yetki yönetimi.
// Admin/owner kullanıcılar oyunculara 'dev' veya 'owner' rütbesi verir/alır (pw_devs tablosu).
// action: 'list' | 'set' | 'remove'
//   set:    {username, targetUser, role}  role = 'dev'|'owner'
//   remove: {username, targetUser}
//   list:   {username}  → tüm dev/owner listesi

require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!pw_is_admin($user)) pw_fail('Bu işlem için yetkin yok (yalnız admin/owner).');

// pw_devs tablosu yoksa oluştur (idempotent)
mysqli_query($link, "CREATE TABLE IF NOT EXISTS pw_devs (
    username VARCHAR(32) PRIMARY KEY,
    role VARCHAR(16) NOT NULL DEFAULT 'dev'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$action = strtolower(trim($d['action'] ?? 'list'));

if ($action === 'list') {
    $rows = [];
    $res = mysqli_query($link, "SELECT username, role FROM pw_devs ORDER BY role DESC, username ASC");
    while ($res && ($r = mysqli_fetch_assoc($res))) $rows[] = ['username' => $r['username'], 'role' => $r['role']];
    pw_json(['success' => true, 'devs' => $rows]);
}

if ($action === 'set') {
    $target = strtolower(trim($d['targetUser'] ?? ''));
    $role   = strtolower(trim($d['role'] ?? 'dev'));
    if ($target === '') pw_fail('Hedef oyuncu gerekli.');
    if ($role !== 'dev' && $role !== 'owner') pw_fail('Rol dev veya owner olmalı.');
    $t = mysqli_real_escape_string($link, $target);
    $r = mysqli_real_escape_string($link, $role);
    $ok = mysqli_query($link,
        "INSERT INTO pw_devs (username, role) VALUES ('$t', '$r')
         ON DUPLICATE KEY UPDATE role='$r'");
    if (!$ok) pw_fail('Yazılamadı: ' . mysqli_error($link));
    pw_json(['success' => true, 'message' => "$target artık $role."]);
}

if ($action === 'remove') {
    $target = strtolower(trim($d['targetUser'] ?? ''));
    if ($target === '') pw_fail('Hedef oyuncu gerekli.');
    $t = mysqli_real_escape_string($link, $target);
    mysqli_query($link, "DELETE FROM pw_devs WHERE username='$t'");
    pw_json(['success' => true, 'message' => "$target yetkisi kaldırıldı."]);
}

pw_fail('Bilinmeyen işlem.');
