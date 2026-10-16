const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dirs } = require('../paths');
const settings = require('../settings');
const modrinth = require('./modrinth');
const curseforge = require('./curseforge');

const sources = { modrinth, curseforge };
const DISABLED = '.disabled';
const EXT = { mod: '.jar', shader: '.zip', pack: '.zip' };

// Her tür kendi klasörüne gider; hepsi ana paketten ayrıdır.
const kindDir = (kind) => ({ mod: dirs().userMods, shader: dirs().userShaders, pack: dirs().userPacks }[kind || 'mod']);

function readIndex() {
  try { return JSON.parse(fs.readFileSync(dirs().userModsIndex, 'utf8')).map((m) => ({ kind: 'mod', ...m })); } catch { return []; }
}
function writeIndex(list) {
  fs.writeFileSync(dirs().userModsIndex, JSON.stringify(list, null, 2));
}
const fileOf = (m) => path.join(kindDir(m.kind), m.fileName + (m.enabled ? '' : DISABLED));

function list() {
  const main = fs.readdirSync(dirs().mainMods).filter((f) => f.endsWith('.jar')).map((f) => ({ fileName: f, locked: true }));
  return { main, user: readIndex() };
}

async function search({ source, query, kind = 'mod' }) {
  const s = settings.get();
  const { mcVersion, loader } = s.profile;
  return sources[source].search({ kind, query, mcVersion, loader, apiKey: s.curseforgeApiKey });
}

async function download(url, dest, hash) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`İndirme hatası ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (hash && hash.value) {
    const got = crypto.createHash(hash.algo).update(buf).digest('hex');
    if (got.toLowerCase() !== hash.value.toLowerCase()) throw new Error('Hash uyuşmuyor, dosya silindi.');
  }
  fs.writeFileSync(dest, buf);
}

// Dosyayı (ve modsa zorunlu bağımlılıklarını) yalnızca kullanıcı klasörüne kurar.
async function install({ source, projectId, kind = 'mod' }, _depth = 0) {
  const s = settings.get();
  const { mcVersion, loader } = s.profile;
  const index = readIndex();
  if (index.some((m) => m.source === source && m.projectId === projectId)) return index;
  if (_depth > 3) return index;

  const api = sources[source];
  const r = await api.resolve({ kind, projectId, mcVersion, loader, apiKey: s.curseforgeApiKey });
  const meta = await api.info(projectId, s.curseforgeApiKey).catch(() => ({ name: r.fileName }));

  // Ana pakette aynı dosya varsa kurma: ana paket kazanır.
  if (kind === 'mod' && fs.existsSync(path.join(dirs().mainMods, r.fileName))) throw new Error('Bu mod zaten ana pakette var.');

  await download(r.url, path.join(kindDir(kind), r.fileName), r.hash);
  const next = readIndex();
  next.push({ kind, source, projectId, name: meta.name, iconUrl: meta.iconUrl, fileName: r.fileName, version: r.version, hash: r.hash, enabled: true });
  writeIndex(next);

  for (const dep of r.dependencies) {
    try { await install({ source, projectId: dep, kind }, _depth + 1); } catch { /* bağımlılık kurulamadıysa ana kurulumu bozma */ }
  }
  return readIndex();
}

function toggle(fileName, kind = 'mod') {
  const index = readIndex();
  const m = index.find((x) => x.fileName === fileName && x.kind === kind);
  if (!m) return index;
  const from = fileOf(m);
  m.enabled = !m.enabled;
  fs.renameSync(from, fileOf(m));
  writeIndex(index);
  return index;
}

function remove(fileName, kind = 'mod') {
  const index = readIndex();
  const m = index.find((x) => x.fileName === fileName && x.kind === kind);
  if (m) { try { fs.unlinkSync(fileOf(m)); } catch { /* zaten yok */ } }
  const next = index.filter((x) => !(x.fileName === fileName && x.kind === kind));
  writeIndex(next);
  return next;
}

// Kullanıcı kendi dosyasını seçti (.jar, shader/paket için .zip).
function addLocal(srcPath, kind = 'mod') {
  const fileName = path.basename(srcPath);
  if (!fileName.toLowerCase().endsWith(EXT[kind])) throw new Error(`Yalnızca ${EXT[kind]} dosyası eklenebilir.`);
  if (kind === 'mod' && fs.existsSync(path.join(dirs().mainMods, fileName))) throw new Error('Bu dosya adı ana pakette var.');
  fs.copyFileSync(srcPath, path.join(kindDir(kind), fileName));
  const index = readIndex().filter((x) => !(x.fileName === fileName && x.kind === kind));
  index.push({ kind, source: 'local', projectId: null, name: fileName.replace(/\.(jar|zip)$/i, ''), fileName, version: '-', hash: null, enabled: true });
  writeIndex(index);
  return index;
}

module.exports = { list, search, install, toggle, remove, addLocal, readIndex, kindDir };
