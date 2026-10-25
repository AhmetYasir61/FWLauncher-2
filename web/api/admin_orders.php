<?php
// Yönetim panelindeki son siparişler — gerçek PayTR ödemeleri (admin/owner).
require_once "pw_common.php";
require_once "config.php";
require_once "coin_packages.php";   // pw_ensure_payments_table + pw_price_label

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u || !pw_is_admin($u)) pw_fail('Yetkisiz.');

pw_ensure_payments_table($link);

$orders = [];
$res = mysqli_query($link,
    "SELECT merchant_oid, username, coins, amount, status, created_at, paid_at
     FROM pw_payments ORDER BY id DESC LIMIT 25");
while ($res && ($r = mysqli_fetch_assoc($res))) {
    $orders[] = [
        'id'      => $r['merchant_oid'],
        'player'  => $r['username'],
        'product' => number_format((int)$r['coins'], 0, ',', '.') . ' PokeCoin',
        'price'   => pw_price_label($r['amount']),
        'status'  => $r['status'],   // paid | pending | failed
        'when'    => (int)($r['paid_at'] ?: $r['created_at']),
    ];
}
pw_json(['success' => true, 'orders' => $orders]);
