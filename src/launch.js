const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { dirs } = require('./paths');
const settings = require('./settings');
const manager = require('./mods/manager');
const remote = require('./remote');
const dl = require('./game/download');
const { installVanilla, resolveVersion: mcResolve, libraryFiles } = require('./game/minecraft');
const { ensureLoader } = require('./game/loader');
const { ensureJava } = require('./game/java');
const { buildCommand, start: startGame, hwid, writeSessionFile, ensureOptions } = require('./game/run');

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

let running = null;

// OYNA: paket → modlar → Java → Minecraft → yükleyici → oyunu başlat.
// onProgress({step, percent, done?}) arayüzü bilgilendirir; oyun kapanınca done:true gönderilir.
async function start(onProgress) {
  if (running) throw new Error('Oyun zaten açık.');
  const s0 = settings.get();
  if (!s0.session) throw new Error('Oynamak için giriş yapmalısın.');
  const d = dirs();
  const P = (step, percent) => onProgress({ step, percent });

  P('Sunucu paketi kontrol ediliyor…', 3);
  let pack = null;
  try { pack = await syncMainPack(onProgress); } catch (e) { P(`Paket güncellenemedi: ${e.message}`, 5); }
  const s = settings.get();
  const mc = s.profile.mcVersion, loader = (s.profile.loader || 'vanilla').toLowerCase();

  P('Modlar hazırlanıyor…', 15);
  prepareMods();

  // Vanilla sürüm dosyası, gereken Java sürümünü söyler.
  const vanilla = await installVanilla(d.mcDir, mc, (step, f) => P(step, 25 + Math.round(f * 35)));
  const major = (vanilla.javaVersion && vanilla.javaVersion.majorVersion) || 21;
  const java = await ensureJava({ major, javaPath: s.javaPath, javaUrl: safeUrl(pack && pack.JavaUrl), runtimeDir: d.runtime, onProgress: (t) => P(t, 18) });

  const installerUrl = safeUrl(pack && (loader === 'forge' ? pack.ForgeInstallerUrl || pack.LoaderInstallerUrl : pack.LoaderInstallerUrl));
  const versionId = await ensureLoader({ mcDir: d.mcDir, cacheDir: d.cache, mc, loader, installerUrl, java, onProgress: (t) => P(t, 70) });
  if (versionId !== mc) await installVanilla(d.mcDir, mc, () => {});
  // Yükleyicinin ek kütüphaneleri (Fabric gibi kurucusuz yükleyiciler için)
  const merged = mcResolve(d.mcDir, versionId);
  const extra = libraryFiles(d.mcDir, merged.libraries).filter((x) => x.url);
  await dl.pool(extra, 8, (it) => dl.file(it.url, it.dest, it), (n, t) => P(`Yükleyici kütüphaneleri ${n}/${t}`, 80 + Math.round(n / t * 10)));

  P('Oyun başlatılıyor…', 95);
  const session = { username: s.session.username, token: s.session.token, hwid: hwid(), api: s.apiUrl };
  writeSessionFile(d.gameDir, session);
  ensureOptions(d.gameDir);
  const server = { ip: (pack && pack.ServerIp) || 'play.firewing.store', port: (pack && +pack.ServerPort) || 25565 };
  const cmd = buildCommand({ mcDir: d.mcDir, gameDir: d.gameDir, versionId, java, user: { name: s.session.username }, settings: s, server, session });
  running = startGame(cmd, (code, err) => {
    running = null;
    onProgress({ step: err ? `Oyun başlatılamadı: ${err.message}` : code === 0 ? 'Oyun kapandı.' : `Oyun beklenmedik şekilde kapandı (kod ${code}). Ayrıntı: game/logs/launcher.log`, percent: 0, done: true });
  });
  P('Oyun açık. İyi eğlenceler!', 100);
  return { versionId };
}

const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
const isRunning = () => !!running;

module.exports = { prepareMods, syncMainPack, start, isRunning };
