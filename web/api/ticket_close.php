<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');

$tid = (int)($d['ticketId'] ?? 0);
if ($tid <= 0) pw_fail('Geçersiz ticket.');

$tr = mysqli_query($link, "SELECT * FROM pw_tickets WHERE id=$tid LIMIT 1");
$t  = $tr ? mysqli_fetch_assoc($tr) : null;
if (!$t) pw_fail('Ticket bulunamadı.');
if ($t['status'] === 'closed') pw_fail('Zaten kapalı.');

$me = strtolower($u['username']);
$isAdmin = in_array($u['role'], ['owner','admin'], true);
if (!($isAdmin || $t['assigned'] === $me)) pw_fail('Bu ticket\'ı kapatamazsın.');

$now = (string) round(microtime(true) * 1000);
mysqli_query($link, "UPDATE pw_tickets SET status='closed', closed_at=$now, updated_at=$now WHERE id=$tid");

$name = $u['username'];
$sys = $name . " talebi kapattı. Lütfen hizmeti puanla.";
$m = mysqli_prepare($link,
  "INSERT INTO pw_ticket_messages (ticket_id,sender,sender_name,sender_role,body,created_at)
   VALUES (?,?,?,'system',?,?)");
mysqli_stmt_bind_param($m, "issss", $tid, $me, $name, $sys, $now);
mysqli_stmt_execute($m); mysqli_stmt_close($m);

pw_json(['success' => true, 'message' => 'Ticket kapatıldı.']);
