const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { dirs } = require('./paths');
const settings = require('./settings');
const manager = require('./mods/manager');
const remote = require('./remote');

// Panelden yönetilen ana mod paketini (Versions/modpacks.json → ZipUrl) indirip mods/ klasörüne kurar.
// Sürüm değişmediyse tekrar indirmez.
async function syncMainPack(onProgress) {
  const s = settings.get();
  const list = await remote.packs();
  const pack = list.find((p) => p.Id === s.packId) || list[0];
  if (!pack) return null;
  settings.set({ packId: pack.Id, profile: { ...s.profile, name: pack.Name || s.profile.name, mcVersion: pack.McVersion || s.profile.mcVersion, loader: (pack.Loader || s.profile.loader).toLowerCase() } });
  const stamp = `${pack.Id}@${pack.Version}@${pack.ZipUrl}`;
  if (!pack.ZipUrl || s.packVersion === stamp) return pack;

  onProgress({ step: `${pack.Name} mod paketi indiriliyor…`, percent: 10 });
  const res = await fetch(pack.ZipUrl);
  if (!res.ok) throw new Error(`Mod paketi indirilemedi (${res.status}).`);
  const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
  onProgress({ step: 'Mod paketi kuruluyor…', percent: 40 });

  const d = dirs();
  for (const f of fs.readdirSync(d.mainMods)) if (f.endsWith('.jar')) fs.rmSync(path.join(d.mainMods, f), { force: true });
  let n = 0;
  for (const e of zip.getEntries()) {
    if (e.isDirectory || !e.entryName.toLowerCase().endsWith('.jar')) continue;
    // Zip içindeki klasör yapısından bağımsız, sadece dosya adını kullan (dışarı yazma riskine karşı).
    fs.writeFileSync(path.join(d.mainMods, path.basename(e.entryName)), e.getData());
    n++;
  }
  settings.set({ packVersion: stamp });
  onProgress({ step: `${n} mod kuruldu.`, percent: 55 });
  return pack;
}

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
    for (const m of manager.readIndex().filter((x) => x.kind === 'mod' && x.enabled && !placed.has(x.fileName))) {
      fs.copyFileSync(path.join(d.userMods, m.fileName), path.join(d.gameMods, m.fileName));
      placed.add(m.fileName);
    }
  }
  // Gölgelendirici ve kaynak paketleri: açık olanlar oyun klasörlerine kopyalanır.
  for (const [dir, kind, from] of [[d.gameShaders, 'shader', d.userShaders], [d.gamePacks, 'pack', d.userPacks]]) {
    for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
    for (const m of manager.readIndex().filter((x) => x.kind === kind && x.enabled)) fs.copyFileSync(path.join(from, m.fileName), path.join(dir, m.fileName));
  }
  return [...placed];
}

// TODO: Gerçek Minecraft başlatma (sürüm/NeoForge indirme ve java çalıştırma) buraya bağlanacak.
async function start(onProgress) {
  onProgress({ step: 'Sunucu paketi kontrol ediliyor…', percent: 5 });
  try { await syncMainPack(onProgress); } catch (e) { onProgress({ step: `Paket güncellenemedi: ${e.message}`, percent: 5 }); }
  onProgress({ step: 'Modlar hazırlanıyor…', percent: 70 });
  const mods = prepareMods();
  onProgress({ step: `${mods.length} mod hazır. Oyun başlatıcı henüz bağlı değil.`, percent: 100 });
  return { mods };
}

module.exports = { prepareMods, syncMainPack, start };
