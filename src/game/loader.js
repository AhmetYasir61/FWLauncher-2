// Mod yükleyicileri. NeoForge/Forge resmi kurucularını komut satırından çalıştırır, Fabric'i meta servisinden kurar.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dl = require('./download');
const { versionFile } = require('./minecraft');

const NEO_META = 'https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml';
const NEO_JAR = (v) => `https://maven.neoforged.net/releases/net/neoforged/neoforge/${v}/neoforge-${v}-installer.jar`;
const FORGE_PROMOS = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
const FORGE_JAR = (mc, v) => `https://maven.minecraftforge.net/net/minecraftforge/forge/${mc}-${v}/forge-${mc}-${v}-installer.jar`;
const FABRIC = 'https://meta.fabricmc.net/v2/versions/loader/';

// 1.21.4 → "21.4." ; 1.21 → "21.0."
const neoPrefix = (mc) => { const [, a, b = '0'] = mc.split('.'); return `${a}.${b}.`; };

async function latestNeoForge(mc) {
  const res = await fetch(NEO_META);
  if (!res.ok) throw new Error('NeoForge sürüm listesi alınamadı.');
  const all = [...(await res.text()).matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1]);
  const pre = neoPrefix(mc);
  const list = all.filter((v) => v.startsWith(pre) && !/beta|alpha/i.test(v));
  if (!list.length) throw new Error(`Minecraft ${mc} için NeoForge bulunamadı.`);
  return list.sort((x, y) => +x.slice(pre.length).split('.')[0] - +y.slice(pre.length).split('.')[0] || x.localeCompare(y, undefined, { numeric: true })).pop();
}

function runInstaller(java, installer, mcDir, onLine) {
  // Kurucu, hedef klasörde launcher_profiles.json olmasını bekler.
  const lp = path.join(mcDir, 'launcher_profiles.json');
  if (!fs.existsSync(lp)) fs.writeFileSync(lp, JSON.stringify({ profiles: {} }));
  return new Promise((resolve, reject) => {
    const p = spawn(java, ['-jar', installer, '--install-client', mcDir], { cwd: path.dirname(installer), windowsHide: true });
    const feed = (b) => String(b).split(/\r?\n/).filter(Boolean).forEach(onLine);
    p.stdout.on('data', feed); p.stderr.on('data', feed);
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Yükleyici kurulumu başarısız (kod ${code}).`))));
  });
}

// Kurulu sürümün kimliğini döndürür (versions/<kimlik>/<kimlik>.json).
async function ensureLoader({ mcDir, cacheDir, mc, loader, installerUrl, java, onProgress }) {
  if (!loader || loader === 'vanilla') return mc;

  if (loader === 'fabric') {
    const lv = (await dl.json(FABRIC + mc))[0];
    if (!lv) throw new Error(`Minecraft ${mc} için Fabric bulunamadı.`);
    const profile = await dl.json(`${FABRIC}${mc}/${lv.loader.version}/profile/json`);
    const f = versionFile(mcDir, profile.id);
    if (!fs.existsSync(f)) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(profile)); }
    return profile.id;
  }

  let id, url;
  if (loader === 'neoforge') {
    const fromUrl = installerUrl && (installerUrl.match(/neoforge-([^/]+)-installer\.jar/) || [])[1];
    const v = fromUrl || await latestNeoForge(mc);
    id = `neoforge-${v}`; url = installerUrl || NEO_JAR(v);
  } else if (loader === 'forge') {
    const fromUrl = installerUrl && (installerUrl.match(/forge-[^-/]+-([^/]+)-installer\.jar/) || [])[1];
    let v = fromUrl;
    if (!v) { const promos = (await dl.json(FORGE_PROMOS)).promos || {}; v = promos[`${mc}-recommended`] || promos[`${mc}-latest`]; }
    if (!v) throw new Error(`Minecraft ${mc} için Forge bulunamadı.`);
    id = `${mc}-forge-${v}`; url = installerUrl || FORGE_JAR(mc, v);
  } else {
    throw new Error(`${loader} yükleyicisi desteklenmiyor (neoforge, forge, fabric veya vanilla).`);
  }

  if (fs.existsSync(versionFile(mcDir, id))) return id;
  onProgress(`${loader === 'neoforge' ? 'NeoForge' : 'Forge'} indiriliyor…`);
  const installer = path.join(cacheDir, path.basename(new URL(url).pathname));
  await dl.file(url, installer);
  onProgress(`${loader === 'neoforge' ? 'NeoForge' : 'Forge'} kuruluyor (birkaç dakika sürebilir)…`);
  await runInstaller(java, installer, mcDir, (line) => { if (/Processor|Downloading|Extracting|Patching/i.test(line)) onProgress(line.slice(0, 90)); });
  if (!fs.existsSync(versionFile(mcDir, id))) {
    // Kurucu farklı bir adla kurmuş olabilir; en yeni eşleşeni bul.
    const found = fs.readdirSync(path.join(mcDir, 'versions')).filter((d) => d.includes(loader)).sort().pop();
    if (!found) throw new Error('Yükleyici kuruldu ama sürüm dosyası bulunamadı.');
    return found;
  }
  return id;
}

module.exports = { ensureLoader, latestNeoForge };
