<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!pw_is_admin($user)) pw_fail('Bu işlem için yetkin yok.');

$id = (int)($d['id'] ?? 0);
if ($id <= 0) pw_fail('Geçersiz duyuru.');

$stmt = mysqli_prepare($link, "DELETE FROM pw_ads WHERE id=?");
if (!$stmt) pw_fail('SQL hazırlanamadı: ' . mysqli_error($link));
mysqli_stmt_bind_param($stmt, "i", $id);
if (!mysqli_stmt_execute($stmt)) pw_fail('Silinemedi: ' . mysqli_stmt_error($stmt));
mysqli_stmt_close($stmt);

pw_json(['success' => true, 'message' => 'Duyuru silindi.']);
