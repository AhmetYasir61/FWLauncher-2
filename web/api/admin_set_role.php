<?php
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u) pw_fail('Oturum geçersiz.');
if (!in_array($u['role'], ['owner','admin'], true))
    pw_fail('Yalnız owner/admin rol atayabilir.');

$target = strtolower(trim($d['target'] ?? ''));
$role   = strtolower(trim($d['role'] ?? ''));
$meRole = $u['role'];

if ($target === '') pw_fail('Hedef kullanıcı gerekli.');
if (!in_array($role, ['player','rehber','moderator','admin'], true)) pw_fail('Geçersiz rol.');
if ($target === strtolower($u['username'])) pw_fail('Kendi rolünü değiştiremezsin.');

// hedefin mevcut rolü
$te = mysqli_real_escape_string($link, $target);
$rr = mysqli_query($link, "SELECT role FROM authme WHERE username='$te' LIMIT 1");
if (!$rr || mysqli_num_rows($rr) === 0) pw_fail('Kullanıcı bulunamadı.');
$cur = strtolower(mysqli_fetch_assoc($rr)['role'] ?: 'player');

if ($cur === 'owner') pw_fail('Owner değiştirilemez.');
// admin atamak/almak yalnız owner'a özel
if (($role === 'admin' || $cur === 'admin') && $meRole !== 'owner')
    pw_fail('admin yetkisini yalnız owner verebilir/alabilir.');

$st = mysqli_prepare($link, "UPDATE authme SET role=? WHERE username=?");
mysqli_stmt_bind_param($st, "ss", $role, $target);
if (!mysqli_stmt_execute($st)) pw_fail('Rol güncellenemedi: ' . mysqli_stmt_error($st));
mysqli_stmt_close($st);

pw_json(['success' => true, 'role' => $role, 'message' => 'Rol güncellendi.']);
