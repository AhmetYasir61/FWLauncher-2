<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!pw_is_admin($user)) pw_fail('Bu işlem için yetkin yok.');

$id    = (int)($d['id'] ?? 0);
$title = trim($d['title'] ?? '');
$desc  = trim($d['description'] ?? '');
$badge = trim($d['badge'] ?? '');
$img   = trim($d['imageUrl'] ?? '');
$url   = trim($d['url'] ?? '');

if ($title === '') pw_fail('Başlık gerekli.');

if ($id > 0) {
    $stmt = mysqli_prepare($link,
        "UPDATE pw_ads SET title=?, description=?, badge=?, image_url=?, url=? WHERE id=?");
    if (!$stmt) pw_fail('SQL hazırlanamadı: ' . mysqli_error($link));
    mysqli_stmt_bind_param($stmt, "sssssi", $title, $desc, $badge, $img, $url, $id);
} else {
    $now = (string) round(microtime(true) * 1000);
    $stmt = mysqli_prepare($link,
        "INSERT INTO pw_ads (title, description, badge, image_url, url, created_at) VALUES (?,?,?,?,?,?)");
    if (!$stmt) pw_fail('SQL hazırlanamadı: ' . mysqli_error($link));
    mysqli_stmt_bind_param($stmt, "ssssss", $title, $desc, $badge, $img, $url, $now);
}

if (!mysqli_stmt_execute($stmt)) pw_fail('Duyuru kaydedilemedi: ' . mysqli_stmt_error($stmt));
$newId = $id > 0 ? $id : mysqli_insert_id($link);
mysqli_stmt_close($stmt);

pw_json(['success' => true, 'message' => 'Duyuru kaydedildi.', 'id' => $newId]);
