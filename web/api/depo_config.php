<?php
// ============================================================
//  Depo (plugin teslimat) ortak gizli anahtarı.
//  Plugin'in config.yml > key değeriyle BİREBİR AYNI olmalı.
//  Uzun, rastgele bir değer kullan (örn. 40+ karakter).
// ============================================================
require_once __DIR__ . '/fw_secrets.php';
$DEPO_KEY = fw_secret('depo_key');
