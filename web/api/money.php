<?php
// money.php — Coin bakiyesi & transfer (Essentials /money, /balance, /pay muadili).
// Mod çağırır (key + player). Coin = authme.coins (tek para birimi — Essentials'ın kendi ekonomisi DEĞİL).
//
// action:
//   balance {target?}          → bakiye (target verilmezse kendi)
//   pay     {to, amount}       → oyuncuya coin gönder (bakiye kadar)
//   top                        → en zengin 10 oyuncu (/balancetop)
//   set     {target, amount}   → (admin) bakiye ayarla — mod OP kontrolüyle çağırır (isAdmin=1)
//   give    {target, amount}   → (admin) coin ekle
//   take    {target, amount}   → (admin) coin al

require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');
$player = strtolower(trim($d['player'] ?? ''));
$action = strtolower(trim($d['action'] ?? 'balance'));
$isAdmin = !empty($d['isAdmin']);   // mod OP-kontrolüyle set eder

function coins_get($link, $user) {
    $u = mysqli_real_escape_string($link, strtolower($user));
    $r = mysqli_query($link, "SELECT coins FROM authme WHERE LOWER(username)='$u' LIMIT 1");
    return ($r && ($row = mysqli_fetch_assoc($r))) ? (int)$row['coins'] : null;   // null = oyuncu yok
}
function coins_add($link, $user, $delta) {
    $u = mysqli_real_escape_string($link, strtolower($user));
    return mysqli_query($link, "UPDATE authme SET coins = coins + ($delta) WHERE LOWER(username)='$u'");
}
function coins_set($link, $user, $val) {
    $u = mysqli_real_escape_string($link, strtolower($user));
    $val = (int)$val;
    return mysqli_query($link, "UPDATE authme SET coins = $val WHERE LOWER(username)='$u'");
}

if ($action === 'balance') {
    $target = strtolower(trim($d['target'] ?? $player));
    $bal = coins_get($link, $target);
    if ($bal === null) pw_fail('Oyuncu bulunamadı.');
    pw_json(['success' => true, 'target' => $target, 'coins' => $bal]);
}

if ($action === 'top') {
    $rows = [];
    $res = mysqli_query($link, "SELECT realname, coins FROM authme ORDER BY coins DESC LIMIT 10");
    while ($res && ($r = mysqli_fetch_assoc($res))) $rows[] = ['name' => $r['realname'], 'coins' => (int)$r['coins']];
    pw_json(['success' => true, 'top' => $rows]);
}

if ($action === 'pay') {
    $to     = strtolower(trim($d['to'] ?? ''));
    $amount = (int)($d['amount'] ?? 0);
    if ($to === '' || $to === $player) pw_fail('Geçersiz hedef.');
    if ($amount <= 0) pw_fail('Miktar pozitif olmalı.');
    $mine = coins_get($link, $player);
    if ($mine === null) pw_fail('Bakiyen okunamadı.');
    if (coins_get($link, $to) === null) pw_fail('Hedef oyuncu yok.');
    if ($mine < $amount) pw_fail('Yeterli coin yok.');

    mysqli_query($link, "START TRANSACTION");
    $a = coins_add($link, $player, -$amount);
    $b = coins_add($link, $to, $amount);
    if ($a && $b) { mysqli_query($link, "COMMIT"); pw_json(['success' => true, 'message' => "$amount coin gönderildi → $to", 'coins' => coins_get($link, $player)]); }
    else { mysqli_query($link, "ROLLBACK"); pw_fail('Transfer başarısız.'); }
}

// --- admin işlemleri (mod OP kontrolüyle isAdmin=1 yollar) ---
if (in_array($action, ['set', 'give', 'take'], true)) {
    if (!$isAdmin) pw_fail('Yetki yok.');
    $target = strtolower(trim($d['target'] ?? ''));
    $amount = (int)($d['amount'] ?? 0);
    if ($target === '' || coins_get($link, $target) === null) pw_fail('Hedef oyuncu yok.');
    if ($action === 'set')  coins_set($link, $target, $amount);
    if ($action === 'give') coins_add($link, $target, abs($amount));
    if ($action === 'take') coins_add($link, $target, -abs($amount));
    pw_json(['success' => true, 'message' => "İşlem tamam: $target", 'coins' => coins_get($link, $target)]);
}

pw_fail('Bilinmeyen işlem.');
