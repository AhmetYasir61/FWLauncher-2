<?php
/* ============================================================================
 *  tebex_webhook.php  —  Tebex bildirim (webhook) — PayTR callback muadili
 * ----------------------------------------------------------------------------
 *  paytr_callback.php'nin Tebex karşılığı. Coin SADECE burada, ödeme Tebex
 *  tarafından onaylanınca yüklenir. PCoin = authme.coins (aynı sütun).
 *
 *  Tebex panelinde:  Developers > Webhooks > Endpoints > Add Endpoint
 *     URL:   https://pokewing.com/api/tebex_webhook.php
 *     Types: en az "Payment Completed" (+ istersen refunded/chargeback)
 *  Eklerken "validation.webhook" gelir; aşağıda otomatik yanıtlanır.
 *  Sonra Endpoints sayfasında "Validate" butonuna bas.
 *
 *  Doğrulama (Tebex resmi yöntemi):
 *     X-Signature = HMAC-SHA256( SHA256(json_body), webhook_secret )
 *  Ayrıca Tebex sadece 18.209.80.3 ve 54.87.231.232 IP'lerinden yollar.
 * ==========================================================================*/

require_once "config.php";        // $link
require_once "tebex_config.php";  // $TEBEX_WEBHOOK_SECRET, pw_tebex_*()
@include_once "coin_packages.php";// pw_coin_packages() (varsa) — coins kaynağı

$LOG_FILE = __DIR__ . "/tebex_webhook.log";
function twlog($f, $m) { @file_put_contents($f, date('c') . "  " . $m . "\n", FILE_APPEND); }
function tw_end($code, $body = 'OK') { http_response_code($code); echo $body; exit; }

/* ---- 0) opsiyonel IP allowlist (Cloudflare arkasındaysan gerçek IP header'dan) */
$TEBEX_IPS = ['18.209.80.3', '54.87.231.232'];
$srcIp = $_SERVER['HTTP_CF_CONNECTING_IP']
    ?? (isset($_SERVER['HTTP_X_FORWARDED_FOR']) ? trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]) : null)
    ?? $_SERVER['REMOTE_ADDR'] ?? '';
// Sadece logluyoruz; imza esas korumadır. İstersen bu iki satırı aç:
// if (defined('TEBEX_ENFORCE_IP') && TEBEX_ENFORCE_IP && !in_array($srcIp, $TEBEX_IPS, true))
//     { twlog($LOG_FILE, "BLOCK ip=$srcIp"); tw_end(404, 'Not Found'); }

/* ---- 1) ham gövde + imza ---- */
$raw = file_get_contents('php://input');
twlog($LOG_FILE, "IN ip=$srcIp " . substr($raw, 0, 1500));

$secret = $TEBEX_WEBHOOK_SECRET ?? '';
$sigHeader = $_SERVER['HTTP_X_SIGNATURE'] ?? '';
$expected  = hash_hmac('sha256', hash('sha256', $raw), $secret);
if ($secret === '' || $sigHeader === '' || !hash_equals($expected, $sigHeader)) {
    twlog($LOG_FILE, "ERR bad-signature got=$sigHeader");
    tw_end(403, 'bad signature');
}

$data = json_decode($raw, true);
if (!is_array($data)) { twlog($LOG_FILE, "ERR bad-json"); tw_end(400, 'bad json'); }

$type = $data['type'] ?? '';

/* ---- 2) validation.webhook → id'yi geri döndür ---- */
if ($type === 'validation.webhook') {
    $id = $data['id'] ?? '';
    twlog($LOG_FILE, "OK validation id=$id");
    header('Content-Type: application/json');
    tw_end(200, json_encode(['id' => $id]));
}

/* ---- 3) yalnızca tamamlanan ödeme coin yükler ---- */
if ($type !== 'payment.completed') { twlog($LOG_FILE, "SKIP type=$type"); tw_end(200, 'OK'); }

$subject = $data['subject'] ?? [];
$statusId = (int)($subject['status']['id'] ?? 0);   // 1 = Complete
if ($statusId !== 0 && $statusId !== 1) { twlog($LOG_FILE, "SKIP statusId=$statusId"); tw_end(200, 'OK'); }

$txnId = (string)($subject['transaction_id'] ?? '');
// Kullanıcı adı: Minecraft mağazasında customer.username; UNIVERSAL mağazada ise
// basket'te gönderdiğimiz custom.username alanında gelir. İkisini de kontrol et.
$username = strtolower(trim((string)(
    $subject['customer']['username']['username']
    ?? $subject['customer']['username']
    ?? $subject['custom']['username']
    ?? ''
)));
// Bazı payload'larda ürün bazında custom/variable içinde de olabilir.
if ($username === '' && !empty($subject['products'][0]['custom']['username']))
    $username = strtolower(trim((string)$subject['products'][0]['custom']['username']));
if ($txnId === '' || $username === '') { twlog($LOG_FILE, "ERR no txn/username"); tw_end(200, 'OK'); }

/* ---- 4) coin miktarını Tebex paket id'sinden çöz ----
 * Güvenilir kaynak: pw_coin_default_packages() (tebex_id + coins içerir).
 * DB'den gelen pw_coin_packages() tebex_id taşımasa bile buradan bulunur. */
function pw_tebex_coins_for($packageId) {
    // 1) default paketler (tebex_id burada tanımlı)
    if (function_exists('pw_coin_default_packages')) {
        foreach (pw_coin_default_packages() as $p) {
            if ((int)($p['tebex_id'] ?? 0) === (int)$packageId) return (int)$p['coins'];
        }
    }
    // 2) canlı paketler (varsa tebex_id taşıyorsa)
    if (function_exists('pw_coin_packages')) {
        foreach (pw_coin_packages() as $p) {
            if ((int)($p['tebex_id'] ?? 0) === (int)$packageId) return (int)$p['coins'];
        }
    }
    // 3) yedek harita: hiçbir yerde tebex_id yoksa elle yaz.
    $fallback = [
        // 7568655 => 200,
        // 7572865 => 400,
    ];
    return (int)($fallback[(int)$packageId] ?? 0);
}

$totalCoins = 0;
foreach (($subject['products'] ?? []) as $pr) {
    $pid = (int)($pr['id'] ?? 0);
    $qty = max(1, (int)($pr['quantity'] ?? 1));
    $c = pw_tebex_coins_for($pid);
    if ($c <= 0) { twlog($LOG_FILE, "WARN unmapped package id=$pid txn=$txnId"); continue; }
    $totalCoins += $c * $qty;
}
if ($totalCoins <= 0) { twlog($LOG_FILE, "ERR nothing-to-grant txn=$txnId"); tw_end(200, 'OK'); }

/* ---- 5) çift teslim koruması (transaction_id) ---- */
mysqli_query($link, "CREATE TABLE IF NOT EXISTS pw_tebex_log (
    txn VARCHAR(64) PRIMARY KEY,
    player VARCHAR(32) NOT NULL,
    coins INT NOT NULL,
    created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
$txnEsc = mysqli_real_escape_string($link, $txnId);
$dup = mysqli_query($link, "SELECT 1 FROM pw_tebex_log WHERE txn='$txnEsc' LIMIT 1");
if ($dup && mysqli_num_rows($dup) > 0) { twlog($LOG_FILE, "DUP txn=$txnId"); tw_end(200, 'OK'); }

/* ---- 6) PCoin yükle (authme.coins) ---- */
$uEsc = mysqli_real_escape_string($link, $username);
$ex = mysqli_query($link, "SELECT 1 FROM authme WHERE LOWER(username)='$uEsc' LIMIT 1");
if (!$ex || mysqli_num_rows($ex) === 0) {
    // Oyuncu yok: satın almayı KAYBETME, coins=0 ile logla (destek manuel yükler).
    twlog($LOG_FILE, "HOLD player-not-found user=$username txn=$txnId coins=$totalCoins");
    mysqli_query($link, "INSERT IGNORE INTO pw_tebex_log (txn,player,coins,created_at)
        VALUES ('$txnEsc','$uEsc',0," . round(microtime(true)*1000) . ")");
    tw_end(200, 'OK');
}

mysqli_query($link, "START TRANSACTION");
$ok1 = mysqli_query($link, "UPDATE authme SET coins = coins + $totalCoins WHERE LOWER(username)='$uEsc'");
$ok2 = mysqli_query($link, "INSERT INTO pw_tebex_log (txn,player,coins,created_at)
        VALUES ('$txnEsc','$uEsc',$totalCoins," . round(microtime(true)*1000) . ")");
if ($ok1 && $ok2) {
    mysqli_query($link, "COMMIT");
    // pw_payments'te bekleyen kayıt varsa (custom.merchant_oid) işaretle — opsiyonel.
    $moid = (string)($subject['custom']['merchant_oid'] ?? '');
    if ($moid !== '' && function_exists('pw_ensure_payments_table')) {
        pw_ensure_payments_table($link);
        $mEsc = mysqli_real_escape_string($link, $moid);
        $now = (string) round(microtime(true)*1000);
        mysqli_query($link, "UPDATE pw_payments SET status='paid', paid_at=$now WHERE merchant_oid='$mEsc' AND status='pending'");
    }
    twlog($LOG_FILE, "DELIVERED user=$username +$totalCoins coins txn=$txnId");
    tw_end(200, 'OK');
} else {
    mysqli_query($link, "ROLLBACK");
    twlog($LOG_FILE, "ERR db-fail user=$username txn=$txnId");
    tw_end(500, 'db error');
}
