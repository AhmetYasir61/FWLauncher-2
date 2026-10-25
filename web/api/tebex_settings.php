<?php
// ============================================================
//  Tebex ayarları — SADECE OWNER (paytr_settings.php muadili).
//  action:
//    get  → kayıtlı ayarlar + yapılandırılma durumu + webhook URL
//    save { publicToken, privateKey, webhookSecret } → kaydet
//  Ayarlar pw_tebex_config tablosunda tutulur; tebex_config.php
//  bu tabloyu ENV/dosyanın ÜZERİNE okur (panel > dosya).
// ============================================================
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');
if ($u['role'] !== 'owner') pw_fail('Tebex ayarlarını yalnız kurucu (owner) yönetebilir.');

mysqli_query($link, "
    CREATE TABLE IF NOT EXISTS pw_tebex_config (
        id             INT NOT NULL PRIMARY KEY,
        public_token   VARCHAR(64)  NOT NULL DEFAULT '',
        private_key    VARCHAR(128) NOT NULL DEFAULT '',
        webhook_secret VARCHAR(128) NOT NULL DEFAULT '',
        updated_at     BIGINT       NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");

$action = strtolower(trim($d['action'] ?? 'get'));

if ($action === 'save') {
    $pub  = trim($d['publicToken'] ?? '');
    $priv = trim($d['privateKey'] ?? '');
    $wh   = trim($d['webhookSecret'] ?? '');

    if ($pub === '') pw_fail('Public Token zorunludur (Tebex → Developers → API Keys).');

    $now = round(microtime(true) * 1000);
    $st = mysqli_prepare($link, "
        INSERT INTO pw_tebex_config (id, public_token, private_key, webhook_secret, updated_at)
        VALUES (1, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE public_token=VALUES(public_token), private_key=VALUES(private_key),
                                webhook_secret=VALUES(webhook_secret), updated_at=VALUES(updated_at)");
    mysqli_stmt_bind_param($st, "sssi", $pub, $priv, $wh, $now);
    if (!mysqli_stmt_execute($st)) pw_fail('Kaydedilemedi: ' . mysqli_stmt_error($st));
    mysqli_stmt_close($st);

    pw_json(['success' => true, 'message' => 'Tebex ayarları kaydedildi.', 'configured' => true]);
}

// action=get
$row = null;
$res = mysqli_query($link, "SELECT public_token, private_key, webhook_secret, updated_at FROM pw_tebex_config WHERE id = 1 LIMIT 1");
if ($res && mysqli_num_rows($res) === 1) $row = mysqli_fetch_assoc($res);

$configured = $row && $row['public_token'] !== '';
pw_json([
    'success'       => true,
    'configured'    => $configured,
    'publicToken'   => $row ? $row['public_token']   : '',
    'privateKey'    => $row ? $row['private_key']     : '',
    'webhookSecret' => $row ? $row['webhook_secret']  : '',
    'webhookUrl'    => 'https://firewing.store/api/tebex_webhook.php',
    'completeUrl'   => 'https://firewing.store/api/tebex_result.php?status=ok',
]);
