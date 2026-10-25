<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');
if (!in_array($u['role'], ['owner','admin'], true)) pw_fail('Yalnız owner/admin uyarabilir.');

$target  = strtolower(trim($d['target'] ?? ''));
$minutes = (int)($d['minutes'] ?? 0);
$reason  = trim($d['reason'] ?? '');
if ($target === '') pw_fail('Hedef gerekli.');
if ($minutes <= 0) pw_fail('Süre 0\'dan büyük olmalı.');
if ($target === strtolower($u['username'])) pw_fail('Kendini uyaramazsın.');
if (mb_strlen($reason) > 255) $reason = mb_substr($reason, 0, 255);

$now = (int) round(microtime(true) * 1000);
$until = $now + $minutes * 60000;
$by = $u['username'];

$st = mysqli_prepare($link,
  "INSERT INTO pw_moderation (username, banned, warn_until, reason, updated_by, updated_at)
   VALUES (?,0,?,?,?,?)
   ON DUPLICATE KEY UPDATE warn_until=VALUES(warn_until), reason=VALUES(reason),
                           updated_by=VALUES(updated_by), updated_at=VALUES(updated_at)");
$us = (string)$until; $ts = (string)$now;
mysqli_stmt_bind_param($st, "sssss", $target, $us, $reason, $by, $ts);
if (!mysqli_stmt_execute($st)) pw_fail('Uyarı verilemedi: ' . mysqli_stmt_error($st));
mysqli_stmt_close($st);

pw_json(['success' => true, 'message' => 'Kullanıcı uyarıldı ve launcher\'ı kilitlendi.']);
