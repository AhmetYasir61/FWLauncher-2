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

Mevcut veritabanını (AuthMe `authme` tablosu ve `pw_*` tabloları) taşıman yeterli. `pw_*` tabloların çoğu ilk kullanımda otomatik oluşturulur, eksikler `api/pw_schema.sql` içinde.

Apache kullanıyorsan `api/.htaccess` dosyası market yönlendirmelerini ve gizli dosya korumasını zaten içerir.
