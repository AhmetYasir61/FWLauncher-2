<?php
// Site içeriğini kaydet — SADECE admin/owner. İstek: { username, token, content }
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$user) pw_fail('Oturum geçersiz.');
if (!pw_is_admin($user)) pw_fail('Bu işlem için yetkin yok.');

$content = $d['content'] ?? null;
if (!is_array($content)) pw_fail('Geçersiz içerik.');

$json = json_encode($content, JSON_UNESCAPED_UNICODE);
if ($json === false) pw_fail('İçerik kodlanamadı.');
if (strlen($json) > 2000000) pw_fail('İçerik çok büyük.');   // ~2 MB güvenlik sınırı

mysqli_query($link, "
    CREATE TABLE IF NOT EXISTS pw_site_content (
        id         INT NOT NULL PRIMARY KEY,
        data       LONGTEXT NULL,
        updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$now = (string) round(microtime(true) * 1000);
$stmt = mysqli_prepare($link,
    "INSERT INTO pw_site_content (id, data, updated_at) VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)");
mysqli_stmt_bind_param($stmt, "ss", $json, $now);
$ok = mysqli_stmt_execute($stmt);
mysqli_stmt_close($stmt);

if (!$ok) pw_fail('Kaydedilemedi: ' . mysqli_error($link));
pw_json(['success' => true]);
