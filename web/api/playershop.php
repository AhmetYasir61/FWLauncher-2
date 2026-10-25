<?php
// playershop.php — Oyuncu Marketi (Playershop). Oyuncular item'larını coin karşılığı satışa koyar,
// başkaları satın alır. Mod aracılığıyla çağrılır (key + player). Coin = authme.coins.
//
// action:
//   list                        → aktif satış ilanları
//   sell   {slot, price}        → oyuncunun elindeki item'ı satışa koy (mod item'ı alır, pw_shop'a yazar)
//   buy    {listingId}          → ilanı satın al (alıcı coin öder, satıcıya gider, item alıcıya)
//   cancel {listingId}          → kendi ilanını geri çek (item iade)
//   mine                        → oyuncunun kendi ilanları
//
// NOT: item transferi mod tarafında yapılır (envanterden al/ver); bu endpoint sadece ilan defterini
// ve coin akışını yönetir. Mod, sell'de item NBT'sini 'item_data' olarak yollar, buy'da geri alır.

require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');
$player = strtolower(trim($d['player'] ?? ''));
if ($player === '') pw_fail('Oyuncu gerekli.');

// pw_shop tablosu (idempotent)
mysqli_query($link, "CREATE TABLE IF NOT EXISTS pw_shop (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller VARCHAR(32) NOT NULL,
    display VARCHAR(128) NOT NULL,
    item_data MEDIUMTEXT NOT NULL,
    price BIGINT NOT NULL DEFAULT 0,
    amount INT NOT NULL DEFAULT 1,
    status VARCHAR(12) NOT NULL DEFAULT 'active',
    created_at BIGINT DEFAULT 0,
    INDEX(status), INDEX(seller)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$action = strtolower(trim($d['action'] ?? 'list'));

// ---- Coin yardımcıları (authme.coins) ----
function coins_get($link, $user) {
    $u = mysqli_real_escape_string($link, $user);
    $r = mysqli_query($link, "SELECT coins FROM authme WHERE LOWER(username)='$u' LIMIT 1");
    return ($r && ($row = mysqli_fetch_assoc($r))) ? (int)$row['coins'] : 0;
}
function coins_add($link, $user, $delta) {
    $u = mysqli_real_escape_string($link, $user);
    return mysqli_query($link, "UPDATE authme SET coins = coins + ($delta) WHERE LOWER(username)='$u'");
}

if ($action === 'list') {
    $rows = [];
    $res = mysqli_query($link, "SELECT id, seller, display, price, amount, created_at
                                FROM pw_shop WHERE status='active' ORDER BY id DESC LIMIT 200");
    while ($res && ($r = mysqli_fetch_assoc($res))) {
        $rows[] = ['id' => (int)$r['id'], 'seller' => $r['seller'], 'display' => $r['display'],
                   'price' => (int)$r['price'], 'amount' => (int)$r['amount']];
    }
    pw_json(['success' => true, 'listings' => $rows, 'coins' => coins_get($link, $player)]);
}

if ($action === 'mine') {
    $rows = [];
    $p = mysqli_real_escape_string($link, $player);
    $res = mysqli_query($link, "SELECT id, display, price, amount FROM pw_shop
                                WHERE status='active' AND seller='$p' ORDER BY id DESC");
    while ($res && ($r = mysqli_fetch_assoc($res))) {
        $rows[] = ['id' => (int)$r['id'], 'display' => $r['display'], 'price' => (int)$r['price'], 'amount' => (int)$r['amount']];
    }
    pw_json(['success' => true, 'listings' => $rows]);
}

if ($action === 'sell') {
    $display  = trim($d['display'] ?? 'Item');
    $itemData = trim($d['itemData'] ?? '');       // mod'un yolladığı item NBT/serileştirme
    $price    = max(1, (int)($d['price'] ?? 1));
    $amount   = max(1, (int)($d['amount'] ?? 1));
    if ($itemData === '') pw_fail('Item verisi yok.');
    $s = mysqli_real_escape_string($link, $player);
    $di = mysqli_real_escape_string($link, $display);
    $id = mysqli_real_escape_string($link, $itemData);
    $ok = mysqli_query($link, "INSERT INTO pw_shop (seller, display, item_data, price, amount, status, created_at)
          VALUES ('$s','$di','$id',$price,$amount,'active'," . round(microtime(true)*1000) . ")");
    if (!$ok) pw_fail('İlan açılamadı: ' . mysqli_error($link));
    pw_json(['success' => true, 'message' => 'İlan açıldı!', 'id' => mysqli_insert_id($link)]);
}

if ($action === 'buy') {
    $lid = (int)($d['listingId'] ?? 0);
    if ($lid <= 0) pw_fail('Geçersiz ilan.');
    // ilanı kilitle
    $res = mysqli_query($link, "SELECT * FROM pw_shop WHERE id=$lid AND status='active' LIMIT 1");
    $lst = $res ? mysqli_fetch_assoc($res) : null;
    if (!$lst) pw_fail('İlan bulunamadı / satılmış.');
    $seller = strtolower($lst['seller']);
    $price  = (int)$lst['price'];
    if ($seller === $player) pw_fail('Kendi ilanını satın alamazsın.');
    if (coins_get($link, $player) < $price) pw_fail('Yeterli coin yok.');

    // atomik: alıcıdan düş, satıcıya ekle, ilanı sold yap
    mysqli_query($link, "START TRANSACTION");
    $okA = coins_add($link, $player, -$price);
    $okB = coins_add($link, $seller, $price);
    $okC = mysqli_query($link, "UPDATE pw_shop SET status='sold' WHERE id=$lid AND status='active'");
    if ($okA && $okB && $okC && mysqli_affected_rows($link) >= 0) {
        mysqli_query($link, "COMMIT");
        pw_json(['success' => true, 'message' => 'Satın alındı!',
                 'itemData' => $lst['item_data'], 'display' => $lst['display'],
                 'amount' => (int)$lst['amount'], 'coins' => coins_get($link, $player)]);
    } else {
        mysqli_query($link, "ROLLBACK");
        pw_fail('İşlem başarısız, coin iade edildi.');
    }
}

if ($action === 'cancel') {
    $lid = (int)($d['listingId'] ?? 0);
    $p = mysqli_real_escape_string($link, $player);
    $res = mysqli_query($link, "SELECT item_data, display, amount FROM pw_shop
                                WHERE id=$lid AND seller='$p' AND status='active' LIMIT 1");
    $lst = $res ? mysqli_fetch_assoc($res) : null;
    if (!$lst) pw_fail('İlan yok / senin değil.');
    mysqli_query($link, "UPDATE pw_shop SET status='cancelled' WHERE id=$lid");
    pw_json(['success' => true, 'message' => 'İlan geri çekildi.',
             'itemData' => $lst['item_data'], 'display' => $lst['display'], 'amount' => (int)$lst['amount']]);
}

pw_fail('Bilinmeyen işlem.');
