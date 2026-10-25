# FireWing Launcher

FireWing Network için Electron tabanlı launcher. Hesap, haberler, mağaza, destek ve yönetim paneli
FireWing API'sine (`web/api`) bağlıdır; oyuncunun kendi modları bu bilgisayarda yönetilir.

```
%APPDATA%/FireWingLauncher/
  mods/          ana paket: panelde "Launcher Sürümleri"nde tanımlı zip'ten otomatik iner
  usermods/      oyuncunun modları + usermods.json (kaynak, sürüm, hash)
  usershaders/   oyuncunun gölgelendiricileri
  userpacks/     oyuncunun kaynak paketleri
  game/          her başlatmada ana paket + açık kullanıcı içerikleriyle yeniden kurulur
```

- Giriş: oyundaki (AuthMe) kullanıcı adı ve şifre → `login.php`. Oturum belirteci sadece ana süreçte tutulur.
- Ana mod paketi: `Versions/modpacks.json` → seçili paketin `ZipUrl` adresindeki .jar dosyaları `mods/` klasörüne kurulur. Sürüm değişince yeniden iner.
- Mod mağazası: Modrinth (anahtarsız) ve CurseForge (Ayarlar > Modlar'da API anahtarı).
- API adresi: Ayarlar > Sunucu (varsayılan `https://firewing.store/api`).

## Çalıştırma
```
npm install
npm start
```

## Web sitesi
`web/` klasöründe; kurulum için `web/README.md`.

## OYNA'ya basınca ne olur
1. Panelde seçili sunucu paketi (`Versions/modpacks.json`) okunur, sürümü değiştiyse zip'teki modlar `mods/` klasörüne kurulur.
2. Ana paket + açık kullanıcı modları, gölgelendiriciler ve kaynak paketleri `game/` klasörüne hazırlanır.
3. Gereken Java sürümü bulunur; yoksa Adoptium'dan (veya paketteki `JavaUrl` adresinden) `runtime/` klasörüne indirilir.
4. Minecraft (istemci, kütüphaneler, oyun dosyaları) Mojang'ın sunucularından `minecraft/` klasörüne indirilir.
5. Yükleyici kurulur: NeoForge ve Forge resmi kurucularıyla (`--install-client`), Fabric meta servisinden.
6. Oyun çevrimdışı (AuthMe) hesapla başlar ve paketteki `ServerIp:ServerPort` adresine otomatik bağlanır.
   Launcher oturumu oyuna `-Dfirewing.username/token/hwid` JVM özellikleriyle ve `game/firewing_session.json` dosyasıyla verilir.

Her şey bir kez indirilir; sonraki açılışlarda sadece eksik veya değişen dosyalar iner.
Oyun çıktısı `game/logs/launcher.log` dosyasına yazılır (en fazla 20 MB).
