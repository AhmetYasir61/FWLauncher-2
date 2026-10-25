<?php
// admin_run_command.php — Launcher ↔ sunucu köprüsü (RCON YERİNE).
// Admin/owner bir komutu pw_deliveries kuyruğuna yazar; mod delivery_pull.php ile çeker + çalıştırır.
// command: hem yönetim ("pwadmin toggle treefeller") hem genel ("give {player} ...") olabilir.
// player: komutun hedef/çalıştırılacağı oyuncu (online olmalı — mod online oyuncular için çeker).
//         Genel sunucu komutları için herhangi bir ONLINE admin adı verilebilir.

require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!pw_is_admin($user)) pw_fail('Bu işlem için yetkin yok.');

$player  = strtolower(trim($d['player'] ?? ''));
$command = trim($d['command'] ?? '');
if ($player === '')  pw_fail('Hedef oyuncu (online) gerekli.');
if ($command === '') pw_fail('Komut boş olamaz.');

// Güvenlik: bazı yıkıcı komutları engelle (stop/op kendine vb.)
$blocked = ['stop', 'ban ', 'op ', 'deop ', 'whitelist', 'save-off'];
$lc = strtolower($command);
foreach ($blocked as $b) {
    if (strpos($lc, $b) === 0) pw_fail('Bu komut güvenlik nedeniyle engellendi: ' . $b);
}

$pn = mysqli_real_escape_string($link, $player);
$cmd = mysqli_real_escape_string($link, $command);
$label = mysqli_real_escape_string($link, 'Yönetim: ' . mb_substr($command, 0, 40));

$ok = mysqli_query($link,
    "INSERT INTO pw_deliveries (player, command, product_name, status, attempts, created_at)
     VALUES ('$pn', '$cmd', '$label', 'pending', 0, " . round(microtime(true) * 1000) . ")");

if (!$ok) pw_fail('Kuyruğa yazılamadı: ' . mysqli_error($link));

pw_json([
    'success' => true,
    'message' => 'Komut kuyruğa eklendi. Sunucu ~30 sn içinde çalıştıracak.',
    'id'      => mysqli_insert_id($link),
]);
