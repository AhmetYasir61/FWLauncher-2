<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$user) pw_fail('Oturum geçersiz.');

$to = strtolower(trim($d['toUsername'] ?? ''));
$amount = (int)($d['amount'] ?? 0);
if ($to === '' || $amount <= 0) pw_fail('Geçersiz alıcı veya tutar.');

// Alıcıyı bul
$stmt = mysqli_prepare($link, "SELECT id, realname, coins FROM authme WHERE username = ?");
mysqli_stmt_bind_param($stmt, "s", $to);
mysqli_stmt_execute($stmt);
mysqli_stmt_store_result($stmt);
if (mysqli_stmt_num_rows($stmt) != 1) pw_fail('Alıcı bulunamadı.');
mysqli_stmt_bind_result($stmt, $rid, $rname, $rcoins);
mysqli_stmt_fetch($stmt);
mysqli_stmt_close($stmt);

$admin  = pw_is_admin($user);
$isSelf = ((int)$rid === $user['id']);

// Oyuncu kendine gönderemez; admin gönderebilir (kendine coin verme/grant).
if ($isSelf && !$admin) pw_fail('Kendine coin gönderemezsin.');

$returnedCoins = $user['coins'];

if ($admin) {
    // Admin: SINIRSIZ. Kaynaktan düşülmez; alıcıya eklenir.
    $rnew = (int)$rcoins + $amount;
    $u = mysqli_prepare($link, "UPDATE authme SET coins = ? WHERE id = ?");
    mysqli_stmt_bind_param($u, "ii", $rnew, $rid);
    if (!mysqli_stmt_execute($u)) pw_fail('Coin verilemedi: ' . mysqli_stmt_error($u));
    mysqli_stmt_close($u);

    // Kendine verdiyse gösterilecek bakiye yeni alıcı bakiyesidir.
    $returnedCoins = $isSelf ? $rnew : $user['coins'];
} else {
    // Oyuncu: bakiyesinden düşülür.
    if ($user['coins'] < $amount) pw_fail('Yetersiz coin.');
    $senderNew = $user['coins'] - $amount;
    $u1 = mysqli_prepare($link, "UPDATE authme SET coins = ? WHERE id = ?");
    mysqli_stmt_bind_param($u1, "ii", $senderNew, $user['id']);
    mysqli_stmt_execute($u1);
    mysqli_stmt_close($u1);

    $rnew = (int)$rcoins + $amount;
    $u2 = mysqli_prepare($link, "UPDATE authme SET coins = ? WHERE id = ?");
    mysqli_stmt_bind_param($u2, "ii", $rnew, $rid);
    mysqli_stmt_execute($u2);
    mysqli_stmt_close($u2);

    $returnedCoins = $senderNew;
}

pw_log($link, $user['username'], $rname, $amount, $admin ? 'grant' : 'transfer', '');

pw_json([
    'success' => true,
    'message' => $isSelf
        ? "Kendine {$amount} coin eklendi."
        : "{$rname} kullanıcısına {$amount} coin gönderildi." . ($admin ? ' (yönetici)' : ''),
    'coins'   => $returnedCoins,
]);
