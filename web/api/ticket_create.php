<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');

$subject = trim($d['subject'] ?? '');
$msg     = trim($d['message'] ?? '');
if ($subject === '') pw_fail('Konu gerekli.');
if ($msg === '')     pw_fail('Mesaj gerekli.');
if (mb_strlen($subject) > 140) $subject = mb_substr($subject, 0, 140);

$pl = strtolower($u['username']); $pn = $u['username']; $role = $u['role'];
$now = (string) round(microtime(true) * 1000);

$st = mysqli_prepare($link,
  "INSERT INTO pw_tickets (player,player_name,subject,status,created_at,updated_at)
   VALUES (?,?,?,'open',?,?)");
if (!$st) pw_fail('SQL: ' . mysqli_error($link));
mysqli_stmt_bind_param($st, "sssss", $pl, $pn, $subject, $now, $now);
if (!mysqli_stmt_execute($st)) pw_fail('Ticket oluşturulamadı: ' . mysqli_stmt_error($st));
$tid = mysqli_insert_id($link);
mysqli_stmt_close($st);

$m = mysqli_prepare($link,
  "INSERT INTO pw_ticket_messages (ticket_id,sender,sender_name,sender_role,body,created_at)
   VALUES (?,?,?,?,?,?)");
mysqli_stmt_bind_param($m, "isssss", $tid, $pl, $pn, $role, $msg, $now);
mysqli_stmt_execute($m);
mysqli_stmt_close($m);

pw_json(['success' => true, 'id' => $tid, 'message' => 'Ticket açıldı.']);
