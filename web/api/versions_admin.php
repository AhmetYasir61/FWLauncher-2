<?php
// ============================================================
//  Sürümler/mod paketleri yönetimi — SADECE admin/owner.
//  Launcher'ın okuduğu /Versions/modpacks.json dosyasını site
//  editöründen düzenlenebilir yapar (kaydetmeden önce .bak alınır).
//  action: get | save { packs:[{Id,Name,Version,ZipUrl,...}] }
// ============================================================
require_once "pw_common.php";
require_once "config.php";

$d = pw_body();
$u = pw_authuser($link, $d['username'] ?? '', $d['token'] ?? '');
if (!$u || !pw_is_admin($u)) pw_fail('Yetkisiz.');

$file = dirname(__DIR__) . '/Versions/modpacks.json';   // public_html/Versions/modpacks.json

$action = strtolower(trim($d['action'] ?? 'get'));

if ($action === 'save') {
    $packs = $d['packs'] ?? null;
    if (!is_array($packs) || !count($packs)) pw_fail('En az bir paket gerekli.');
    if (count($packs) > 20) pw_fail('En fazla 20 paket tanımlanabilir.');

    // Yalnız bilinen alanlar, launcher'ın beklediği adlarla (büyük harfli) yazılır.
    $strKeys = ['Id','Name','Version','ZipUrl','LoaderInstallerUrl','ForgeInstallerUrl','JavaUrl','Description','ServerIp','Loader','McVersion','Mode'];
    $clean = [];
    $seen = [];
    foreach ($packs as $p) {
        if (!is_array($p)) continue;
        $o = [];
        foreach ($strKeys as $k) $o[$k] = isset($p[$k]) ? trim((string)$p[$k]) : '';
        $o['ServerPort'] = max(0, (int)($p['ServerPort'] ?? 25565));
        if ($o['Id'] === '' || $o['Name'] === '' || isset($seen[$o['Id']])) continue;
        $seen[$o['Id']] = true;
        if ($o['Mode'] !== '' && !in_array(strtolower($o['Mode']), ['cobblemon','roleplay'], true)) $o['Mode'] = '';
        $clean[] = $o;
    }
    if (!count($clean)) pw_fail('Geçerli paket yok (Id ve Name zorunlu, Id benzersiz olmalı).');

    if (!is_dir(dirname($file))) @mkdir(dirname($file), 0755, true);
    if (file_exists($file)) @copy($file, $file . '.bak');   // tek adım geri alma
    $json = json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (file_put_contents($file, $json) === false) pw_fail('modpacks.json yazılamadı (klasör izinlerini kontrol et).');
    pw_json(['success' => true, 'message' => 'Sürümler kaydedildi — launcher bir sonraki açılışta yeni listeyi görür.', 'packs' => $clean]);
}

// action=get
$packs = [];
if (file_exists($file)) {
    $parsed = json_decode((string)file_get_contents($file), true);
    if (is_array($parsed)) $packs = $parsed;
}
pw_json(['success' => true, 'packs' => $packs]);
