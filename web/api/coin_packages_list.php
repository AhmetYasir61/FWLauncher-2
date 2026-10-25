<?php
// Coin paketleri (herkese açık okuma) — frontend market/topup için.
require_once "pw_common.php";
require_once "config.php";
require_once "coin_packages.php";

$pkgs = pw_coin_packages();
$out = [];
foreach ($pkgs as $id => $p) {
    $old = (int)($p['oldPrice'] ?? 0);
    $out[] = [
        'id'            => $id,
        'coins'         => (int)$p['coins'],
        'price'         => (int)$p['price'],          // kuruş
        'priceLabel'    => pw_price_label($p['price']),
        'oldPrice'      => $old,
        'oldPriceLabel' => $old > (int)$p['price'] ? pw_price_label($old) : '',
        'name'          => $p['name'],
        'popular'       => !empty($p['popular']),
    ];
}
pw_json(['success' => true, 'packages' => $out]);
