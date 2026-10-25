-- ============================================================
--  PokeWing — Depo / Kit / Katalog / Duyuru şema güncellemesi
--  phpMyAdmin veya MySQL CLI'da bir kez çalıştır.
--  Güvenli: var olan satırları bozmaz (IF NOT EXISTS / ADD COLUMN).
-- ============================================================

-- 1) pw_products: kit + katalog alanları -----------------------------
--    'command' zaten var (tekil teslim). 'kit_commands' = çoklu (kit).
ALTER TABLE `pw_products`
  ADD COLUMN IF NOT EXISTS `type`         VARCHAR(24)  NOT NULL DEFAULT 'item'  AFTER `category`,
  ADD COLUMN IF NOT EXISTS `long_desc`    TEXT         NULL                     AFTER `description`,
  ADD COLUMN IF NOT EXISTS `gallery`      TEXT         NULL                     AFTER `image_url`,
  ADD COLUMN IF NOT EXISTS `kit_commands` TEXT         NULL                     AFTER `command`,
  ADD COLUMN IF NOT EXISTS `slots`        INT          NOT NULL DEFAULT 1       AFTER `kit_commands`,
  ADD COLUMN IF NOT EXISTS `stock`        INT          NOT NULL DEFAULT -1      AFTER `slots`;
--   type     : item | kit | key | rank | coin | cosmetic  (katalog rozeti/grup)
--   long_desc: katalogda gösterilecek uzun açıklama
--   gallery  : JSON dizi — ek görsel URL'leri  ["https://...","..."]
--   kit_commands: JSON dizi — kit içeriği komutları ["give {player} ...","..."]
--                 doluysa teslimde HEPSİ çalışır; boşsa tekil 'command' kullanılır.
--   slots    : teslim için gereken boş envanter slotu (kit > 1 olabilir)
--   stock    : -1 = sınırsız;  >=0 = kalan adet (anahtar/sınırlı ürün)

-- 2) pw_depo: satın alınan ama henüz teslim alınmamış eşyalar ----------
CREATE TABLE IF NOT EXISTS `pw_depo` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT,
  `player`       VARCHAR(32)  NOT NULL,
  `product_id`   INT          NOT NULL DEFAULT 0,
  `product_name` VARCHAR(96)  NOT NULL,
  `type`         VARCHAR(24)  NOT NULL DEFAULT 'item',
  `image_url`    VARCHAR(255)          DEFAULT '',
  `description`  TEXT         NULL,
  `payload`      TEXT         NULL,          -- JSON dizi — teslimde çalışacak komutlar ({player})
  `qty`          INT          NOT NULL DEFAULT 1,
  `slots`        INT          NOT NULL DEFAULT 1,
  `status`       VARCHAR(16)  NOT NULL DEFAULT 'pending',  -- pending | claimed
  `created_at`   BIGINT       NOT NULL DEFAULT 0,
  `claimed_at`   BIGINT       NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_player_status` (`player`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Oyun-içi duyurular AYRI TABLO GEREKTİRMEZ — mevcut `pw_ads` kullanılır.
--    announce_pull.php pw_ads'i okur; admin panelin "Duyurular" sekmesinden
--    yayınladığın duyuru hem launcher'da hem oyun içinde (toast + Duyurular
--    uygulaması) otomatik görünür. Ek tablo/işlem yok.

-- 4) pw_phone: VC (sesli sohbet) oyun-içi telefon numaraları --------
CREATE TABLE IF NOT EXISTS `pw_phone` (
  `username`   VARCHAR(32) NOT NULL,
  `number`     VARCHAR(16) NOT NULL,
  `created_at` BIGINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`username`),
  UNIQUE KEY `uniq_number` (`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dev Studio yetkileri (launcher/backend tabanlı; dev_check.php okur)
CREATE TABLE IF NOT EXISTS pw_devs (
  username VARCHAR(32) PRIMARY KEY,
  role VARCHAR(16) NOT NULL DEFAULT 'dev'   -- 'owner' | 'dev'
);
INSERT IGNORE INTO pw_devs (username, role) VALUES ('yasirtasarim', 'owner');
