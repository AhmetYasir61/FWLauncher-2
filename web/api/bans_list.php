<?php
// ============================================================
//  Yasaklı oyuncular listesi (HERKESE AÇIK — South tema 'Yasaklananlar' sayfası).
//  Yalnız güvenli alanlar: kullanıcı adı, sebep, yetkili, tarih. HWID asla verilmez.
// ============================================================
require_once "pw_common.php";
require_once "config.php";

$bans = [];
$now = round(microtime(true) * 1000);
$res = @mysqli_query($link,
    "SELECT username, reason, by_admin, created_at FROM pw_bans
     WHERE until = 0 OR until > $now ORDER BY id DESC LIMIT 100");
if ($res) {
    while ($r = mysqli_fetch_assoc($res)) {
        $bans[] = [
            'name'   => $r['username'],
            'reason' => $r['reason'],
            'by'     => $r['by_admin'],
            'when'   => (int)$r['created_at'],
        ];
    }
}

pw_json(['success' => true, 'bans' => $bans]);
