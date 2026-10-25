// FireWing PHP API istemcisi (web/api). İstekler ana süreçten gider; oturum launcher.json'da tutulur.
const crypto = require('crypto');
const settings = require('./settings');

const DEFAULT_API = 'https://firewing.store/api';
const apiBase = () => (settings.get().apiUrl || DEFAULT_API).replace(/\/+$/, '') + '/';
// Sitenin kökü: .../api/ → .../  (Versions/modpacks.json burada durur)
const siteBase = () => apiBase().replace(/api\/$/, '');

function deviceId() {
  let id = settings.get().deviceId;
  if (!id) { id = 'launcher-' + crypto.randomBytes(12).toString('hex'); settings.set({ deviceId: id }); }
  return id;
}

async function parse(res) {
  let data;
  try { data = await res.json(); } catch { throw new Error(`Sunucudan geçersiz yanıt geldi (${res.status}).`); }
  if (data && data.success === false) {
    if (/oturum geçersiz/i.test(data.message || '')) settings.set({ session: null });
    throw new Error(data.message || 'İşlem başarısız.');
  }
  return data;
}

async function call(ep, body = {}, auth = true) {
  if (!/^[a-z_]+\.php$/.test(ep)) throw new Error('Geçersiz uç nokta.');
  const s = settings.get().session || {};
  const payload = auth ? { username: s.username || '', token: s.token || '', ...body } : body;
  const res = await fetch(apiBase() + ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return parse(res);
}

async function get(ep) {
  if (!/^[a-z_]+\.php$/.test(ep)) throw new Error('Geçersiz uç nokta.');
  return parse(await fetch(apiBase() + ep));
}

async function login(username, password) {
  const r = await call('login.php', { username, password, deviceId: deviceId() }, false);
  settings.set({ session: { username: r.username, token: r.token } });
  return call('me.php');
}

async function logout() {
  try { await call('logout.php'); } catch { /* yine de çık */ }
  settings.set({ session: null });
}

// Yönetim panelindeki "Launcher Sürümleri" listesi.
async function packs() {
  const res = await fetch(siteBase() + 'Versions/modpacks.json', { cache: 'no-store' });
  if (!res.ok) return [];
  const list = await res.json().catch(() => []);
  return Array.isArray(list) ? list : [];
}

module.exports = { call, get, login, logout, packs, apiBase, siteBase };
