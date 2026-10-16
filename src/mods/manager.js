const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { dirs } = require('../paths');
const settings = require('../settings');
const modrinth = require('./modrinth');
const curseforge = require('./curseforge');

const sources = { modrinth, curseforge };
const DISABLED = '.disabled';

function readIndex() {
  try { return JSON.parse(fs.readFileSync(dirs().userModsIndex, 'utf8')); } catch { return []; }
}
function writeIndex(list) {
  fs.writeFileSync(dirs().userModsIndex, JSON.stringify(list, null, 2));
}

const fileOf = (m) => path.join(dirs().userMods, m.fileName + (m.enabled ? '' : DISABLED));

function list() {
  const d = dirs();
  const main = fs.readdirSync(d.mainMods).filter((f) => f.endsWith('.jar')).map((f) => ({ fileName: f, locked: true }));
  return { main, user: readIndex() };
}

async function search({ source, query }) {
  const s = settings.get();
  const { mcVersion, loader } = s.profile;
  return sources[source].search({ query, mcVersion, loader, apiKey: s.curseforgeApiKey });
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

// Modu ve zorunlu bağımlılıklarını yalnızca usermods/ içine kurar.
async function install({ source, projectId }, _depth = 0) {
  const s = settings.get();
  const { mcVersion, loader } = s.profile;
  const index = readIndex();
  if (index.some((m) => m.source === source && m.projectId === projectId)) return index;
  if (_depth > 3) return index;

  const api = sources[source];
  const r = await api.resolve({ projectId, mcVersion, loader, apiKey: s.curseforgeApiKey });
  const meta = await api.info(projectId, s.curseforgeApiKey).catch(() => ({ name: r.fileName }));

  // Ana pakette aynı dosya varsa kurma: ana paket kazanır.
  if (fs.existsSync(path.join(dirs().mainMods, r.fileName))) throw new Error('Bu mod zaten ana pakette var.');

  await download(r.url, path.join(dirs().userMods, r.fileName), r.hash);
  const next = readIndex();
  next.push({
    source, projectId, name: meta.name, iconUrl: meta.iconUrl,
    fileName: r.fileName, version: r.version, hash: r.hash, enabled: true
  });
  writeIndex(next);

  for (const dep of r.dependencies) {
    try { await install({ source, projectId: dep }, _depth + 1); } catch { /* bağımlılık kurulamadıysa ana kurulumu bozma */ }
  }
  return readIndex();
}

function toggle(fileName) {
  const index = readIndex();
  const m = index.find((x) => x.fileName === fileName);
  if (!m) return index;
  const from = fileOf(m);
  m.enabled = !m.enabled;
  fs.renameSync(from, fileOf(m));
  writeIndex(index);
  return index;
}

function remove(fileName) {
  const index = readIndex();
  const m = index.find((x) => x.fileName === fileName);
  if (m) { try { fs.unlinkSync(fileOf(m)); } catch { /* zaten yok */ } }
  const next = index.filter((x) => x.fileName !== fileName);
  writeIndex(next);
  return next;
}

// Kullanıcı kendi .jar dosyasını seçti.
function addLocal(srcPath) {
  const fileName = path.basename(srcPath);
  if (!fileName.endsWith('.jar')) throw new Error('Yalnızca .jar dosyası eklenebilir.');
  if (fs.existsSync(path.join(dirs().mainMods, fileName))) throw new Error('Bu dosya adı ana pakette var.');
  fs.copyFileSync(srcPath, path.join(dirs().userMods, fileName));
  const index = readIndex().filter((x) => x.fileName !== fileName);
  index.push({ source: 'local', projectId: null, name: fileName.replace(/\.jar$/, ''), fileName, version: '-', hash: null, enabled: true });
  writeIndex(index);
  return index;
}

module.exports = { list, search, install, toggle, remove, addLocal, readIndex };
