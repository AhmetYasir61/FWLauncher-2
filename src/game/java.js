// Doğru Java sürümünü bulur; yoksa Adoptium'dan (veya paketteki JavaUrl'den) indirip launcher klasörüne kurar.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const AdmZip = require('adm-zip');
const dl = require('./download');

const WIN = process.platform === 'win32';
const exe = WIN ? 'javaw.exe' : 'java';

function findIn(dir) {
  if (!fs.existsSync(dir)) return null;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    const cand = path.join(d, 'bin', exe);
    if (fs.existsSync(cand)) return cand;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory() && !/^(bin|lib|legal|man|include|conf)$/.test(e.name)) stack.push(path.join(d, e.name));
  }
  return null;
}

function majorOf(java) {
  return new Promise((resolve) => {
    execFile(java, ['-version'], { windowsHide: true, timeout: 15000 }, (err, _o, stderr) => {
      if (err) return resolve(0);
      const m = String(stderr).match(/version "(\d+)(?:\.(\d+))?/);
      resolve(m ? (m[1] === '1' ? +m[2] : +m[1]) : 0);
    });
  });
}

function extract(archive, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  if (archive.endsWith('.zip')) { new AdmZip(archive).extractAllTo(dest, true); return Promise.resolve(); }
  return new Promise((resolve, reject) => execFile('tar', ['-xzf', archive, '-C', dest], (e) => (e ? reject(new Error('Java arşivi açılamadı.')) : resolve())));
}

async function ensureJava({ major, javaPath, javaUrl, runtimeDir, onProgress }) {
  if (javaPath) {
    if (!fs.existsSync(javaPath)) throw new Error('Ayarlardaki Java yolu bulunamadı.');
    return javaPath;
  }
  const home = path.join(runtimeDir, `java-${major}`);
  const local = findIn(home);
  if (local && (await majorOf(local)) >= major) return local;

  const os = { win32: 'windows', darwin: 'mac', linux: 'linux' }[process.platform];
  const arch = { x64: 'x64', arm64: 'aarch64', ia32: 'x32' }[process.arch];
  const url = javaUrl || `https://api.adoptium.net/v3/binary/latest/${major}/ga/${os}/${arch}/jre/hotspot/normal/eclipse`;
  try {
    onProgress(`Java ${major} indiriliyor…`);
    const archive = path.join(runtimeDir, `java-${major}${WIN || /\.zip($|\?)/.test(url) ? '.zip' : '.tar.gz'}`);
    fs.rmSync(archive, { force: true });
    await dl.file(url, archive);
    onProgress(`Java ${major} kuruluyor…`);
    await extract(archive, home);
    fs.rmSync(archive, { force: true });
    const j = findIn(home);
    if (j) { if (!WIN) fs.chmodSync(j, 0o755); return j; }
  } catch (e) {
    // indirilemezse sistemdeki Java'yı dene
    if ((await majorOf('java')) >= major) return 'java';
    throw new Error(`Java ${major} indirilemedi: ${e.message}`);
  }
  if ((await majorOf('java')) >= major) return 'java';
  throw new Error(`Java ${major} bulunamadı. Ayarlar > Java ve Bellek'ten yol gösterebilirsin.`);
}

module.exports = { ensureJava, majorOf };
