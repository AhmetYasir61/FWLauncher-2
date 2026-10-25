<?php
require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

// Oyun-içi duyurular = launcher "Duyurular" (pw_ads) ile AYNI kaynak.
// Admin panelden bir duyuru yayınlayınca hem launcher'da hem oyun içinde
// (achievement toast + Duyurular uygulaması) görünür.

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');

$sinceId = (int)($d['sinceId'] ?? 0);

$items = [];
$st = mysqli_prepare($link,
    "SELECT id, title, description, badge, image_url, created_at
       FROM pw_ads WHERE id>? ORDER BY id ASC LIMIT 50");
mysqli_stmt_bind_param($st, "i", $sinceId);
mysqli_stmt_execute($st);
$res = mysqli_stmt_get_result($st);
while ($r = mysqli_fetch_assoc($res)) {
    $b = mb_strtoupper(trim((string)($r['badge'] ?? '')), 'UTF-8');
    $type = 'info';
    if (mb_strpos($b, 'ETK') !== false)                              $type = 'event';
    elseif (mb_strpos($b, 'KAMP') !== false || mb_strpos($b, 'NDİR') !== false
         || mb_strpos($b, 'NDIR') !== false || mb_strpos($b, 'ÖDÜL') !== false) $type = 'reward';
    elseif (mb_strpos($b, 'GÜNCEL') !== false || mb_strpos($b, 'GUNCEL') !== false) $type = 'update';
    $items[] = [
        'id'        => (int)$r['id'],
        'title'     => $r['title'],
        'message'   => $r['description'],
        'iconUrl'   => $r['image_url'],
        'type'      => $type,
        'badge'     => $r['badge'],
        'createdAt' => (float)$r['created_at'],
    ];
}
mysqli_stmt_close($st);

$maxId = $sinceId;
foreach ($items as $it) if ($it['id'] > $maxId) $maxId = $it['id'];

pw_json(['success' => true, 'announcements' => $items, 'lastId' => $maxId]);
