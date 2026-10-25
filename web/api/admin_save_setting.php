<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!pw_is_admin($user)) pw_fail('Bu işlem için yetkin yok.');

$key = trim($d['key'] ?? '');
$val = trim($d['value'] ?? '');

$allowed = ['discord_url', 'website_url'];
if (!in_array($key, $allowed, true)) pw_fail('Geçersiz ayar anahtarı.');

$stmt = mysqli_prepare($link,
    "INSERT INTO pw_settings (skey, svalue) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)");
if (!$stmt) pw_fail('SQL hazırlanamadı: ' . mysqli_error($link));
mysqli_stmt_bind_param($stmt, "ss", $key, $val);
if (!mysqli_stmt_execute($stmt)) pw_fail('Kaydedilemedi: ' . mysqli_stmt_error($stmt));
mysqli_stmt_close($stmt);

pw_json(['success' => true, 'message' => 'Ayar kaydedildi.']);
