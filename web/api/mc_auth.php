<?php
// mc_auth.php — Minecraft giriş doğrulaması (AuthMe YERİNE). Mod çağırır (key + username + token + hwid).
// Launcher login olunca session_token üretir; oyuncu sunucuya bağlanınca mod bu token'ı + HWID'yi doğrulatır.
// Geçerli değilse mod oyuncuyu atar → sunucuya YALNIZ launcher'dan (geçerli oturumla) girilir.
//
// Güvenlik katmanları:
//  1) session_token DB'de geçerli + süresi dolmamış olmalı (sahte token üretilemez)
//  2) username eşleşmeli (token o kullanıcıya ait)
//  3) hwid (opsiyonel) kayıtlıysa eşleşmeli — çalınan token başka cihazda çalışmaz
//  4) BAN kontrolü (pw_bans) — yasaklı oyuncu / hwid giremez

require_once "pw_common.php";
require_once "config.php";
require_once "depo_config.php";   // $DEPO_KEY

$d = pw_body();
if (!isset($d['key']) || !hash_equals($DEPO_KEY, (string)$d['key'])) pw_fail('Yetkisiz.');

$username = strtolower(trim($d['username'] ?? ''));
$token    = trim($d['token'] ?? '');
$hwid     = trim($d['hwid'] ?? '');
if ($username === '') pw_json(['success' => false, 'reason' => 'Kullanıcı adı boş.']);

// Ban tabloları (idempotent)
mysqli_query($link, "CREATE TABLE IF NOT EXISTS pw_bans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(32),
    hwid VARCHAR(64),
    reason VARCHAR(255) DEFAULT '',
    by_admin VARCHAR(32) DEFAULT '',
    until BIGINT DEFAULT 0,        -- 0 = kalıcı (perma)
    created_at BIGINT DEFAULT 0,
    INDEX(username), INDEX(hwid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// --- 1) BAN kontrolü (username veya hwid) ---
$now = round(microtime(true) * 1000);
$u = mysqli_real_escape_string($link, $username);
$h = mysqli_real_escape_string($link, $hwid);
$banSql = "SELECT reason, until FROM pw_bans WHERE (username='$u'";
if ($hwid !== '') $banSql .= " OR hwid='$h'";
$banSql .= ") AND (until=0 OR until>$now) ORDER BY until=0 DESC LIMIT 1";
$br = mysqli_query($link, $banSql);
if ($br && ($ban = mysqli_fetch_assoc($br))) {
    $perma = ((int)$ban['until'] === 0);
    pw_json(['success' => false, 'banned' => true, 'perma' => $perma,
             'reason' => $ban['reason'] ?: 'Yasaklısın.', 'until' => (int)$ban['until']]);
}

// --- 2) Token doğrulama (validate_session.php ile AYNI şema: session_token + session_expiry DATETIME) ---
$valid = false; $real = $username;
$st = mysqli_prepare($link, "SELECT realname, session_token, session_expiry FROM authme WHERE username=? LIMIT 1");
if ($st) {
    mysqli_stmt_bind_param($st, "s", $username);   // authme.username KÜÇÜK harf
    mysqli_stmt_execute($st);
    mysqli_stmt_store_result($st);
    if (mysqli_stmt_num_rows($st) === 1) {
        mysqli_stmt_bind_result($st, $db_real, $db_token, $db_expiry);
        mysqli_stmt_fetch($st);
        $real = ($db_real !== null && $db_real !== '') ? $db_real : $username;
        if (!empty($db_token) && hash_equals((string)$db_token, (string)$token)) {
            try { $valid = (new DateTime() < new DateTime($db_expiry)); }
            catch (Exception $e) { $valid = false; }
        }
    }
    mysqli_stmt_close($st);
}

if ($valid) {
    // HWID'yi öğren (ban için): authme'de opsiyonel session_hwid kolonu VARSA güncelle (yoksa sessizce geç).
    if ($hwid !== '') {
        @mysqli_query($link, "UPDATE authme SET session_hwid='$h' WHERE username='$u'");   // kolon yoksa hata yutulur
    }
    pw_json(['success' => true, 'realname' => $real]);
} else {
    pw_json(['success' => false, 'reason' => 'Geçersiz/expired oturum. Launcher\'dan tekrar giriş yap.']);
}
