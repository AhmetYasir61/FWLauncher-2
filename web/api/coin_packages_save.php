<?php
// Coin paketlerini kaydet — SADECE admin/owner. İstek: { username, token, packages:[...] }
// packages öğesi: { id, coins, price(kuruş), name, popular, sort }
require_once "pw_common.php";
require_once "config.php";
require_once "coin_packages.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$user) pw_fail('Oturum geçersiz.');
if (!pw_is_admin($user)) pw_fail('Bu işlem için yetkin yok.');

$packages = $d['packages'] ?? null;
if (!is_array($packages)) pw_fail('Geçersiz paket listesi.');

// Doğrula + temizle
$clean = [];
$seen = [];
foreach ($packages as $i => $p) {
    if (!is_array($p)) continue;
    $id = preg_replace('/[^a-zA-Z0-9_]/', '', (string)($p['id'] ?? ''));
    if ($id === '' || isset($seen[$id])) continue;   // boş/çift id atla
    $seen[$id] = true;
    $clean[] = [
        'id'       => substr($id, 0, 32),
        'coins'    => max(0, (int)($p['coins'] ?? 0)),
        'price'    => max(0, (int)($p['price'] ?? 0)),      // kuruş
        'oldPrice' => max(0, (int)($p['oldPrice'] ?? 0)),   // üstü çizili fiyat (kuruş, 0 = yok)
        'name'     => substr(trim((string)($p['name'] ?? $id)), 0, 64),
        'popular'  => !empty($p['popular']) ? 1 : 0,
        'sort'     => (int)($p['sort'] ?? $i),
    ];
}
if (!$clean) pw_fail('En az bir geçerli paket gerekli.');

pw_ensure_coin_table($link);

mysqli_query($link, "START TRANSACTION");
$ok = mysqli_query($link, "DELETE FROM pw_coin_packages");
$stmt = mysqli_prepare($link, "INSERT INTO pw_coin_packages (id,coins,price,old_price,name,popular,sort) VALUES (?,?,?,?,?,?,?)");
foreach ($clean as $p) {
    mysqli_stmt_bind_param($stmt, "siiisii", $p['id'], $p['coins'], $p['price'], $p['oldPrice'], $p['name'], $p['popular'], $p['sort']);
    if (!mysqli_stmt_execute($stmt)) { $ok = false; break; }
}
mysqli_stmt_close($stmt);

if ($ok) { mysqli_query($link, "COMMIT"); pw_json(['success' => true]); }
mysqli_query($link, "ROLLBACK");
pw_fail('Kaydedilemedi: ' . mysqli_error($link));
