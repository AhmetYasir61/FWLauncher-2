# FireWing web sitesi ve API

- `index.html`: tanıtım sayfası (sunucu durumu, haberler, mağaza, topluluk, indirme)
- `panel.html`: oyuncu paneli (hesap, coin yükleme, mağaza, destek) ve yönetim paneli (istatistik, kullanıcılar, ürünler, duyurular, launcher sürümleri, coin paketleri, kuponlar, site ayarları, yasaklar)
- `api/`: PHP API. Launcher, site ve Minecraft eklentisi aynı API'yi kullanır.

Oyuncular AuthMe hesaplarıyla (oyundaki kullanıcı adı ve şifre) giriş yapar.

## Linux sunucuya kurulum (Ubuntu/Debian)

```bash
sudo apt install nginx php-fpm php-mysql php-curl php-mbstring mariadb-server
sudo mkdir -p /var/www/firewing
sudo cp -r web/* /var/www/firewing/
sudo cp deploy/nginx.conf /etc/nginx/sites-available/firewing   # alan adını ve PHP sürümünü düzenle
sudo ln -s /etc/nginx/sites-available/firewing /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d firewing.store -d www.firewing.store
```

### Gizli ayarlar

```bash
cd /var/www/firewing/api
sudo cp secrets.example.php secrets.php
sudo nano secrets.php          # veritabanı, DEPO_KEY, Tebex ve SMTP bilgileri
sudo chown www-data:www-data secrets.php && sudo chmod 640 secrets.php
```

`secrets.php` repoya eklenmez. Aynı değerler ortam değişkeniyle de verilebilir (`FW_DB_PASSWORD`, `FW_DEPO_KEY` gibi).

### Yazma izinleri

Launcher sürümleri `Versions/modpacks.json` dosyasına yazılır:

```bash
sudo mkdir -p /var/www/firewing/Versions && sudo chown www-data:www-data /var/www/firewing/Versions
```

### Veritabanı

Önce veritabanı ve kullanıcıyı oluştur (`mariadb` komutuyla açılan ekrana yaz):

```sql
CREATE DATABASE firewing CHARACTER SET utf8mb4;
CREATE USER 'firewing'@'localhost' IDENTIFIED BY 'SIFRE';
GRANT ALL ON firewing.* TO 'firewing'@'localhost';
```

Sonra tabloları kur. Eski bir yedeğin varsa önce onu içe aktar (`mariadb firewing < yedek.sql`).
Kurulum dosyası var olan veriye dokunmaz, sadece eksik tablo ve sütunları ekler:

```bash
mariadb firewing < /var/www/firewing/api/install.sql
```

Sitede kayıt olduktan sonra kendini owner yap:

```bash
mariadb firewing -e "UPDATE authme SET role='owner' WHERE username='kullanici_adin_kucuk_harfle'"
```

Minecraft sunucusundaki AuthMe eklentisi de aynı veritabanını kullanmalı (AuthMe `config.yml` → `DataSource`: `backend: MYSQL`, aynı veritabanı bilgileri, `mySQLTablename: authme`).

Apache kullanıyorsan `api/.htaccess` dosyası market yönlendirmelerini ve gizli dosya korumasını zaten içerir.
