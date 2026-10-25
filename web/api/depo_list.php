<?php
require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');

$player = strtolower(trim($d['player'] ?? ''));
if ($player === '') pw_fail('Oyuncu gerekli.');

// Bekleyen depo eşyaları (payload/komut GÖNDERİLMEZ — güvenlik).
$items = [];
$st = mysqli_prepare($link,
    "SELECT id, product_id, product_name, type, image_url, description, qty, slots, created_at
       FROM pw_depo WHERE player=? AND status='pending' ORDER BY id ASC");
mysqli_stmt_bind_param($st, "s", $player);
mysqli_stmt_execute($st);
$res = mysqli_stmt_get_result($st);
while ($r = mysqli_fetch_assoc($res)) {
    $items[] = [
        'depoId'      => (int)$r['id'],
        'productId'   => (int)$r['product_id'],
        'name'        => $r['product_name'],
        'type'        => $r['type'] ?: 'item',
        'imageUrl'    => $r['image_url'],
        'description' => $r['description'],
        'qty'         => (int)$r['qty'],
        'slots'       => max(1, (int)$r['slots']),
        'createdAt'   => (float)$r['created_at'],
    ];
}
mysqli_stmt_close($st);

pw_json(['success' => true, 'items' => $items]);
