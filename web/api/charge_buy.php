<?php
// Şarj istasyonu: coin karşılığı telefon şarjı (1 coin = 1 şarj puanı).
// Mod sunucusu çağırır: {key, player, amount}
require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');

$player = strtolower(trim($d['player'] ?? ''));
$amount = (int)($d['amount'] ?? 0);
if ($player === '' || $amount <= 0 || $amount > 1000) pw_fail('Geçersiz istek.');

// oyuncu + coin
$st = mysqli_prepare($link, "SELECT id, coins FROM authme WHERE username=? LIMIT 1");
mysqli_stmt_bind_param($st, "s", $player);
mysqli_stmt_execute($st);
mysqli_stmt_store_result($st);
if (mysqli_stmt_num_rows($st) != 1) { mysqli_stmt_close($st); pw_fail('Oyuncu bulunamadı.'); }
mysqli_stmt_bind_result($st, $uid, $coins);
mysqli_stmt_fetch($st);
mysqli_stmt_close($st);
$coins = (int)$coins;

if ($coins < $amount)
    pw_json(['success' => false, 'message' => "Yetersiz coin ({$amount} gerekli).", 'coins' => $coins]);

$new = $coins - $amount;
$u = mysqli_prepare($link, "UPDATE authme SET coins=? WHERE id=? AND coins=?");
mysqli_stmt_bind_param($u, "iii", $new, $uid, $coins);
mysqli_stmt_execute($u);
$ok = mysqli_stmt_affected_rows($u) === 1;   // atomik: coins değiştiyse tekrar dene sayılır
mysqli_stmt_close($u);

if (!$ok) pw_json(['success' => false, 'message' => 'İşlem çakıştı, tekrar dene.', 'coins' => $coins]);
pw_json(['success' => true, 'coins' => $new, 'charge' => $amount]);
