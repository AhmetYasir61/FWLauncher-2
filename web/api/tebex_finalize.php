<?php
/* ============================================================================
 *  tebex_finalize.php — Basket auth SONRASI dönüş noktası.
 * ----------------------------------------------------------------------------
 *  Akış: tebex_create.php basket'i oluşturur, sepeti pw_tebex_pending'e yazar
 *  ve müşteriyi Tebex auth linkine yollar. Müşteri auth'u tamamlayınca Tebex
 *  onu buraya (?ident=...) geri döndürür. Burada:
 *    1) pw_tebex_pending'ten sepeti oku,
 *    2) paketleri (artık yetkili) basket'e ekle,
 *    3) kuponu uygula,
 *    4) checkout linkine yönlendir.
 * ==========================================================================*/

require_once "config.php";        // $link
require_once "tebex_config.php";  // token/key + $TEBEX_HEADLESS_* + URL'ler

$LOG  = __DIR__ . '/tebex_create.log';
$FAIL = 'https://pokewing.com/api/tebex_result.php?status=fail';
function fin_log($LOG, $m) { @file_put_contents($LOG, date('c') . "  FIN " . $m . "\n", FILE_APPEND); }
function fin_go($url) { header('Location: ' . $url); exit; }

function tbx($method, $url, $body = null) {
    global $TEBEX_PUBLIC_TOKEN, $TEBEX_PRIVATE_KEY;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Accept: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    if ($TEBEX_PUBLIC_TOKEN !== '' && $TEBEX_PRIVATE_KEY !== '') {
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_USERPWD, $TEBEX_PUBLIC_TOKEN . ':' . $TEBEX_PRIVATE_KEY);
    }
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode((string)$res, true), $res];
}

$ident = (string)($_GET['ident'] ?? '');
if ($ident === '') { fin_log($LOG, "no-ident"); fin_go($FAIL); }

$identEsc = mysqli_real_escape_string($link, $ident);
$r = mysqli_query($link, "SELECT items, coupon FROM pw_tebex_pending WHERE ident='$identEsc' LIMIT 1");
if (!$r || !($row = mysqli_fetch_assoc($r))) { fin_log($LOG, "no-pending ident=$ident"); fin_go($FAIL); }
$lines = json_decode($row['items'], true); if (!is_array($lines)) $lines = [];
$coupon = (string)($row['coupon'] ?? '');

$acc = "$TEBEX_HEADLESS_ACCOUNTS/" . rawurlencode($TEBEX_PUBLIC_TOKEN);
$bas = "$TEBEX_HEADLESS_BASKETS/" . rawurlencode($ident);

// Paketleri ekle (basket artık yetkili).
foreach ($lines as $line) {
    [$c, $b, $raw] = tbx('POST', "$bas/packages", $line);
    fin_log($LOG, "add pkg=" . ($line['package_id'] ?? '?') . " HTTP=$c " . substr((string)$raw, 0, 160));
    if ($c >= 300) fin_go($FAIL);
}

// Kupon (opsiyonel).
if ($coupon !== '') tbx('POST', "$bas/coupons", ['coupon_code' => $coupon]);

// Checkout linkini al ve yönlendir.
[$cg, $bg] = tbx('GET', "$acc/baskets/" . rawurlencode($ident));
$checkout = $bg['data']['links']['checkout'] ?? '';
if ($checkout === '') { fin_log($LOG, "no-checkout ident=$ident"); fin_go($FAIL); }

// Tek kullanım: bekleyen sepeti temizle.
mysqli_query($link, "DELETE FROM pw_tebex_pending WHERE ident='$identEsc'");

fin_log($LOG, "OK ident=$ident -> checkout");
fin_go($checkout);
