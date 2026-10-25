<?php
require_once "pw_common.php";
require_once "config.php";

// Giriş yapan kullanıcının kendi moderasyon durumu (launcher başlangıçta + periyodik sorar).
$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');

$me = mysqli_real_escape_string($link, strtolower($u['username']));
$now = (int) round(microtime(true) * 1000);

$banned = false; $remaining = 0; $reason = '';
$res = mysqli_query($link, "SELECT banned, warn_until, reason FROM pw_moderation WHERE username='$me' LIMIT 1");
if ($res && ($r = mysqli_fetch_assoc($res))) {
    $banned = ((int)$r['banned'] === 1);
    $wu = (int)$r['warn_until'];
    $remaining = $wu > $now ? ($wu - $now) : 0;
    $reason = $r['reason'] ?? '';
}

pw_json([
    'success'     => true,
    'banned'      => $banned,
    'remainingMs' => $remaining,   // > 0 ise uyarı kilidi aktif
    'reason'      => $reason,
]);
