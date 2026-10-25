<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$user) pw_fail('Oturum geçersiz.');

$pid = (int)($d['productId'] ?? 0);
if ($pid <= 0) pw_fail('Geçersiz ürün.');

$stmt = mysqli_prepare($link, "SELECT name, price, command FROM pw_products WHERE id = ?");
mysqli_stmt_bind_param($stmt, "i", $pid);
mysqli_stmt_execute($stmt);
mysqli_stmt_store_result($stmt);
if (mysqli_stmt_num_rows($stmt) != 1) pw_fail('Ürün bulunamadı.');
mysqli_stmt_bind_result($stmt, $pname, $price, $command);
mysqli_stmt_fetch($stmt);
mysqli_stmt_close($stmt);

$price = (int)$price;
if ($user['coins'] < $price) {
    pw_fail("Yetersiz coin. Bu ürün {$price} coin, bakiyen {$user['coins']} coin.");
}

// Coin düş
$new = $user['coins'] - $price;
$upd = mysqli_prepare($link, "UPDATE authme SET coins = ? WHERE id = ?");
mysqli_stmt_bind_param($upd, "ii", $new, $user['id']);
mysqli_stmt_execute($upd);
mysqli_stmt_close($upd);

pw_log($link, $user['username'], '', $price, 'purchase', $pname);

// Teslimat kuyruğuna ekle (komut tanımlıysa). deliver.php oyuncu online olunca çalıştırır.
$queued = false;
if (trim($command) !== '') {
    $now = (string) round(microtime(true) * 1000);
    $player = $user['username'];
    $ins = mysqli_prepare($link,
        "INSERT INTO pw_deliveries (player, command, product_name, status, created_at) VALUES (?,?,?,'pending',?)");
    mysqli_stmt_bind_param($ins, "ssss", $player, $command, $pname, $now);
    mysqli_stmt_execute($ins);
    mysqli_stmt_close($ins);
    $queued = true;
}

pw_json([
    'success' => true,
    'message' => $queued
        ? "'{$pname}' satın alındı! Oyuna girdiğinde otomatik teslim edilecek."
        : "'{$pname}' satın alındı. Teslimat kısa sürede yapılacaktır.",
    'coins'   => $new,
]);
