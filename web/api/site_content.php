<?php
// Site içeriği (herkese açık okuma). Editörün kaydettiği JSON'u döndürür.
require_once "pw_common.php";
require_once "config.php";

mysqli_query($link, "
    CREATE TABLE IF NOT EXISTS pw_site_content (
        id         INT NOT NULL PRIMARY KEY,
        data       LONGTEXT NULL,
        updated_at BIGINT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$res = mysqli_query($link, "SELECT data FROM pw_site_content WHERE id = 1 LIMIT 1");
$content = new stdClass();
if ($res && ($row = mysqli_fetch_assoc($res))) {
    $parsed = json_decode($row['data'], true);
    if (is_array($parsed)) $content = $parsed;
}
pw_json(['success' => true, 'content' => $content]);
