-- FireWing veritabanı kurulumu. Tekrar çalıştırmak güvenlidir: var olan tablo ve veriye dokunmaz,
-- sadece eksik tablo ve sütunları ekler. Kullanım:  mariadb firewing < install.sql
-- (Kalan pw_* tabloları API ilk kullanımda kendisi oluşturur.)

-- AuthMe eklentisinin standart tablosu (eklenti MySQL ile çalışıyorsa zaten vardır)
CREATE TABLE IF NOT EXISTS authme (
  id MEDIUMINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  realname VARCHAR(255) NOT NULL,
  password VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ip VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin,
  lastlogin BIGINT,
  x DOUBLE NOT NULL DEFAULT 0, y DOUBLE NOT NULL DEFAULT 0, z DOUBLE NOT NULL DEFAULT 0,
  world VARCHAR(255) NOT NULL DEFAULT 'world',
  regdate BIGINT NOT NULL DEFAULT 0,
  regip VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin,
  yaw FLOAT, pitch FLOAT,
  email VARCHAR(255),
  isLogged SMALLINT NOT NULL DEFAULT 0,
  hasSession SMALLINT NOT NULL DEFAULT 0,
  totp VARCHAR(32)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Launcher ve sitenin AuthMe tablosuna eklediği sütunlar
ALTER TABLE authme
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'player',
  ADD COLUMN IF NOT EXISTS coins INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS session_token VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS session_expiry DATETIME NULL,
  ADD COLUMN IF NOT EXISTS session_hwid VARCHAR(64) NULL;

CREATE TABLE IF NOT EXISTS pw_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(60) NOT NULL DEFAULT 'Genel',
  type VARCHAR(20) NOT NULL DEFAULT 'item',
  price INT NOT NULL DEFAULT 0,
  description TEXT NULL,
  long_desc TEXT NULL,
  badge VARCHAR(40) NULL,
  image_url VARCHAR(500) NULL,
  gallery TEXT NULL,
  command TEXT NULL,
  kit_commands TEXT NULL,
  slots INT NOT NULL DEFAULT 1,
  stock INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pw_ads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  badge VARCHAR(40) NULL,
  image_url VARCHAR(500) NULL,
  url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pw_settings (
  skey VARCHAR(64) NOT NULL PRIMARY KEY,
  svalue TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pw_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player VARCHAR(32) NOT NULL,
  player_name VARCHAR(32) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  assigned VARCHAR(32) NULL,
  assigned_name VARCHAR(32) NULL,
  rating INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0,
  updated_at BIGINT NOT NULL DEFAULT 0,
  closed_at BIGINT NULL,
  INDEX (player), INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pw_ticket_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  sender VARCHAR(32) NOT NULL,
  sender_name VARCHAR(32) NOT NULL,
  sender_role VARCHAR(20) NULL,
  body TEXT NOT NULL,
  created_at BIGINT NOT NULL DEFAULT 0,
  INDEX (ticket_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pw_deliveries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player VARCHAR(32) NOT NULL,
  command TEXT NOT NULL,
  product_name VARCHAR(120) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL DEFAULT 0,
  delivered_at BIGINT NULL,
  INDEX (player), INDEX (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pw_moderation (
  username VARCHAR(32) NOT NULL PRIMARY KEY,
  banned TINYINT NOT NULL DEFAULT 0,
  warn_until BIGINT NOT NULL DEFAULT 0,
  reason VARCHAR(255) NULL,
  updated_by VARCHAR(32) NULL,
  updated_at BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pw_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_user VARCHAR(32) NULL,
  to_user VARCHAR(32) NULL,
  amount INT NOT NULL DEFAULT 0,
  type VARCHAR(40) NULL,
  ref VARCHAR(200) NULL,
  created_at VARCHAR(20) NULL,
  INDEX (from_user), INDEX (to_user)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
