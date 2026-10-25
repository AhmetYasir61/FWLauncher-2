<?php
// Yönetim paneli gerçek istatistikleri (admin/owner).
require_once "pw_common.php";
require_once "config.php";
require_once "coin_packages.php";   // pw_ensure_payments_table + pw_price_label

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u || !pw_is_admin($u)) pw_fail('Yetkisiz.');

pw_ensure_payments_table($link);

$now      = round(microtime(true) * 1000);
$dayAgo   = $now - 86400000;
$startDay = strtotime('today 00:00:00') * 1000;

$total = 0;
if ($r = mysqli_query($link, "SELECT COUNT(*) AS n FROM authme")) { $total = (int)mysqli_fetch_assoc($r)['n']; }

$new24 = 0;
if ($r = mysqli_query($link, "SELECT COUNT(*) AS n FROM authme WHERE CAST(regdate AS UNSIGNED) > $dayAgo")) { $new24 = (int)mysqli_fetch_assoc($r)['n']; }

$rev = 0;
if ($r = mysqli_query($link, "SELECT COALESCE(SUM(amount),0) AS s FROM pw_payments WHERE status='paid' AND paid_at >= $startDay")) { $rev = (int)mysqli_fetch_assoc($r)['s']; }

pw_json([
    'success'       => true,
    'totalPlayers'  => $total,
    'newMembers24h' => $new24,
    'revenueToday'  => $rev,               // kuruş
    'revenueLabel'  => pw_price_label($rev),
]);
