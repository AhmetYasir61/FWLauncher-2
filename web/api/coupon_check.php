<?php
// Sepette kupon doğrulama — giriş yapmış kullanıcı. { code } → { valid, percent }
require_once "pw_common.php";
require_once "config.php";
require_once "coin_packages.php";   // pw_coupon_lookup

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');

$code = (string)($d['code'] ?? '');
$r = pw_coupon_lookup($link, $code);
if (isset($r['error'])) pw_json(['success' => true, 'valid' => false, 'message' => $r['error']]);

pw_json(['success' => true, 'valid' => true, 'code' => $code, 'percent' => (int)$r['percent']]);
