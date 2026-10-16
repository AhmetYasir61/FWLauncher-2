const fs = require('fs');
const path = require('path');
const { dirs } = require('./paths');
const settings = require('./settings');
const manager = require('./mods/manager');

// Oyunun okuyacağı game/mods klasörünü baştan kurar:
//  1) ana paket (her zaman)  2) açık kullanıcı modları (aynı dosya adı varsa ana paket kazanır)
function prepareMods() {
  const d = dirs();
  for (const f of fs.readdirSync(d.gameMods)) fs.rmSync(path.join(d.gameMods, f), { force: true });

  const placed = new Set();
  for (const f of fs.readdirSync(d.mainMods).filter((x) => x.endsWith('.jar'))) {
    fs.copyFileSync(path.join(d.mainMods, f), path.join(d.gameMods, f));
    placed.add(f);
  }
  if (settings.get().loadUserMods) {
    for (const m of manager.readIndex().filter((x) => x.enabled && !placed.has(x.fileName))) {
      fs.copyFileSync(path.join(d.userMods, m.fileName), path.join(d.gameMods, m.fileName));
      placed.add(m.fileName);
    }
  }
  return [...placed];
}

// TODO: Gerçek Minecraft başlatma (sürüm/NeoForge indirme, Microsoft girişi, java çalıştırma)
// buraya bağlanacak. Şimdilik mod klasörünü hazırlar ve ilerleme olayı yollar.
async function start(onProgress) {
  onProgress({ step: 'Modlar hazırlanıyor…', percent: 20 });
  const mods = prepareMods();
  onProgress({ step: `${mods.length} mod hazır. Oyun başlatıcı henüz bağlı değil.`, percent: 100 });
  return { mods };
}

module.exports = { prepareMods, start };
