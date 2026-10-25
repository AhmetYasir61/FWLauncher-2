'use strict';
// FireWing PHP API istemcisi. Oturum (kullanıcı adı + token) tarayıcıda saklanır, her istekte gövdeye eklenir.
const FW = (() => {
  const BASE = '/api/';
  const store = {
    get: (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* gizli sekme */ } }
  };
  function deviceId() {
    let id = store.get('fw_device');
    if (!id) { id = 'web-' + Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''); store.set('fw_device', id); }
    return id;
  }
  const session = () => ({ username: store.get('fw_user'), token: store.get('fw_token') });
  const loggedIn = () => !!(store.get('fw_user') && store.get('fw_token'));

  async function call(ep, body = {}, { auth = true } = {}) {
    const res = await fetch(BASE + ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auth ? { ...session(), ...body } : body)
    });
    let data;
    try { data = await res.json(); } catch { throw new Error('Sunucudan geçersiz yanıt geldi.'); }
    if (data && data.success === false) {
      if (/oturum geçersiz/i.test(data.message || '')) { store.set('fw_user', ''); store.set('fw_token', ''); }
      throw new Error(data.message || 'İşlem başarısız.');
    }
    return data;
  }
  async function get(ep) {
    const res = await fetch(BASE + ep);
    if (!res.ok) throw new Error('Sunucu hatası ' + res.status);
    return res.json();
  }
  async function login(username, password) {
    const r = await call('login.php', { username, password, deviceId: deviceId() }, { auth: false });
    store.set('fw_user', r.username); store.set('fw_token', r.token);
    return r;
  }
  async function logout() {
    try { await call('logout.php'); } catch { /* yine de çık */ }
    store.set('fw_user', ''); store.set('fw_token', '');
  }
  const register = (username, email, password) => call('register.php', { username, email, password, deviceId: deviceId() }, { auth: false });
  return { call, get, login, logout, register, loggedIn, session };
})();

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
const GRADS = ['#7c5cff,#2a1a66', '#14b8a6,#0b3a45', '#e0409a,#4a1450', '#f59e0b,#4a2a08'];
function toast(msg, err) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200);
}
