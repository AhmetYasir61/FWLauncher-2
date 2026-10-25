<?php
// ============================================================
//  Ana sayfa canlı akışı (HERKESE AÇIK — South tema widget'ları).
//  Yalnız güvenli alanlar: kullanıcı adı, miktar, ürün adı, zaman.
//  Tablolar yoksa boş liste döner (site ilk kurulumda da çalışır).
// ============================================================
require_once "pw_common.php";
require_once "config.php";

function pw_feed_rows($link, $sql, $map) {
    $out = [];
    $res = @mysqli_query($link, $sql);
    if ($res) while ($r = mysqli_fetch_assoc($res)) $out[] = $map($r);
    return $out;
}

// Son gerçek para coin yüklemeleri (pw_payments, yalnız 'paid')
$topups = pw_feed_rows($link,
    "SELECT username, coins, COALESCE(paid_at, created_at) AS ts
     FROM pw_payments WHERE status = 'paid' ORDER BY id DESC LIMIT 8",
    function ($r) { return ['name' => $r['username'], 'coins' => (int)$r['coins'], 'when' => (int)$r['ts']]; });

// Son market alışverişleri (pw_transactions type=purchase; ref = ürün adı)
$purchases = pw_feed_rows($link,
    "SELECT from_user, ref, amount, created_at FROM pw_transactions
     WHERE type = 'purchase' ORDER BY id DESC LIMIT 8",
    function ($r) { return ['name' => $r['from_user'], 'product' => $r['ref'], 'amount' => (int)$r['amount'], 'when' => (int)$r['created_at']]; });

// En'ler köşesi: en çok coin biriktirenler
$topCoins = pw_feed_rows($link,
    "SELECT COALESCE(NULLIF(realname,''), username) AS name, coins
     FROM authme ORDER BY coins DESC LIMIT 5",
    function ($r) { return ['name' => $r['name'], 'coins' => (int)$r['coins']]; });

pw_json([
    'success'   => true,
    'topups'    => $topups,
    'purchases' => $purchases,
    'topCoins'  => $topCoins,
]);
