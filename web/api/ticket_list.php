<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');

$staff = in_array($u['role'], ['owner','admin','moderator','rehber'], true);
$sub = "(SELECT body FROM pw_ticket_messages m WHERE m.ticket_id=t.id ORDER BY m.id DESC LIMIT 1)";

if ($staff) {
    $dayAgo = (int)(round(microtime(true)*1000) - 86400000);
    $sql = "SELECT t.*, $sub AS last_body FROM pw_tickets t
            WHERE t.status IN('open','claimed')
               OR (t.status='closed' AND t.closed_at > $dayAgo)
            ORDER BY (t.status='open') DESC, t.updated_at DESC LIMIT 100";
    $res = mysqli_query($link, $sql);
} else {
    $pl = mysqli_real_escape_string($link, strtolower($u['username']));
    $sql = "SELECT t.*, $sub AS last_body FROM pw_tickets t
            WHERE t.player='$pl' ORDER BY t.updated_at DESC LIMIT 50";
    $res = mysqli_query($link, $sql);
}

$items = [];
if ($res) while ($r = mysqli_fetch_assoc($res)) {
    $items[] = [
        'id'           => (int)$r['id'],
        'subject'      => $r['subject'],
        'playerName'   => $r['player_name'],
        'status'       => $r['status'],
        'assignedName' => $r['assigned_name'],
        'rating'       => (int)$r['rating'],
        'updatedAt'    => (float)$r['updated_at'],
        'lastBody'     => $r['last_body'] ?? '',
    ];
}

pw_json([
    'success' => true,
    'staff'   => $staff,
    'role'    => $u['role'],
    'tickets' => $items,
]);
