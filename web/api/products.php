<?php
require_once "pw_common.php";
require_once "config.php";

// Admin kontrol panelinin ürün listesi (launcher market kaldırıldı; bu uç artık
// yalnız admin panelini besler). shop_open.php oyun-içi market için ayrı çalışır.

$prods = [];
$cats = [];
$res = mysqli_query($link,
    "SELECT id, name, category, type, price, description, long_desc, badge, image_url, gallery,
            command, kit_commands, slots, stock
       FROM pw_products ORDER BY sort_order ASC, id ASC");
while ($res && ($r = mysqli_fetch_assoc($res))) {
    $gallery = [];
    if (!empty($r['gallery'])) { $g = json_decode($r['gallery'], true); if (is_array($g)) $gallery = $g; }
    $kit = [];
    if (!empty($r['kit_commands'])) { $k = json_decode($r['kit_commands'], true); if (is_array($k)) $kit = $k; }
    $prods[] = [
        'id'          => (string)$r['id'],
        'name'        => $r['name'],
        'category'    => $r['category'],
        'type'        => $r['type'] ?: 'item',
        'price'       => (int)$r['price'],
        'description' => $r['description'],
        'longDesc'    => $r['long_desc'] ?? '',
        'badge'       => $r['badge'],
        'imageUrl'    => $r['image_url'],
        'gallery'     => $gallery,
        'command'     => $r['command'],
        'kitCommands' => $kit,
        'slots'       => max(1, (int)$r['slots']),
        'stock'       => (int)$r['stock'],
    ];
    $c = trim((string)$r['category']);
    if ($c !== '' && !in_array($c, $cats, true)) $cats[] = $c;
}

$categories = [['id' => 'all', 'name' => 'Tümü']];
foreach ($cats as $c) $categories[] = ['id' => $c, 'name' => $c];

pw_json(['categories' => $categories, 'products' => $prods]);
