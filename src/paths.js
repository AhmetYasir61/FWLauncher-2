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
    // Oyunun gerçekten okuduğu klasör; her başlatmada yeniden kurulur.
    gameDir: path.join(r, 'game'),
    gameMods: path.join(r, 'game', 'mods'),
    cache: path.join(r, 'cache'),
    settings: path.join(r, 'launcher.json')
  };
  for (const k of ['mainMods', 'userMods', 'gameMods', 'cache']) fs.mkdirSync(d[k], { recursive: true });
  return d;
}

module.exports = { dirs };
