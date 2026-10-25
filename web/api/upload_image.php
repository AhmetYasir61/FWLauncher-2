<?php
require_once "pw_common.php";
require_once "config.php";

// multipart: username, token + 'file'
$user = pw_authuser($link, $_POST['username'] ?? '', $_POST['token'] ?? '');
if (!pw_is_admin($user)) pw_fail('Bu işlem için yetkin yok.');

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    pw_fail('Dosya yüklenemedi.');
}

$f = $_FILES['file'];
if ($f['size'] > 4 * 1024 * 1024) pw_fail('Dosya çok büyük (en fazla 4 MB).');

$ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
if (!in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'gif'], true)) {
    pw_fail('Geçersiz dosya türü. (png, jpg, webp, gif)');
}

$dir = __DIR__ . '/../img/products';
if (!is_dir($dir)) @mkdir($dir, 0775, true);
if (!is_writable($dir)) pw_fail('img/products klasörü yazılabilir değil.');

$fname = 'p_' . uniqid() . '.' . $ext;
if (!move_uploaded_file($f['tmp_name'], "$dir/$fname")) {
    pw_fail('Dosya kaydedilemedi.');
}

pw_json([
    'success' => true,
    'url'     => 'https://firewing.store/img/products/' . $fname,
]);
