<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$user = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$user) pw_fail('Oturum geçersiz.');

pw_json([
    'success'  => true,
    'username' => $user['username'],
    'role'     => $user['role'],
    'coins'    => $user['coins'],
    'isAdmin'  => pw_is_admin($user),
]);
