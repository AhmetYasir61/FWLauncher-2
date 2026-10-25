<?php
require_once "pw_common.php";       // json header + pw_body/pw_json/pw_fail
require_once "config.php";          // $link
require_once "depo_config.php";     // $DEPO_KEY

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key']))
    pw_fail('Yetkisiz.');

$players = $d['players'] ?? [];
if (!is_array($players) || count($players) === 0)
    pw_json(['success' => true, 'deliveries' => []]);

$in = [];
foreach ($players as $p) {
    $p = strtolower(trim((string)$p));
    if ($p !== '') $in[] = "'" . mysqli_real_escape_string($link, $p) . "'";
}
if (count($in) === 0) pw_json(['success' => true, 'deliveries' => []]);
$inSql = implode(',', $in);

$rows = [];
$res = mysqli_query($link,
    "SELECT id, player, command, product_name FROM pw_deliveries
     WHERE status='pending' AND LOWER(player) IN ($inSql) ORDER BY id ASC LIMIT 100");
while ($res && ($r = mysqli_fetch_assoc($res))) $rows[] = $r;

if (count($rows) === 0) pw_json(['success' => true, 'deliveries' => []]);

// Çift teslimi önlemek için ÇEKERKEN 'done' işaretle (claim-on-pull).
$ids = array_map(fn($r) => (int)$r['id'], $rows);
$now = (string) round(microtime(true) * 1000);
mysqli_query($link,
    "UPDATE pw_deliveries SET status='done', attempts=attempts+1, delivered_at=$now
     WHERE id IN (" . implode(',', $ids) . ")");

$out = [];
foreach ($rows as $r) {
    $out[] = [
        'id'          => (int)$r['id'],
        'player'      => $r['player'],
        'command'     => $r['command'],
        'productName' => $r['product_name'],
    ];
}

pw_json(['success' => true, 'deliveries' => $out]);
