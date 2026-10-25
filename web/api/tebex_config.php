<?php
// ============================================================
//  Tebex ayarları (paytr_config.php muadili).
//  ÖNCELİK: Admin panelden kaydedilen ayarlar (pw_tebex_config)
//  dosya/ENV değerlerinin ÜZERİNE yazılır.
//  Değerleri Tebex panelinden al:
//    - publicToken : Developers > API Keys > Public Token (webstore)
//    - privateKey  : Developers > API Keys > Secret/Private Key (opsiyonel)
//    - webhookSecret: Developers > Webhooks > Endpoints (endpoint'in secret'ı)
// ============================================================

require_once __DIR__ . '/fw_secrets.php';
$TEBEX_PUBLIC_TOKEN   = fw_secret('tebex_public_token');
$TEBEX_PRIVATE_KEY    = fw_secret('tebex_private_key');
require_once __DIR__ . '/fw_secrets.php';
$TEBEX_WEBHOOK_SECRET = fw_secret('tebex_webhook_secret');

// Mağaza tipi: 'universal' → basket'e username GÖNDERİLMEZ (doğrulama yok, önerilen).
//              'minecraft' → basket'e username gönderilir (Java/premium mağazalar için).
// Cracked/offline sunucularda 'universal' kullan; teslimat webhook ile yapılır.
$TEBEX_STORE_TYPE = getenv('TEBEX_STORE_TYPE') ?: 'minecraft';

// Ödeme sonrası dönüş sayfaları (Headless basket bunları kullanır).
$TEBEX_COMPLETE_URL = 'https://firewing.store/api/tebex_result.php?status=ok';
$TEBEX_CANCEL_URL   = 'https://firewing.store/api/tebex_result.php?status=fail';

// Headless API taban adresleri (resmi).
$TEBEX_HEADLESS_ACCOUNTS = 'https://headless.tebex.io/api/accounts';  // /{token}/baskets ...
$TEBEX_HEADLESS_BASKETS  = 'https://headless.tebex.io/api/baskets';   // /{ident}/packages ...

// --- Panelden kaydedilen ayarları oku (varsa dosya/ENV'i ezer) ---
if (isset($link) && $link) {
    mysqli_query($link, "
        CREATE TABLE IF NOT EXISTS pw_tebex_config (
            id             INT NOT NULL PRIMARY KEY,
            public_token   VARCHAR(64)  NOT NULL DEFAULT '',
            private_key    VARCHAR(128) NOT NULL DEFAULT '',
            webhook_secret VARCHAR(128) NOT NULL DEFAULT '',
            updated_at     BIGINT       NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $r = mysqli_query($link, "SELECT public_token, private_key, webhook_secret FROM pw_tebex_config WHERE id = 1 LIMIT 1");
    if ($r && ($row = mysqli_fetch_assoc($r))) {
        if ($row['public_token']   !== '') $TEBEX_PUBLIC_TOKEN   = $row['public_token'];
        if ($row['private_key']    !== '') $TEBEX_PRIVATE_KEY    = $row['private_key'];
        if ($row['webhook_secret'] !== '') $TEBEX_WEBHOOK_SECRET = $row['webhook_secret'];
    }
}

// Ödeme başlatılabilir mi? Basket oluşturma HTTP Basic Auth (public token + private key)
// gerektirdiği için ikisi de dolu olmalı.
function pw_tebex_configured() {
    global $TEBEX_PUBLIC_TOKEN, $TEBEX_PRIVATE_KEY;
    return $TEBEX_PUBLIC_TOKEN !== '' && $TEBEX_PRIVATE_KEY !== '';
}
