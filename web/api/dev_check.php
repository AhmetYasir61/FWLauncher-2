<?php
// Dev Studio yetki kontrolü — launcher/backend tabanlı.
// Mod sunucusu çağırır: {key, player} → {success:true, dev:true/false}
// Yetki kaynağı: pw_devs tablosu (aşağıdaki tabloyu bir kez oluştur):
//   CREATE TABLE IF NOT EXISTS pw_devs (
//     username VARCHAR(32) PRIMARY KEY,
//     role VARCHAR(16) NOT NULL DEFAULT 'dev'   -- 'owner' | 'dev'
//   );
//   INSERT IGNORE INTO pw_devs (username, role) VALUES ('yasirtasarim', 'owner');
require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');

$player = strtolower(trim($d['player'] ?? ''));
if ($player === '') pw_fail('Geçersiz istek.');

$dev = false; $role = '';
$st = mysqli_prepare($link, "SELECT role FROM pw_devs WHERE username=? LIMIT 1");
if ($st) {
    mysqli_stmt_bind_param($st, "s", $player);
    mysqli_stmt_execute($st);
    mysqli_stmt_store_result($st);
    if (mysqli_stmt_num_rows($st) === 1) {
        mysqli_stmt_bind_result($st, $role);
        mysqli_stmt_fetch($st);
        $dev = true;
    }
    mysqli_stmt_close($st);
}

pw_json(['success' => true, 'dev' => $dev, 'role' => $role]);
