<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');

$tid  = (int)($d['ticketId'] ?? 0);
$body = trim($d['body'] ?? '');
if ($tid <= 0) pw_fail('Geçersiz ticket.');
if ($body === '') pw_fail('Mesaj boş.');
if (mb_strlen($body) > 1000) $body = mb_substr($body, 0, 1000);

$tr = mysqli_query($link, "SELECT * FROM pw_tickets WHERE id=$tid LIMIT 1");
$t  = $tr ? mysqli_fetch_assoc($tr) : null;
if (!$t) pw_fail('Ticket bulunamadı.');
if ($t['status'] === 'closed') pw_fail('Bu ticket kapalı.');

$me      = strtolower($u['username']);
$isOwner = ($me === $t['player']);
$isAdmin = in_array($u['role'], ['owner','admin'], true);
$isAssigned = ($t['assigned'] !== null && $t['assigned'] === $me);

if (!($isOwner || $isAdmin || $isAssigned))
    pw_fail('Yanıtlamak için önce ticket\'ı "Al".');

$now = (string) round(microtime(true) * 1000);
$pn = $u['username']; $role = $u['role'];
$m = mysqli_prepare($link,
  "INSERT INTO pw_ticket_messages (ticket_id,sender,sender_name,sender_role,body,created_at)
   VALUES (?,?,?,?,?,?)");
mysqli_stmt_bind_param($m, "isssss", $tid, $me, $pn, $role, $body, $now);
if (!mysqli_stmt_execute($m)) pw_fail('Gönderilemedi: ' . mysqli_stmt_error($m));
mysqli_stmt_close($m);

mysqli_query($link, "UPDATE pw_tickets SET updated_at=$now WHERE id=$tid");

pw_json(['success' => true]);
