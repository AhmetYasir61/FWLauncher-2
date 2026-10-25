<?php
require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY (mod ile aynı)

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');

$player = strtolower(trim($d['player'] ?? ''));
if ($player === '') pw_fail('Oyuncu gerekli.');

// coin
$coins = 0;
$st = mysqli_prepare($link, "SELECT coins FROM authme WHERE username=? LIMIT 1");
mysqli_stmt_bind_param($st, "s", $player);
mysqli_stmt_execute($st);
mysqli_stmt_bind_result($st, $c);
if (mysqli_stmt_fetch($st)) $coins = (int)$c;
mysqli_stmt_close($st);

// ürünler (KOMUT/kit_commands GÖNDERİLMEZ — güvenlik). Katalog alanları dahil.
$prods = [];
$res = mysqli_query($link,
    "SELECT id, name, category, type, price, description, long_desc, badge, image_url, gallery, slots, stock
       FROM pw_products ORDER BY sort_order ASC, id ASC");
while ($res && ($r = mysqli_fetch_assoc($res))) {
    $gallery = [];
    if (!empty($r['gallery'])) { $g = json_decode($r['gallery'], true); if (is_array($g)) $gallery = $g; }
    $prods[] = [
        'id'          => (int)$r['id'],
        'name'        => $r['name'],
        'category'    => $r['category'],
        'type'        => $r['type'] ?: 'item',
        'price'       => (int)$r['price'],
        'description' => $r['description'],
        'longDesc'    => $r['long_desc'] ?? '',
        'badge'       => $r['badge'],
        'imageUrl'    => $r['image_url'],
        'gallery'     => $gallery,
        'slots'       => max(1, (int)$r['slots']),
        'stock'       => (int)$r['stock'],
    ];
}

pw_json(['success' => true, 'coins' => $coins, 'products' => $prods]);
