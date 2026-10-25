<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!pw_is_admin($user)) pw_fail('Bu işlem için yetkin yok.');

$id      = (int)($d['id'] ?? 0);
$name    = trim($d['name'] ?? '');
$cat     = trim($d['category'] ?? 'Genel');
$type    = trim($d['type'] ?? 'item');
$price   = (int)($d['price'] ?? 0);
$desc    = trim($d['description'] ?? '');
$long    = trim($d['longDesc'] ?? '');
$badge   = trim($d['badge'] ?? '');
$img     = trim($d['imageUrl'] ?? '');
$command = trim($d['command'] ?? '');
$slots   = max(1, (int)($d['slots'] ?? 1));
$stock   = isset($d['stock']) ? (int)$d['stock'] : -1;

if ($name === '') pw_fail('Ürün adı gerekli.');
if ($cat === '') $cat = 'Genel';
if ($type === '') $type = 'item';

// kitCommands / gallery — dizi VEYA satır listesi kabul; JSON olarak sakla
function pw_jsonlist($v) {
    $out = [];
    if (is_array($v)) {
        foreach ($v as $x) { $x = trim((string)$x); if ($x !== '') $out[] = $x; }
    } elseif (is_string($v) && $v !== '') {
        foreach (preg_split('/\r\n|\r|\n/', $v) as $x) { $x = trim($x); if ($x !== '') $out[] = $x; }
    }
    return $out;
}
$kit = pw_jsonlist($d['kitCommands'] ?? []);
$gal = pw_jsonlist($d['gallery'] ?? []);
$kitJson = count($kit) ? json_encode(array_values($kit), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
$galJson = count($gal) ? json_encode(array_values($gal), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
// kit ise gereken slot sayısı en az komut sayısı kadar
if ($type === 'kit' && count($kit) > $slots) $slots = count($kit);

if ($id > 0) {
    $stmt = mysqli_prepare($link,
        "UPDATE pw_products SET name=?, category=?, type=?, price=?, description=?, long_desc=?,
            badge=?, image_url=?, gallery=?, command=?, kit_commands=?, slots=?, stock=? WHERE id=?");
    if (!$stmt) pw_fail('SQL hazırlanamadı: ' . mysqli_error($link));
    mysqli_stmt_bind_param($stmt, "sssisssssssiii",
        $name, $cat, $type, $price, $desc, $long, $badge, $img, $galJson, $command, $kitJson, $slots, $stock, $id);
} else {
    $now = (string) round(microtime(true) * 1000);
    $stmt = mysqli_prepare($link,
        "INSERT INTO pw_products (name, category, type, price, description, long_desc, badge, image_url,
            gallery, command, kit_commands, slots, stock, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    if (!$stmt) pw_fail('SQL hazırlanamadı: ' . mysqli_error($link));
    mysqli_stmt_bind_param($stmt, "sssisssssssiis",
        $name, $cat, $type, $price, $desc, $long, $badge, $img, $galJson, $command, $kitJson, $slots, $stock, $now);
}

if (!mysqli_stmt_execute($stmt)) pw_fail('Ürün kaydedilemedi: ' . mysqli_stmt_error($stmt));

$newId = $id > 0 ? $id : mysqli_insert_id($link);
mysqli_stmt_close($stmt);

pw_json(['success' => true, 'message' => 'Ürün kaydedildi.', 'id' => $newId]);
