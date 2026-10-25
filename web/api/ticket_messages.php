<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');

$tid   = (int)($d['ticketId'] ?? 0);
$after = (int)($d['afterId'] ?? 0);
if ($tid <= 0) pw_fail('Geçersiz ticket.');

$tr = mysqli_query($link, "SELECT * FROM pw_tickets WHERE id=$tid LIMIT 1");
$t  = $tr ? mysqli_fetch_assoc($tr) : null;
if (!$t) pw_fail('Ticket bulunamadı.');

$me    = strtolower($u['username']);
$staff = in_array($u['role'], ['owner','admin','moderator','rehber'], true);
if (!$staff && $me !== $t['player']) pw_fail('Erişim yok.');

$res = mysqli_query($link,
  "SELECT id,sender,sender_name,sender_role,body,created_at
   FROM pw_ticket_messages WHERE ticket_id=$tid AND id>$after ORDER BY id ASC");

$msgs = [];
if ($res) while ($r = mysqli_fetch_assoc($res)) {
    $msgs[] = [
        'id'        => (int)$r['id'],
        'sender'    => $r['sender'],
        'senderName'=> $r['sender_name'],
        'senderRole'=> $r['sender_role'],
        'body'      => $r['body'],
        'createdAt' => (float)$r['created_at'],
        'mine'      => ($r['sender'] === $me),
    ];
}

pw_json([
    'success'      => true,
    'status'       => $t['status'],
    'assignedName' => $t['assigned_name'],
    'assignedMe'   => ($t['assigned'] === $me),
    'rating'       => (int)$t['rating'],
    'isOwner'      => ($me === $t['player']),
    'messages'     => $msgs,
]);
