<?php
// Kupon yönetimi — SADECE admin/owner (site admin paneli).
// action: list | save {code, percent, maxUses, active} | delete {code}
require_once "pw_common.php";
require_once "config.php";
require_once "coin_packages.php";   // pw_ensure_coupons_table

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u || !pw_is_admin($u)) pw_fail('Yetkisiz.');

pw_ensure_coupons_table($link);
$action = strtolower(trim($d['action'] ?? 'list'));

if ($action === 'save') {
    $code = strtoupper(preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)($d['code'] ?? '')));
    $percent = (int)($d['percent'] ?? 0);
    $maxUses = max(0, (int)($d['maxUses'] ?? 0));
    $active = !empty($d['active']) ? 1 : 0;
    if ($code === '' || strlen($code) > 32) pw_fail('Geçerli bir kupon kodu gir (harf/rakam).');
    if ($percent < 1 || $percent > 100) pw_fail('İndirim yüzdesi 1-100 arası olmalı.');
    $now = round(microtime(true) * 1000);
    $st = mysqli_prepare($link, "
        INSERT INTO pw_coupons (code, percent, max_uses, active, created_at) VALUES (?,?,?,?,?)
        ON DUPLICATE KEY UPDATE percent=VALUES(percent), max_uses=VALUES(max_uses), active=VALUES(active)");
    mysqli_stmt_bind_param($st, "siiii", $code, $percent, $maxUses, $active, $now);
    if (!mysqli_stmt_execute($st)) pw_fail('Kaydedilemedi: ' . mysqli_stmt_error($st));
    mysqli_stmt_close($st);
}

if ($action === 'delete') {
    $code = strtoupper(preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)($d['code'] ?? '')));
    if ($code === '') pw_fail('Kupon kodu gerekli.');
    $st = mysqli_prepare($link, "DELETE FROM pw_coupons WHERE code = ?");
    mysqli_stmt_bind_param($st, "s", $code);
    mysqli_stmt_execute($st);
    mysqli_stmt_close($st);
}

// list (save/delete sonrasında da güncel liste döner)
$out = [];
$res = mysqli_query($link, "SELECT code, percent, max_uses, used, active FROM pw_coupons ORDER BY created_at DESC LIMIT 100");
while ($res && ($r = mysqli_fetch_assoc($res))) {
    $out[] = ['code' => $r['code'], 'percent' => (int)$r['percent'], 'maxUses' => (int)$r['max_uses'],
              'used' => (int)$r['used'], 'active' => (int)$r['active'] === 1];
}
pw_json(['success' => true, 'coupons' => $out]);
