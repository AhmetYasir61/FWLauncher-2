<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');
if (!in_array($u['role'], ['owner','admin','moderator','rehber'], true))
    pw_fail('Yalnız personel ticket alabilir.');

$tid = (int)($d['ticketId'] ?? 0);
if ($tid <= 0) pw_fail('Geçersiz ticket.');

$me  = strtolower($u['username']); $name = $u['username'];
$now = (string) round(microtime(true) * 1000);

// Yalnız 'open' olanı al (yarış güvenli)
$st = mysqli_prepare($link,
  "UPDATE pw_tickets SET status='claimed', assigned=?, assigned_name=?, updated_at=?
   WHERE id=? AND status='open'");
mysqli_stmt_bind_param($st, "sssi", $me, $name, $now, $tid);
mysqli_stmt_execute($st);
$ok = mysqli_stmt_affected_rows($st) > 0;
mysqli_stmt_close($st);

if (!$ok) pw_fail('Bu ticket başkası tarafından alınmış olabilir.');

// sistem mesajı
$sys = $name . " talebi üstlendi.";
$m = mysqli_prepare($link,
  "INSERT INTO pw_ticket_messages (ticket_id,sender,sender_name,sender_role,body,created_at)
   VALUES (?,?,?,'system',?,?)");
mysqli_stmt_bind_param($m, "issss", $tid, $me, $name, $sys, $now);
mysqli_stmt_execute($m); mysqli_stmt_close($m);

pw_json(['success' => true, 'assignedName' => $name, 'message' => 'Ticket üstlenildi.']);
