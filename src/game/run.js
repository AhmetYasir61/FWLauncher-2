// Birleştirilmiş sürüm dosyasından java komutunu kurar ve oyunu başlatır.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const mcv = require('./minecraft');

// Çevrimdışı (AuthMe) sunucuların kullandığı UUID: md5("OfflinePlayer:" + ad), sürüm 3. API'deki offline_uuid ile aynı.
function offlineUuid(name) {
  const h = crypto.createHash('md5').update('OfflinePlayer:' + name).digest();
  h[6] = (h[6] & 0x0f) | 0x30; h[8] = (h[8] & 0x3f) | 0x80;
  return h.toString('hex');
}

// Cihaz kimliği: makineye özgü sabit değerlerin özeti (ham donanım bilgisi gönderilmez).
function hwid() {
  const macs = Object.values(os.networkInterfaces()).flat().filter((n) => n && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00').map((n) => n.mac).sort();
  return crypto.createHash('sha256').update([os.hostname(), os.platform(), os.arch(), (os.cpus()[0] || {}).model, ...macs].join('|')).digest('hex');
}

function fill(str, vars) { return str.replace(/\$\{([a-z_]+)\}/g, (m, k) => (k in vars ? vars[k] : m)); }
function expand(list, vars, features) {
  const out = [];
  for (const a of list || []) {
    if (typeof a === 'string') out.push(fill(a, vars));
    else if (mcv.allowed(a.rules, features)) for (const v of [].concat(a.value)) out.push(fill(v, vars));
  }
  return out;
}

function buildCommand({ mcDir, gameDir, versionId, java, user, settings, server, session }) {
  const v = mcv.resolveVersion(mcDir, versionId);
  const libDir = path.join(mcDir, 'libraries');
  const nativesDir = path.join(mcDir, 'natives', versionId);
  mcv.extractNatives(mcDir, v, nativesDir);

  const cp = [];
  for (const lib of v.libraries) {
    if (!mcv.allowed(lib.rules) || (lib.natives && !(lib.downloads && lib.downloads.artifact))) continue;
    const a = lib.downloads && lib.downloads.artifact;
    const p = path.join(libDir, (a && a.path) || mcv.mavenPath(lib.name));
    if (!cp.includes(p)) cp.push(p);
  }
  // NeoForge ve 1.17+ Forge, Minecraft'ı kendi yamalı kopyasından modül olarak yükler; vanilla jar'ı
  // sınıf yoluna eklemek "aynı paketi iki modül dışa aktarıyor" hatasına yol açar.
  const bootstrap = /^(cpw\.mods\.bootstraplauncher|net\.minecraftforge\.bootstrap|net\.neoforged\.fml)/.test(v.mainClass);
  if (!bootstrap) cp.push(path.join(mcDir, 'versions', v.jar, v.jar + '.jar'));

  const custom = !settings.fullscreen && settings.width && settings.height;
  const vars = {
    auth_player_name: user.name, auth_uuid: offlineUuid(user.name), auth_access_token: '0', auth_xuid: '0', clientid: '0',
    user_type: 'legacy', user_properties: '{}', version_name: versionId, version_type: 'release',
    game_directory: gameDir, assets_root: path.join(mcDir, 'assets'), game_assets: path.join(mcDir, 'assets'), assets_index_name: v.assetIndex.id,
    natives_directory: nativesDir, launcher_name: 'FireWingLauncher', launcher_version: '0.1',
    classpath: cp.join(path.delimiter), classpath_separator: path.delimiter, library_directory: libDir,
    resolution_width: String(settings.width || 854), resolution_height: String(settings.height || 480)
  };
  const features = { has_custom_resolution: !!custom };

  let jvm = v.arguments ? expand(v.arguments.jvm, vars, features) : [`-Djava.library.path=${nativesDir}`, '-cp', vars.classpath];
  let game = v.arguments ? expand(v.arguments.game, vars, features) : fill(v.minecraftArguments || '', vars).split(' ').filter(Boolean);

  const mem = Math.max(2, Math.min(64, +settings.ramGb || 4));
  const extraJvm = [`-Xmx${mem}G`, '-Xms512M'];
  // Sunucudaki mod, launcher oturumunu bu bilgilerle doğrular (mc_auth.php).
  if (session) extraJvm.push(`-Dfirewing.username=${session.username}`, `-Dfirewing.token=${session.token}`, `-Dfirewing.hwid=${session.hwid}`);
  if (settings.fullscreen) game.push('--fullscreen');
  if (server && server.ip) {
    // 1.20 ve sonrası quickPlay kullanır; daha eski sürümler --server/--port ile bağlanır.
    const minor = +(String(v.inheritsFrom || versionId).split('.')[1] || 0);
    if (minor >= 20) game.push('--quickPlayMultiplayer', `${server.ip}:${server.port || 25565}`);
    else game.push('--server', server.ip, '--port', String(server.port || 25565));
  }

  return { java, args: [...extraJvm, ...jvm, v.mainClass, ...game], cwd: gameDir };
}

// İlk açılışta: erişilebilirlik karşılama ekranını atla (sunucuya otomatik bağlanmayı engelliyor) ve dili Türkçe yap.
// Oyuncunun kendi options.txt dosyası varsa hiç dokunulmaz.
function ensureOptions(gameDir) {
  const f = path.join(gameDir, 'options.txt');
  if (!fs.existsSync(f)) fs.writeFileSync(f, 'onboardAccessibility:false\nlang:tr_tr\n');
}

// Oyunu başlatır; çıktı game/logs/launcher.log dosyasına yazılır (en fazla 20 MB). onExit(kod) oyun kapanınca çağrılır.
const LOG_LIMIT = 20 * 1024 * 1024;
function start(cmd, onExit) {
  fs.mkdirSync(path.join(cmd.cwd, 'logs'), { recursive: true });
  const log = fs.createWriteStream(path.join(cmd.cwd, 'logs', 'launcher.log'));
  let written = 0;
  const write = (b) => {
    if (written >= LOG_LIMIT) return;
    written += b.length;
    log.write(written >= LOG_LIMIT ? Buffer.concat([b, Buffer.from('\n[launcher] Günlük 20 MB sınırına ulaştı, kalanı yazılmadı.\n')]) : b);
  };
  const p = spawn(cmd.java, cmd.args, { cwd: cmd.cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false });
  p.stdout.on('data', write); p.stderr.on('data', write);
  let finished = false;
  const end = (code, err) => { if (finished) return; finished = true; log.end(); onExit(code, err); };
  p.on('error', (e) => end(-1, e));
  p.on('exit', (code) => end(code));
  return p;
}

// Client modu dosyadan okumayı tercih ederse diye oturum bilgisi oyun klasörüne de yazılır (yalnızca kullanıcı okuyabilir).
function writeSessionFile(gameDir, session) {
  const f = path.join(gameDir, 'firewing_session.json');
  fs.writeFileSync(f, JSON.stringify(session), { mode: 0o600 });
  return f;
}

module.exports = { buildCommand, start, offlineUuid, hwid, writeSessionFile, ensureOptions };
