<?php
require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

// VC telefon numarası — oyuncunun numarasını döndürür; yoksa benzersiz üretir.
// Mod, oyuncu girişinde çağırır ve numara↔isim eşlemesini bellekte tutar.

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');

$player = strtolower(trim($d['player'] ?? ''));
if ($player === '') pw_fail('Oyuncu gerekli.');

// var olan numara?
$st = mysqli_prepare($link, "SELECT number FROM pw_phone WHERE username=? LIMIT 1");
mysqli_stmt_bind_param($st, "s", $player);
mysqli_stmt_execute($st);
mysqli_stmt_bind_result($st, $num);
$has = mysqli_stmt_fetch($st);
mysqli_stmt_close($st);
if ($has) pw_json(['success' => true, 'number' => $num]);

// benzersiz 7 haneli üret
for ($i = 0; $i < 25; $i++) {
    $cand = (string) mt_rand(5000000, 9999999);
    $c = mysqli_prepare($link, "SELECT 1 FROM pw_phone WHERE number=? LIMIT 1");
    mysqli_stmt_bind_param($c, "s", $cand);
    mysqli_stmt_execute($c);
    mysqli_stmt_store_result($c);
    $exists = mysqli_stmt_num_rows($c) > 0;
    mysqli_stmt_close($c);
    if ($exists) continue;
    $now = (string) round(microtime(true) * 1000);
    $ins = mysqli_prepare($link, "INSERT INTO pw_phone (username, number, created_at) VALUES (?,?,?)");
    mysqli_stmt_bind_param($ins, "sss", $player, $cand, $now);
    $ok = mysqli_stmt_execute($ins);
    mysqli_stmt_close($ins);
    if ($ok) pw_json(['success' => true, 'number' => $cand]);
}
pw_fail('Numara üretilemedi.');
