const path = require('path');
const fs = require('fs');
const { app } = require('electron');

// Windows: %APPDATA%\FireWingLauncher
const root = () => path.join(app.getPath('userData'));

function dirs() {
  const r = root();
  const d = {
    root: r,
    // Ana paket: sunucunun zorunlu modları. Launcher yönetir, oyuncu değiştirmez.
    mainMods: path.join(r, 'mods'),
    // Oyuncunun kendi modları. Ana paketten tamamen ayrı.
    userMods: path.join(r, 'usermods'),
    userModsIndex: path.join(r, 'usermods', 'usermods.json'),
    // Gölgelendirici ve kaynak paketleri de ana oyun klasöründen ayrı tutulur.
    userShaders: path.join(r, 'usershaders'),
    userPacks: path.join(r, 'userpacks'),
    gameShaders: path.join(r, 'game', 'shaderpacks'),
    gamePacks: path.join(r, 'game', 'resourcepacks'),
    // Oyunun gerçekten okuduğu klasör; her başlatmada yeniden kurulur.
    gameDir: path.join(r, 'game'),
    gameMods: path.join(r, 'game', 'mods'),
    cache: path.join(r, 'cache'),
    // Minecraft sürümleri, kütüphaneler ve assets (tüm profiller ortak kullanır)
    mcDir: path.join(r, 'minecraft'),
    runtime: path.join(r, 'runtime'),
    settings: path.join(r, 'launcher.json')
  };
  for (const k of ['mainMods', 'userMods', 'userShaders', 'userPacks', 'gameMods', 'gameShaders', 'gamePacks', 'cache', 'mcDir', 'runtime']) fs.mkdirSync(d[k], { recursive: true });
  return d;
}

module.exports = { dirs };
