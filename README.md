# FireWing Launcher

Electron tabanlı launcher. Ana mod paketi ile oyuncu modları ayrı klasörlerde tutulur.

```
%APPDATA%/FireWingLauncher/
  mods/       ana paket (salt okunur, launcher yönetir)
  usermods/   oyuncu modları + usermods.json (kaynak, sürüm, hash)
  game/mods/  her başlatmada mods/ + açık usermods/ ile yeniden kurulur
```

Mod kaynakları: Modrinth (anahtarsız) ve CurseForge (Ayarlar'da API anahtarı gerekir).

## Çalıştırma
```
npm install
npm start
```

## Henüz bağlı olmayanlar
- `src/launch.js`: Minecraft/NeoForge indirme, giriş ve java ile başlatma (şu an yalnızca mod klasörünü hazırlar).
- Kontrol Paneli, Destek, Duyurular, Kullanıcılar: sunucu API'si yok; veriler yerel `data.json`'da tutulur.
