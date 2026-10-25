<?php
require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');

$player = strtolower(trim($d['player'] ?? ''));
$pid = (int)($d['productId'] ?? 0);
if ($player === '' || $pid <= 0) pw_fail('Geçersiz istek.');

// ürün (kit/katalog alanları dahil)
$st = mysqli_prepare($link,
    "SELECT name, type, price, description, image_url, command, kit_commands, slots, stock
       FROM pw_products WHERE id=? LIMIT 1");
mysqli_stmt_bind_param($st, "i", $pid);
mysqli_stmt_execute($st);
mysqli_stmt_store_result($st);
if (mysqli_stmt_num_rows($st) != 1) { mysqli_stmt_close($st); pw_fail('Ürün bulunamadı.'); }
mysqli_stmt_bind_result($st, $pname, $ptype, $price, $pdesc, $pimg, $command, $kitJson, $slots, $stock);
mysqli_stmt_fetch($st);
mysqli_stmt_close($st);
$price = (int)$price; $slots = max(1, (int)$slots); $stock = (int)$stock;
$ptype = $ptype ?: 'item';

if ($stock == 0) pw_json(['success' => false, 'message' => 'Stok tükendi.']);

// teslim yükü (payload): kit_commands doluysa hepsi, değilse tekil command
$payload = [];
if (!empty($kitJson)) {
    $arr = json_decode($kitJson, true);
    if (is_array($arr)) foreach ($arr as $c) { $c = trim((string)$c); if ($c !== '') $payload[] = $c; }
}
if (count($payload) === 0) {
    $c = trim((string)$command);
    if ($c !== '') $payload[] = $c;
}
if (count($payload) === 0) pw_fail('Ürünün teslim komutu tanımlı değil.');
// kit ise gereken slot sayısı = komut sayısı (en az tanımlı slots)
if ($ptype === 'kit') $slots = max($slots, count($payload));

// oyuncu + coin
$st2 = mysqli_prepare($link, "SELECT id, coins FROM authme WHERE username=? LIMIT 1");
mysqli_stmt_bind_param($st2, "s", $player);
mysqli_stmt_execute($st2);
mysqli_stmt_store_result($st2);
if (mysqli_stmt_num_rows($st2) != 1) { mysqli_stmt_close($st2); pw_fail('Oyuncu bulunamadı.'); }
mysqli_stmt_bind_result($st2, $uid, $coins);
mysqli_stmt_fetch($st2);
mysqli_stmt_close($st2);
$coins = (int)$coins;

if ($coins < $price)
    pw_json(['success' => false, 'message' => "Yetersiz coin ({$price} gerekli).", 'coins' => $coins]);

// coin düş
$new = $coins - $price;
$u = mysqli_prepare($link, "UPDATE authme SET coins=? WHERE id=?");
mysqli_stmt_bind_param($u, "ii", $new, $uid);
mysqli_stmt_execute($u);
mysqli_stmt_close($u);

// stok düş (sınırlıysa)
if ($stock > 0) mysqli_query($link, "UPDATE pw_products SET stock=stock-1 WHERE id=$pid AND stock>0");

// DEPOYA ekle (anında teslim YOK — oyuncu oyun içinde tıklayıp alır)
$payloadJson = json_encode(array_values($payload), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$now = (string) round(microtime(true) * 1000);
$ins = mysqli_prepare($link,
    "INSERT INTO pw_depo (player, product_id, product_name, type, image_url, description, payload, qty, slots, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'pending', ?)");
mysqli_stmt_bind_param($ins, "sisssssis",
    $player, $pid, $pname, $ptype, $pimg, $pdesc, $payloadJson, $slots, $now);
mysqli_stmt_execute($ins);
$depoId = mysqli_insert_id($link);
mysqli_stmt_close($ins);

if (function_exists('pw_log')) pw_log($link, $player, '', $price, 'purchase_depo', $pname);

pw_json([
    'success' => true,
    'message' => "'{$pname}' depona eklendi! Envanterinde yer açıp teslim al.",
    'coins'   => $new,
    'depoId'  => (int)$depoId,
    'name'    => $pname,
    'slots'   => $slots,
]);
