<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');
if (!in_array($u['role'], ['owner','admin'], true))
    pw_fail('Yalnız owner/admin talep silebilir.');

$tid = (int)($d['ticketId'] ?? 0);
if ($tid <= 0) pw_fail('Geçersiz ticket.');

mysqli_query($link, "DELETE FROM pw_ticket_messages WHERE ticket_id=$tid");
mysqli_query($link, "DELETE FROM pw_tickets WHERE id=$tid");

pw_json(['success' => true, 'message' => 'Talep silindi.']);
