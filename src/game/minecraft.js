// Vanilla Minecraft: sürüm dosyası, istemci, kütüphaneler ve assets. Mojang'ın resmi biçimini izler.
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const dl = require('./download');

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const LIBS = 'https://libraries.minecraft.net/';
const RESOURCES = 'https://resources.download.minecraft.net/';
const OS = { win32: 'windows', darwin: 'osx', linux: 'linux' }[process.platform];

// Mojang kural listesi: son eşleşen kural kazanır.
function allowed(rules, features = {}) {
  if (!rules || !rules.length) return true;
  let ok = false;
  for (const r of rules) {
    let match = true;
    if (r.os) {
      if (r.os.name && r.os.name !== OS) match = false;
      if (r.os.arch === 'x86' && process.arch !== 'ia32') match = false;
    }
    if (r.features) for (const [k, v] of Object.entries(r.features)) if (!!features[k] !== v) match = false;
    if (match) ok = r.action === 'allow';
  }
  return ok;
}

// "grup:ad:sürüm[:sınıflayıcı][@uzantı]" → maven yolu
function mavenPath(name) {
  const [coords, ext = 'jar'] = name.split('@');
  const [g, a, v, c] = coords.split(':');
  return path.join(...g.split('.'), a, v, `${a}-${v}${c ? '-' + c : ''}.${ext}`);
}

const versionDir = (mc, id) => path.join(mc, 'versions', id);
const versionFile = (mc, id) => path.join(versionDir(mc, id), id + '.json');

async function fetchVersion(mc, id) {
  const file = versionFile(mc, id);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const manifest = await dl.json(MANIFEST);
  const entry = manifest.versions.find((v) => v.id === id);
  if (!entry) throw new Error(`Minecraft ${id} sürümü bulunamadı.`);
  await dl.file(entry.url, file, { sha1: entry.sha1 });
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Bir sürümün indirilmesi gereken kütüphane dosyaları (sistemimize uygun olanlar).
function libraryFiles(mc, libs) {
  const out = [];
  for (const lib of libs) {
    if (!allowed(lib.rules)) continue;
    const d = lib.downloads || {};
    if (d.artifact && d.artifact.url) out.push({ url: d.artifact.url, sha1: d.artifact.sha1, size: d.artifact.size, dest: path.join(mc, 'libraries', d.artifact.path || mavenPath(lib.name)) });
    else if (!d.artifact && !lib.natives) out.push({ url: (lib.url || LIBS).replace(/\/?$/, '/') + mavenPath(lib.name).split(path.sep).join('/'), sha1: lib.sha1, size: lib.size, dest: path.join(mc, 'libraries', mavenPath(lib.name)) });
    // Eski sürümlerin ayrı native paketleri (1.19 öncesi)
    if (lib.natives && lib.natives[OS] && d.classifiers) {
      const key = lib.natives[OS].replace('${arch}', process.arch === 'ia32' ? '32' : '64');
      const n = d.classifiers[key];
      if (n) out.push({ url: n.url, sha1: n.sha1, size: n.size, dest: path.join(mc, 'libraries', n.path), native: true, exclude: (lib.extract && lib.extract.exclude) || [] });
    }
  }
  return out;
}

async function installAssets(mc, assetIndex, onProgress) {
  const idx = path.join(mc, 'assets', 'indexes', assetIndex.id + '.json');
  await dl.file(assetIndex.url, idx, { sha1: assetIndex.sha1, size: assetIndex.size });
  const objects = Object.values(JSON.parse(fs.readFileSync(idx, 'utf8')).objects);
  const items = objects.map((o) => ({ url: `${RESOURCES}${o.hash.slice(0, 2)}/${o.hash}`, sha1: o.hash, size: o.size, dest: path.join(mc, 'assets', 'objects', o.hash.slice(0, 2), o.hash) }));
  await dl.pool(items, 16, (it) => dl.file(it.url, it.dest, it), (d, t) => onProgress && onProgress(d, t));
}

async function installVanilla(mc, id, onProgress = () => {}) {
  const v = await fetchVersion(mc, id);
  onProgress('Minecraft istemcisi indiriliyor…', 0);
  await dl.file(v.downloads.client.url, path.join(versionDir(mc, id), id + '.jar'), v.downloads.client);
  const libs = libraryFiles(mc, v.libraries);
  await dl.pool(libs, 8, (it) => dl.file(it.url, it.dest, it), (d, t) => onProgress(`Kütüphaneler ${d}/${t}`, d / t * 0.3));
  await installAssets(mc, v.assetIndex, (d, t) => { if (d % 50 === 0 || d === t) onProgress(`Oyun dosyaları ${d}/${t}`, 0.3 + d / t * 0.7); });
  return v;
}

// inheritsFrom zincirini birleştirir (NeoForge/Forge/Fabric sürümleri vanilla'nın üstüne kurulur).
function resolveVersion(mc, id) {
  const v = JSON.parse(fs.readFileSync(versionFile(mc, id), 'utf8'));
  if (!v.inheritsFrom) return { ...v, jar: v.jar || id };
  const p = resolveVersion(mc, v.inheritsFrom);
  const seen = new Set();
  const key = (l) => { const [g, a, , c] = l.name.split('@')[0].split(':'); return `${g}:${a}:${c || ''}`; };
  const libraries = [...(v.libraries || []), ...(p.libraries || [])].filter((l) => !seen.has(key(l)) && seen.add(key(l)));
  return {
    ...p, ...v, libraries,
    jar: v.jar || p.jar,
    mainClass: v.mainClass || p.mainClass,
    assetIndex: v.assetIndex || p.assetIndex,
    assets: v.assets || p.assets,
    javaVersion: v.javaVersion || p.javaVersion,
    minecraftArguments: v.minecraftArguments || p.minecraftArguments,
    arguments: (v.arguments || p.arguments) ? {
      game: [...((p.arguments && p.arguments.game) || []), ...((v.arguments && v.arguments.game) || [])],
      jvm: [...((p.arguments && p.arguments.jvm) || []), ...((v.arguments && v.arguments.jvm) || [])]
    } : undefined
  };
}

// Eski sürümlerin native kütüphanelerini açar.
function extractNatives(mc, version, nativesDir) {
  fs.rmSync(nativesDir, { recursive: true, force: true });
  fs.mkdirSync(nativesDir, { recursive: true });
  for (const n of libraryFiles(mc, version.libraries).filter((x) => x.native)) {
    for (const e of new AdmZip(n.dest).getEntries()) {
      if (e.isDirectory || n.exclude.some((x) => e.entryName.startsWith(x)) || e.entryName.startsWith('META-INF')) continue;
      fs.writeFileSync(path.join(nativesDir, path.basename(e.entryName)), e.getData());
    }
  }
}

module.exports = { installVanilla, resolveVersion, libraryFiles, extractNatives, allowed, mavenPath, versionFile, versionDir, OS };
