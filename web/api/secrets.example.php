<?php
// Bu dosyayı secrets.php adıyla kopyala ve değerleri doldur. secrets.php ASLA repoya eklenmez.
return [
    'db_host'              => 'localhost',
    'db_user'              => '',
    'db_password'          => '',
    'db_name'              => '',
    'depo_key'             => '',   // Minecraft mod/eklentisinin API'ye bağlanırken kullandığı ortak anahtar
    'tebex_public_token'   => '',   // Tebex panelinden de kaydedilebilir
    'tebex_private_key'    => '',
    'tebex_webhook_secret' => '',   // Tebex panelinde webhook gizli anahtarı (panelden de kaydedilebilir)
    'smtp_user'            => '',   // şifre sıfırlama e-postaları için
    'smtp_password'        => '',
    'mc_host'              => 'play.firewing.store',
    'mc_port'              => '25565',
];
