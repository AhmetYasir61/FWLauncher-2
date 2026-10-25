<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');
if (!in_array($u['role'], ['owner','admin'], true))
    pw_fail('Yalnız owner/admin görebilir.');

$now = (int) round(microtime(true) * 1000);
$q = trim($d['q'] ?? '');
$where = '';
if ($q !== '') {
    $qe = mysqli_real_escape_string($link, strtolower($q));
    $where = "WHERE LOWER(a.username) LIKE '%$qe%' OR LOWER(a.realname) LIKE '%$qe%'";
}

$sql = "SELECT a.username, a.realname, a.role, a.coins,
               COALESCE(m.banned,0) AS banned, COALESCE(m.warn_until,0) AS warn_until
        FROM authme a
        LEFT JOIN pw_moderation m ON m.username = a.username
        $where
        ORDER BY FIELD(a.role,'owner','admin','moderator','rehber','player'), a.realname ASC
        LIMIT 300";
$res = mysqli_query($link, $sql);

$users = [];
if ($res) while ($r = mysqli_fetch_assoc($res)) {
    $wu = (int)$r['warn_until'];
    $users[] = [
        'username'    => $r['username'],
        'name'        => ($r['realname'] !== null && $r['realname'] !== '') ? $r['realname'] : $r['username'],
        'role'        => strtolower($r['role'] ?: 'player'),
        'coins'       => (int)$r['coins'],
        'banned'      => ((int)$r['banned'] === 1),
        'warnRemaining' => $wu > $now ? ($wu - $now) : 0,
    ];
}

pw_json(['success' => true, 'meRole' => $u['role'], 'users' => $users]);
