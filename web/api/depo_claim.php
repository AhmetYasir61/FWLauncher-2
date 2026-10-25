<?php
require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

// Mod, envanterde YETERLİ BOŞ SLOT olduğunu DOĞRULADIKTAN sonra çağırır.
// Burada satır atomik olarak 'claimed' işaretlenir (çift teslim önlemi) ve
// teslim komutları (payload) yalnız bu güvenli uca döndürülür.

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');

$player = strtolower(trim($d['player'] ?? ''));
$depoId = (int)($d['depoId'] ?? 0);
if ($player === '' || $depoId <= 0) pw_fail('Geçersiz istek.');

// Önce payload + slots oku (pending & bu oyuncuya ait mi)
$st = mysqli_prepare($link,
    "SELECT product_name, payload, slots FROM pw_depo
      WHERE id=? AND player=? AND status='pending' LIMIT 1");
mysqli_stmt_bind_param($st, "is", $depoId, $player);
mysqli_stmt_execute($st);
mysqli_stmt_store_result($st);
if (mysqli_stmt_num_rows($st) != 1) { mysqli_stmt_close($st); pw_fail('Eşya bulunamadı veya zaten teslim alındı.'); }
mysqli_stmt_bind_result($st, $pname, $payloadJson, $slots);
mysqli_stmt_fetch($st);
mysqli_stmt_close($st);
$slots = max(1, (int)$slots);

// Boş slot kontrolü — mod, oyuncunun mevcut boş slot sayısını gönderir.
// Yetersizse CLAIM YAPILMAZ (eşya depoda kalır, boşa gitmez).
$freeSlots = (int)($d['freeSlots'] ?? -1);
if ($freeSlots >= 0 && $freeSlots < $slots)
    pw_json(['success' => false, 'message' => "Envanterinde yer yok ({$slots} boş slot gerekli)."]);

// Atomik claim: yalnız hâlâ pending ise işaretle (yarış koşulu koruması)
$now = (string) round(microtime(true) * 1000);
$u = mysqli_prepare($link,
    "UPDATE pw_depo SET status='claimed', claimed_at=?
      WHERE id=? AND player=? AND status='pending'");
mysqli_stmt_bind_param($u, "sis", $now, $depoId, $player);
mysqli_stmt_execute($u);
$aff = mysqli_stmt_affected_rows($u);
mysqli_stmt_close($u);
if ($aff != 1) pw_fail('Eşya zaten teslim alındı.');

// Teslim komutları
$cmds = [];
$arr = json_decode((string)$payloadJson, true);
if (is_array($arr)) foreach ($arr as $c) { $c = trim((string)$c); if ($c !== '') $cmds[] = $c; }

if (function_exists('pw_log')) pw_log($link, $player, '', 0, 'depo_claim', $pname);

pw_json([
    'success'  => true,
    'message'  => "'{$pname}' teslim alındı!",
    'commands' => array_values($cmds),   // mod ({player}) ile çalıştırır
    'slots'    => max(1, (int)$slots),
]);
