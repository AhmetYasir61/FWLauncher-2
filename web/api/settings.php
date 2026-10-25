<?php
require_once "pw_common.php";
require_once "config.php";

// Herkese açık: launcher Discord/web adreslerini buradan okur.
// GÜVENLİK: yalnız beyaz listedeki anahtarlar dışarı verilir (gizli ayar sızmasın).
$out = ['discord_url' => '', 'website_url' => ''];

$res = mysqli_query($link, "SELECT skey, svalue FROM pw_settings");
if ($res) {
    while ($row = mysqli_fetch_assoc($res)) {
        if (array_key_exists($row['skey'], $out)) $out[$row['skey']] = $row['svalue'];
    }
}

pw_json($out);
