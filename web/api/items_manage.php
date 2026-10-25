<?php
// items_manage.php — Özel Item Creator: item tanımlarını yönet (dev/owner).
// Item motoru (mod) bu tanımları çeker; oyunda item verilir/kullanılır/satılır.
// action: 'list' | 'save' | 'delete'
//   Yetki: pw_devs (dev veya owner) — Item Creator'a erişim.
//
// Item alanları:
//   id, name (renk kodlu ad), material (vanilla veya itemsadder-id örn 'ia:ruby_sword'),
//   lore (JSON satır listesi), rarity, use_command ({player}), stats (JSON: {damage,speed,health...}),
//   price (coin, market için), sellable (0/1), author

require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY (mod çekişi için)

$d = pw_body();

// pw_custom_items tablosu (idempotent)
mysqli_query($link, "CREATE TABLE IF NOT EXISTS pw_custom_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    material VARCHAR(96) NOT NULL DEFAULT 'minecraft:stone',
    lore TEXT,
    rarity VARCHAR(16) DEFAULT 'common',
    use_command TEXT,
    stats TEXT,
    price BIGINT DEFAULT 0,
    sellable TINYINT DEFAULT 0,
    author VARCHAR(32) DEFAULT '',
    created_at BIGINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$action = strtolower(trim($d['action'] ?? 'list'));

// --- MOD çekişi: key ile (dev auth gerekmez, sunucu içi) ---
if ($action === 'pull') {
    if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');
    $rows = [];
    $res = mysqli_query($link, "SELECT * FROM pw_custom_items ORDER BY id ASC");
    while ($res && ($r = mysqli_fetch_assoc($res))) $rows[] = pw_item_out($r);
    pw_json(['success' => true, 'items' => $rows]);
}

// --- Yetki: iki yol ---
//   (1) MOD: key + player (oyun-içi Item Creator app — mod proxy'ler)
//   (2) LAUNCHER: username + token (admin doğrulaması)
$uname = '';
$isDev = false;
$isAdmin = false;

if (isset($d['key']) && hash_equals($DEPO_KEY, (string)$d['key']) && isset($d['player'])) {
    // Mod tarafı: oyuncu adıyla pw_devs kontrolü
    $uname = strtolower(trim($d['player']));
} else {
    $user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
    if (!$user) pw_fail('Giriş gerekli.');
    $uname = strtolower($user['username'] ?? '');
    $isAdmin = pw_is_admin($user);
}

if ($uname !== '') {
    $st = mysqli_prepare($link, "SELECT 1 FROM pw_devs WHERE username=? LIMIT 1");
    if ($st) { mysqli_stmt_bind_param($st, "s", $uname); mysqli_stmt_execute($st); mysqli_stmt_store_result($st); $isDev = mysqli_stmt_num_rows($st) === 1; }
}

// 'perm' — sadece yetki durumunu döndür (app açılışta erişim kontrolü)
if ($action === 'perm') {
    pw_json(['success' => true, 'canDev' => ($isDev || $isAdmin)]);
}

if (!$isDev && !$isAdmin) pw_fail('Item Creator için dev/owner yetkisi gerekli.');

if ($action === 'list') {
    $rows = [];
    $res = mysqli_query($link, "SELECT * FROM pw_custom_items ORDER BY id DESC");
    while ($res && ($r = mysqli_fetch_assoc($res))) $rows[] = pw_item_out($r);
    pw_json(['success' => true, 'items' => $rows]);
}

if ($action === 'save') {
    $id       = (int)($d['id'] ?? 0);
    $name     = trim($d['name'] ?? '');
    $material = trim($d['material'] ?? 'minecraft:stone');
    $rarity   = trim($d['rarity'] ?? 'common');
    $useCmd   = trim($d['useCommand'] ?? '');
    $price    = (int)($d['price'] ?? 0);
    $sellable = !empty($d['sellable']) ? 1 : 0;
    if ($name === '') pw_fail('Item adı gerekli.');
    $lore  = json_encode(is_array($d['lore'] ?? null) ? $d['lore'] : [], JSON_UNESCAPED_UNICODE);
    $stats = json_encode(is_array($d['stats'] ?? null) ? $d['stats'] : (object)[], JSON_UNESCAPED_UNICODE);
    $now = round(microtime(true) * 1000);

    $n = mysqli_real_escape_string($link, $name);
    $m = mysqli_real_escape_string($link, $material);
    $ra = mysqli_real_escape_string($link, $rarity);
    $uc = mysqli_real_escape_string($link, $useCmd);
    $lo = mysqli_real_escape_string($link, $lore);
    $stt = mysqli_real_escape_string($link, $stats);
    $au = mysqli_real_escape_string($link, $uname);

    if ($id > 0) {
        $ok = mysqli_query($link, "UPDATE pw_custom_items SET name='$n', material='$m', lore='$lo',
            rarity='$ra', use_command='$uc', stats='$stt', price=$price, sellable=$sellable WHERE id=$id");
    } else {
        $ok = mysqli_query($link, "INSERT INTO pw_custom_items (name, material, lore, rarity, use_command, stats, price, sellable, author, created_at)
            VALUES ('$n','$m','$lo','$ra','$uc','$stt',$price,$sellable,'$au',$now)");
        $id = mysqli_insert_id($link);
    }
    if (!$ok) pw_fail('Kaydedilemedi: ' . mysqli_error($link));
    pw_json(['success' => true, 'message' => 'Item kaydedildi.', 'id' => $id]);
}

if ($action === 'delete') {
    $id = (int)($d['id'] ?? 0);
    if ($id <= 0) pw_fail('Geçersiz id.');
    mysqli_query($link, "DELETE FROM pw_custom_items WHERE id=$id");
    pw_json(['success' => true, 'message' => 'Item silindi.']);
}

pw_fail('Bilinmeyen işlem.');

function pw_item_out($r) {
    return [
        'id'         => (int)$r['id'],
        'name'       => $r['name'],
        'material'   => $r['material'],
        'lore'       => json_decode($r['lore'] ?: '[]', true),
        'rarity'     => $r['rarity'],
        'useCommand' => $r['use_command'],
        'stats'      => json_decode($r['stats'] ?: '{}', true),
        'price'      => (int)$r['price'],
        'sellable'   => (int)$r['sellable'] === 1,
        'author'     => $r['author'],
    ];
}
