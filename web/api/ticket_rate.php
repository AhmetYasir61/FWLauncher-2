<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');

$tid   = (int)($d['ticketId'] ?? 0);
$stars = (int)($d['stars'] ?? 0);
if ($tid <= 0) pw_fail('Geçersiz ticket.');
if ($stars < 1 || $stars > 5) pw_fail('Yıldız 1-5 olmalı.');

$tr = mysqli_query($link, "SELECT * FROM pw_tickets WHERE id=$tid LIMIT 1");
$t  = $tr ? mysqli_fetch_assoc($tr) : null;
if (!$t) pw_fail('Ticket bulunamadı.');

$me = strtolower($u['username']);
if ($me !== $t['player']) pw_fail('Sadece ticket sahibi puanlar.');
if ($t['status'] !== 'closed') pw_fail('Önce ticket kapanmalı.');
if ((int)$t['rating'] > 0) pw_fail('Zaten puanladın.');

mysqli_query($link, "UPDATE pw_tickets SET rating=$stars WHERE id=$tid");

// ---- Coin etkisi (Sert): 1=-300, 2=-100, 3=0, 4=+150, 5=+300 ----
$table = [1=>-300, 2=>-100, 3=>0, 4=>150, 5=>300];
$delta = $table[$stars];
$applied = 0;
$staffName = $t['assigned_name'];

if ($t['assigned'] && $delta !== 0) {
    $asg = mysqli_real_escape_string($link, $t['assigned']);
    $rr = mysqli_query($link, "SELECT role FROM authme WHERE username='$asg' LIMIT 1");
    $arole = ($rr && ($row = mysqli_fetch_assoc($rr))) ? strtolower($row['role']) : '';
    // Coin etkisi YALNIZ moderator + rehber (owner/admin muaf)
    if (in_array($arole, ['moderator','rehber'], true)) {
        if ($delta < 0)
            mysqli_query($link, "UPDATE authme SET coins=GREATEST(0,coins+($delta)) WHERE username='$asg'");
        else
            mysqli_query($link, "UPDATE authme SET coins=coins+$delta WHERE username='$asg'");
        $applied = $delta;
        if (function_exists('pw_log'))
            pw_log($link, 'SYSTEM', $t['assigned'], $delta, 'ticket_rating', "#$tid {$stars}*");
    }
}

pw_json([
    'success'   => true,
    'stars'     => $stars,
    'delta'     => $applied,
    'staffName' => $staffName,
    'message'   => 'Puanın için teşekkürler!',
]);
