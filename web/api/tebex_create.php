<?php
// ============================================================
//  tebex_create.php — Tebex Headless ile ödeme başlat (paytr_create.php muadili).
//  İstek: { username, token, items:[{id,qty}] | packageId, coupon? }
//  Yanıt: { success, checkoutUrl } | { success:false, message }
//
//  AKIŞ (Tebex Headless API — resmi):
//   1) POST {accounts}/{publicToken}/baskets      → basket oluştur (username ile)
//   2) POST {baskets}/{ident}/packages            → her paketi ekle (package_id,qty)
//   3) (varsa) POST {baskets}/{ident}/coupons     → kupon uygula
//   4) data.links.checkout                        → kullanıcıyı buraya yönlendir
//
//  ÖN KOŞUL: coin_packages.php içindeki her paket, Tebex panelinde açtığın
//  ürünün 'tebex_id' değerini içermeli:
//     'p1000' => ['name'=>'1000 PCoin','price'=>2900,'coins'=>1000,'tebex_id'=>6832671],
//  (price hâlâ kuruş; gerçek tahsilatı artık Tebex yapar, price sadece gösterim/
//   pw_payments kaydı içindir. Fiyatı Tebex panelinde de aynı ayarla.)
// ============================================================
require_once "pw_common.php";
require_once "config.php";
require_once "tebex_config.php";
require_once "coin_packages.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$user) pw_fail('Oturum geçersiz.');

if (!pw_tebex_configured())
    pw_fail('Ödeme sistemi henüz etkin değil. (Yönetici: Admin panel → Tebex Ayarları → Public Token gir.)');

$packages = pw_coin_packages();

// tebex_id / coins için güvenilir kaynak: pw_coin_default_packages() (id ile eşlenir).
// DB'den gelen pw_coin_packages() tebex_id taşımasa bile buradan bulunur.
$defMap = [];
if (function_exists('pw_coin_default_packages')) {
    foreach (pw_coin_default_packages() as $dp) $defMap[(string)$dp['id']] = $dp;
}

// SEPET: items = [{id, qty}] (eski tek-paket packageId da desteklenir)
$items = $d['items'] ?? null;
if (!is_array($items) || !count($items)) {
    $pid = (string)($d['packageId'] ?? '');
    if ($pid === '') pw_fail('Sepet boş.');
    $items = [['id' => $pid, 'qty' => 1]];
}
if (count($items) > 10) pw_fail('Sepette en fazla 10 satır olabilir.');

$coinsTotal = 0; $amountTotal = 0; $idParts = []; $tebexLines = [];
foreach ($items as $it) {
    $iid = (string)($it['id'] ?? '');
    $qty = max(1, min(10, (int)($it['qty'] ?? 1)));
    $p = $packages[$iid] ?? ($defMap[$iid] ?? null);
    if ($p === null) pw_fail('Geçersiz paket: ' . $iid);
    // tebex_id ve coins önce canlı pakette, yoksa default dizide aranır.
    $tebexId = (int)($p['tebex_id'] ?? ($defMap[$iid]['tebex_id'] ?? 0));
    if ($tebexId <= 0) pw_fail('Paket Tebex ile eşlenmemiş (tebex_id yok): ' . $iid);
    $coins = (int)($p['coins'] ?? ($defMap[$iid]['coins'] ?? 0));
    $coinsTotal  += $coins * $qty;
    $amountTotal += (int)($p['price'] ?? ($defMap[$iid]['price'] ?? 0)) * $qty;
    $idParts[]    = $qty > 1 ? ($iid . 'x' . $qty) : $iid;
    $tebexLines[] = ['package_id' => (string)$tebexId, 'quantity' => $qty];
}

$couponCode = trim((string)($d['coupon'] ?? ''));

// Gerçek ziyaretçi IP'si (Cloudflare/proxy arkasında REMOTE_ADDR edge IP olur).
$user_ip = $_SERVER['HTTP_CF_CONNECTING_IP']
    ?? (isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]) : null)
    ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

$merchant_oid = 'PW' . (int)$user['id'] . time() . random_int(100, 999);

// --- küçük HTTP yardımcıları ---
// Minecraft mağazasında basket oluşturma kullanıcı verisi döndürdüğü için
// HTTP Basic Auth gerekir: kullanıcı adı = Public Token, şifre = Private Key.
function tebex_http($method, $url, $body = null, $auth = true) {
    global $TEBEX_PUBLIC_TOKEN, $TEBEX_PRIVATE_KEY;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Accept: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    if ($auth && $TEBEX_PUBLIC_TOKEN !== '' && $TEBEX_PRIVATE_KEY !== '') {
        curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
        curl_setopt($ch, CURLOPT_USERPWD, $TEBEX_PUBLIC_TOKEN . ':' . $TEBEX_PRIVATE_KEY);
    }
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $res = curl_exec($ch);
    $err = curl_errno($ch) ? curl_error($ch) : null;
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, json_decode((string)$res, true), $err, $res];
}

// 1) Basket oluştur (OFFLINE Minecraft mağazası: 'username' ZORUNLU).
//    Offline mağazada Tebex kullanıcı adını Mojang'a değil, offline UUID'ye çevirir;
//    yine de 'username' göndermek şarttır. Ayrıca webhook güvenli okuma için
//    'custom.username' olarak da taşıyoruz.
// NOT: Tebex offline mağaza kullanıcı adının geçerli Minecraft formatında olmasını
//      bekler: 1-16 karakter, sadece harf/rakam/alt çizgi (a-zA-Z0-9_). Türkçe karakter,
//      boşluk veya 16'dan uzun ad "unable to verify username" hatasına yol açar.
$mcName = (string)$user['username'];
$basketBody = [
    'ip_address'             => $user_ip,
    'complete_url'           => $TEBEX_COMPLETE_URL,
    'cancel_url'             => $TEBEX_CANCEL_URL,
    'complete_auto_redirect' => true,
    'custom'                 => ['username' => $mcName, 'merchant_oid' => $merchant_oid, 'user_id' => (int)$user['id']],
];
// Sadece Minecraft (Java/premium) mağazada üst düzey username gönderilir; Universal'da
// gönderilmez (aksi halde Tebex "unable to verify username" hatası verir).
if (($TEBEX_STORE_TYPE ?? 'universal') === 'minecraft') {
    $basketBody['username'] = $mcName;
}
[$c1, $b1, $e1, $raw1] = tebex_http('POST', "$TEBEX_HEADLESS_ACCOUNTS/" . rawurlencode($TEBEX_PUBLIC_TOKEN) . "/baskets", $basketBody);

// Teşhis logu — sorun sürerse tam olarak ne gönderdik / ne döndü görmek için.
@file_put_contents(__DIR__ . '/tebex_create.log',
    date('c') . "  REQ user='" . $mcName . "' len=" . strlen($mcName) .
    " token=" . substr($TEBEX_PUBLIC_TOKEN, 0, 6) . "..." .
    "  HTTP=$c1  RESP=" . substr((string)$raw1, 0, 400) . "\n", FILE_APPEND);

if ($e1) pw_fail('Tebex bağlantı hatası (basket): ' . $e1);
$basket = $b1['data'] ?? null;
$ident  = $basket['ident'] ?? '';
if ($c1 >= 300 || $ident === '')
    pw_fail('Tebex basket oluşturulamadı (kullanıcı adı="' . $mcName . '", uzunluk=' . strlen($mcName) . '): ' . mb_substr(is_string($raw1) ? strip_tags($raw1) : json_encode($b1), 0, 200));

// 2) Bekleyen sepeti kaydet — finalize dönüşte buradan paketleri ekleyecek.
mysqli_query($link, "CREATE TABLE IF NOT EXISTS pw_tebex_pending (
    ident        VARCHAR(64) PRIMARY KEY,
    user_id      INT NOT NULL,
    username     VARCHAR(32) NOT NULL,
    items        TEXT NOT NULL,
    coupon       VARCHAR(64) NULL,
    coins        INT NOT NULL,
    amount       INT NOT NULL,
    merchant_oid VARCHAR(64) NOT NULL,
    created_at   BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$itemsJson = json_encode($tebexLines);
$now = (string) round(microtime(true) * 1000);
$uid = (int)$user['id']; $uname = $user['username'];
$pp = mysqli_prepare($link, "REPLACE INTO pw_tebex_pending
    (ident,user_id,username,items,coupon,coins,amount,merchant_oid,created_at) VALUES (?,?,?,?,?,?,?,?,?)");
mysqli_stmt_bind_param($pp, "sisssiiss", $ident, $uid, $uname, $itemsJson, $couponCode, $coinsTotal, $amountTotal, $merchant_oid, $now);
mysqli_stmt_execute($pp);
mysqli_stmt_close($pp);

// pw_payments bekleyen kayıt (webhook bunu 'paid' yapacak — custom.merchant_oid ile).
pw_ensure_payments_table($link);
$ins = mysqli_prepare($link,
    "INSERT INTO pw_payments (merchant_oid, user_id, username, package_id, coins, amount, coupon, status, created_at)
     VALUES (?,?,?,?,?,?,?, 'pending', ?)");
$pidJoined = substr(implode(',', $idParts), 0, 128);
mysqli_stmt_bind_param($ins, "sississs", $merchant_oid, $uid, $uname, $pidJoined, $coinsTotal, $amountTotal, $couponCode, $now);
mysqli_stmt_execute($ins);
mysqli_stmt_close($ins);

// 3) Basket auth linkini al. Universal/çoğu mağazada müşteri, paket eklemeden ÖNCE
//    basket'i yetkilendirmeli. returnUrl = tebex_finalize.php (dönüşte paketleri ekler).
$returnUrl = 'https://pokewing.com/api/tebex_finalize.php?ident=' . rawurlencode($ident);
[$ca, $ba, $ea, $rawa] = tebex_http('GET',
    "$TEBEX_HEADLESS_ACCOUNTS/" . rawurlencode($TEBEX_PUBLIC_TOKEN) . "/baskets/" . rawurlencode($ident) . "/auth?returnUrl=" . rawurlencode($returnUrl));
@file_put_contents(__DIR__ . '/tebex_create.log', date('c') . "  AUTH HTTP=$ca RESP=" . substr((string)$rawa, 0, 300) . "\n", FILE_APPEND);

$authUrl = '';
if (is_array($ba)) {
    $arr = (isset($ba['data']) && is_array($ba['data'])) ? $ba['data'] : $ba;
    if (isset($arr[0]['url'])) $authUrl = (string)$arr[0]['url'];
}

// Auth gerekiyorsa müşteriyi oraya yönlendir; dönüşte finalize paketleri ekleyip checkout'a götürür.
if ($authUrl !== '') {
    pw_json(['success' => true, 'authUrl' => $authUrl, 'ident' => $ident]);
}

// 4) Auth gerekmiyorsa (link boş): paketleri hemen ekle + checkout (yedek akış).
$lastBasket = $basket;
foreach ($tebexLines as $line) {
    [$c2, $b2, $e2, $raw2] = tebex_http('POST', "$TEBEX_HEADLESS_BASKETS/" . rawurlencode($ident) . "/packages", $line);
    if ($e2) pw_fail('Tebex bağlantı hatası (paket ekle): ' . $e2);
    if ($c2 >= 300)
        pw_fail('Tebex pakete eklenemedi (id=' . $line['package_id'] . '): ' . mb_substr(is_string($raw2) ? strip_tags($raw2) : json_encode($b2), 0, 200));
    if (isset($b2['data'])) $lastBasket = $b2['data'];
}
if ($couponCode !== '') {
    tebex_http('POST', "$TEBEX_HEADLESS_BASKETS/" . rawurlencode($ident) . "/coupons", ['coupon_code' => $couponCode]);
}
$checkoutUrl = $lastBasket['links']['checkout'] ?? '';
if ($checkoutUrl === '') {
    [$c4, $b4] = tebex_http('GET', "$TEBEX_HEADLESS_ACCOUNTS/" . rawurlencode($TEBEX_PUBLIC_TOKEN) . "/baskets/" . rawurlencode($ident));
    $checkoutUrl = $b4['data']['links']['checkout'] ?? '';
}
if ($checkoutUrl === '') pw_fail('Tebex checkout linki alınamadı.');

pw_json([
    'success'     => true,
    'checkoutUrl' => $checkoutUrl,
    'ident'       => $ident,
]);
