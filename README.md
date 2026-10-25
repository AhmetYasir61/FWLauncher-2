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

## Henüz bağlı olmayanlar
- `src/launch.js`: Minecraft/NeoForge'un indirilmesi ve oyunun java ile başlatılması (şu an mod klasörlerini hazırlar).
