'use strict';

// ---------- yardımcılar ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (id) => (document.getElementById(id) || {}).value || '';
const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const api = window.api;

async function call(p) {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
let toastTimer;
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}
async function guard(fn) { try { await fn(); } catch (e) { toast(e.message, true); } }

// ---------- varsayılan veri (sunucu API'si bağlanana kadar yerel) ----------
const SEED = {
  me: { name: 'Ametio', role: 'owner', coins: 412920 },
  products: [
    { id: 1, name: 'VIP Rütbesi', category: 'VIP', price: 650, desc: '' },
    { id: 2, name: 'MVP Rütbesi', category: 'VIP', price: 2150, desc: '' }
  ],
  announcements: [{ id: 1, title: 'Yeni Launcher Yayında', desc: 'Mod mağazası ve kullanıcı modları artık launcher içinde.', badge: 'YENİLİK', link: '' }],
  links: { discord: '', web: '' },
  users: [
    { name: 'Ametio', role: 'owner', coins: 412920, warns: 0, banned: false },
    { name: 'Oyuncu1', role: 'oyuncu', coins: 0, warns: 0, banned: false }
  ],
  tickets: []
};
const ROLES = ['owner', 'admin', 'moderator', 'rehber', 'oyuncu'];

const S = { view: 'home', tab: 'products', source: 'modrinth', results: [], query: '', busy: {}, mods: { main: [], user: [] }, set: null, D: {}, edit: null, ticket: null };

async function load(key) {
  let v = await call(api.data.get(key));
  if (v == null) { v = SEED[key]; await call(api.data.set(key, v)); }
  S.D[key] = v;
  return v;
}
const save = (key) => call(api.data.set(key, S.D[key]));
const isStaff = () => ['owner', 'admin'].includes(S.D.me.role);

// ---------- menü ----------
const ICON = '<svg viewBox="0 0 24 24"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 3-6 1 1 1 2 2 2 0-3 0-5 1-8z"/></svg>';
const NAV = [
  ['home', 'Ana Sayfa'], ['ads', 'Reklamlar'], ['support', 'Destek'], ['files', 'Dosyalar'],
  ['mods', 'Modlar'], ['settings', 'Ayarlar'], ['admin', 'Kontrol Paneli']
];
function renderNav() {
  $('#nav').innerHTML = NAV.filter(([k]) => k !== 'admin' || isStaff())
    .map(([k, t]) => `<button data-nav="${k}" class="${S.view === k || (k === 'mods' && S.view === 'store') ? 'on' : ''}">${ICON}${t}</button>`).join('');
  const t = NAV.find(([k]) => k === S.view);
  $('#viewTitle').textContent = S.view === 'store' ? 'Mod Mağazası' : t ? t[1] : '';
}
function renderChrome() {
  const me = S.D.me, p = S.set.profile;
  $('#uname').textContent = me.name; $('#urole').textContent = me.role; $('#coins').textContent = fmt(me.coins) + ' Coin';
  $('#server').innerHTML = `<div style="color:var(--gold)"><span class="dot"></span>Çevrimiçi</div><div class="muted">play.firewing.store</div>`;
  $('#tags').innerHTML = `<span class="a">${esc(p.mcVersion)}</span><span>${esc(p.loader)}</span><span>Mod: Ana + Kullanıcı (${S.mods.user.filter((m) => m.enabled).length})</span>`;
}

// ---------- görünümler ----------
const V = {};

V.home = () => {
  const news = S.D.announcements.slice(0, 3);
  const L = S.D.links;
  return `<div class="hero"><h1>FIREWING NETWORK</h1><div style="color:#ff9ea6">Keşfet. Fethet. Yüksel.</div></div>
  <div class="eyebrow" style="margin-bottom:8px">HABERLER</div>
  <div class="grid3">${news.map((a) => `<div class="item"><div class="grow"><b>${esc(a.title)}</b><div class="muted">${esc(a.badge)}</div></div></div>`).join('') || '<div class="muted">Henüz haber yok.</div>'}</div>
  <div class="eyebrow" style="margin:16px 0 8px">HIZLI ERİŞİM</div>
  <div class="row gap">
    <button class="btn" data-nav="store">Mod Mağazası</button>
    <button class="btn" data-nav="mods">Modlarım</button>
    ${L.discord ? `<a class="btn" style="display:inline-flex;align-items:center;color:inherit;text-decoration:none" href="${esc(L.discord)}" target="_blank">Discord</a>` : ''}
    ${L.web ? `<a class="btn" style="display:inline-flex;align-items:center;color:inherit;text-decoration:none" href="${esc(L.web)}" target="_blank">Web Sitesi</a>` : ''}
  </div>`;
};

V.ads = () => `<h1>Reklamlar & Duyurular</h1><p class="sub">Sunucudan haberler, etkinlikler ve kampanyalar.</p>
  <div class="panel">${S.D.announcements.map((a) => `<div class="item"><div class="grow"><span class="chip">${esc(a.badge)}</span><b>${esc(a.title)}</b><div class="muted">${esc(a.desc)}</div></div>${a.link ? `<a class="btn" style="color:inherit;text-decoration:none;display:inline-flex;align-items:center" href="${esc(a.link)}" target="_blank">Detay</a>` : ''}</div>`).join('') || '<div class="muted">Duyuru yok.</div>'}</div>`;

V.support = () => {
  const mine = S.D.tickets;
  const sel = mine.find((t) => t.id === S.ticket);
  return `<h1>Destek</h1><p class="sub">Taleplerini aç ve yanıtları takip et.</p>
  <div class="grid2"><div class="panel"><h2>Yeni Talep</h2>
    <label class="f">Konu<input type="text" id="tSubject"></label>
    <label class="f">Mesaj<textarea id="tBody"></textarea></label>
    <button class="btn pri" data-act="ticketNew">Gönder</button>
    <h2>Taleplerim</h2>${mine.map((t) => `<button class="item" style="cursor:pointer;text-align:left" data-act="ticketSel" data-id="${t.id}"><div class="grow"><b>${esc(t.subject)}</b><div class="muted">${esc(t.status)}</div></div></button>`).join('') || '<div class="muted">Talep yok.</div>'}</div>
  <div class="panel">${sel ? `<h2>${esc(sel.subject)}</h2>${sel.msgs.map((m) => `<div class="item"><div class="grow"><b>${esc(m.from)}</b>${esc(m.text)}</div></div>`).join('')}
    <label class="f">Yanıt<input type="text" id="tReply"></label>
    <div class="row gap"><button class="btn pri" data-act="ticketReply">Yanıtla</button><button class="btn" data-act="ticketClose">Kapat</button></div>` : '<div class="muted">Soldan bir talep seç ya da yeni talep aç.</div>'}</div></div>`;
};

V.files = () => `<h1>Dosyalar</h1><p class="sub">Launcher klasörleri.</p>
  <div class="grid2"><div class="panel hot"><h2>Kullanıcı Modları</h2><div class="mono">usermods/</div><button class="btn" data-act="open" data-w="user">Klasörü Aç</button></div>
  <div class="panel"><h2>Ana Mod Paketi</h2><div class="mono">mods/ (salt okunur)</div><button class="btn" data-act="open" data-w="main">Klasörü Aç</button></div></div>
  <div class="panel" style="margin-top:16px"><div class="row between center"><h2>Launcher klasörü</h2><button class="btn" data-act="open" data-w="root">Aç</button></div>
  ${(S.files || []).map((f) => `<div class="item"><span class="chip">${f.dir ? 'klasör' : 'dosya'}</span><b>${esc(f.name)}</b></div>`).join('')}</div>`;

V.mods = () => {
  const { main, user } = S.mods;
  return `<div class="row between center wrap gap"><div><h1>Mod Yöneticisi</h1><p class="sub">Profil: ${esc(S.set.profile.name)} · ${esc(S.set.profile.mcVersion)} · ${esc(S.set.profile.loader)}</p></div>
    <div class="row gap"><button class="btn pri" data-nav="store">+ Modrinth / CurseForge'dan Ekle</button><button class="btn" data-act="addLocal">.jar Dosyası Ekle</button></div></div>
  <div class="grid2">
    <div class="panel"><div class="row between"><h2>Ana Mod Paketi</h2><span class="chip">SALT OKUNUR</span></div><div class="mono">mods/</div>
      <div class="muted">Sunucunun zorunlu modları. Oyuncu silemez veya kapatamaz.</div>
      ${main.map((m) => `<div class="item">🔒 <b>${esc(m.fileName)}</b></div>`).join('') || '<div class="muted">Ana paket boş. Mod dosyaları mods/ klasörüne konur.</div>'}</div>
    <div class="panel hot"><div class="row between"><h2>Kullanıcı Modları</h2><span class="chip">${user.filter((m) => m.enabled).length} AÇIK</span></div><div class="mono">usermods/</div>
      ${user.map((m) => `<div class="item" style="opacity:${m.enabled ? 1 : .5}">${m.iconUrl ? `<img src="${esc(m.iconUrl)}" alt="">` : ''}<div class="grow"><b>${esc(m.name)}</b><div class="muted">${esc(m.source)} · ${esc(m.version)}</div></div>
        <button class="switch ${m.enabled ? 'on' : ''}" data-act="toggle" data-f="${esc(m.fileName)}" aria-label="Aç/Kapat"><i></i></button>
        <button class="btn danger" data-act="remove" data-f="${esc(m.fileName)}" aria-label="Sil">✕</button></div>`).join('') || '<div class="muted">Henüz kullanıcı modu yok.</div>'}</div>
  </div>`;
};

V.store = () => `<div class="row between center wrap gap"><div><h1>Mod Mağazası</h1><p class="sub">Seçilen modlar usermods/ klasörüne kurulur · ${esc(S.set.profile.mcVersion)} · ${esc(S.set.profile.loader)}</p></div><button class="btn" data-nav="mods">← Mod Yöneticisi</button></div>
  <div class="tabs"><button class="${S.source === 'modrinth' ? 'on' : ''}" data-act="source" data-s="modrinth">Modrinth</button><button class="${S.source === 'curseforge' ? 'on' : ''}" data-act="source" data-s="curseforge">CurseForge</button></div>
  <div class="row gap" style="margin-bottom:16px"><input type="search" id="q" placeholder="Mod ara…" value="${esc(S.query)}"><button class="btn pri" data-act="search">Ara</button></div>
  <div class="grid2">${S.results.map((r) => {
    const key = r.source + r.projectId;
    const done = S.mods.user.some((m) => m.source === r.source && m.projectId === r.projectId);
    return `<div class="item">${r.iconUrl ? `<img src="${esc(r.iconUrl)}" alt="">` : '<div class="thumb"></div>'}<div class="grow"><b>${esc(r.name)}</b><div class="muted">${esc(r.description)}</div><div class="muted">${fmt(r.downloads)} indirme</div></div>
      <button class="btn ${done ? 'ok' : 'pri'}" data-act="install" data-s="${r.source}" data-id="${esc(r.projectId)}" ${done || S.busy[key] ? 'disabled' : ''}>${done ? 'Kuruldu ✓' : S.busy[key] ? 'Kuruluyor…' : 'Kur'}</button></div>`;
  }).join('') || '<div class="muted">Arama yap veya listeyi yükle.</div>'}</div>`;

const sw = (on, ch) => `<button class="switch ${on ? 'on' : ''}" data-act="flag" data-k="${ch}" aria-label="${ch}"><i></i></button>`;
V.settings = () => {
  const s = S.set;
  return `<h1>Ayarlar</h1><p class="sub">Launcher ve oyun ayarları.</p><div class="grid2">
  <div class="panel"><h2>Oyun</h2>
    <label class="f">Ayrılan RAM: ${s.ramGb} GB<input class="range" type="range" min="2" max="32" value="${s.ramGb}" data-ch="ram"></label>
    <label class="f">Java yolu (boşsa otomatik)<input type="text" id="java" value="${esc(s.javaPath)}"></label>
    <div class="row between center">Başlayınca launcher'ı küçült${sw(s.minimizeOnLaunch, 'minimizeOnLaunch')}</div>
    <label class="f">Mod loader<select data-ch="loader">${['neoforge', 'forge', 'fabric', 'quilt'].map((l) => `<option ${l === s.profile.loader ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f">Minecraft sürümü<input type="text" id="mcv" value="${esc(s.profile.mcVersion)}"></label></div>
  <div class="panel hot"><h2>Mod Ayarları</h2>
    <div class="row between center">Kurmadan önce uyumluluğu denetle${sw(s.checkCompat, 'checkCompat')}</div>
    <div class="row between center">Kullanıcı modlarını başlangıçta yükle${sw(s.loadUserMods, 'loadUserMods')}</div>
    <label class="f">CurseForge API anahtarı<input type="text" id="cfkey" value="${esc(s.curseforgeApiKey)}" placeholder="console.curseforge.com'dan alınır"></label>
    <button class="btn pri" data-act="saveSettings">Ayarları Kaydet</button></div></div>`;
};

const ADMIN_TABS = [['products', 'Ürünler'], ['ann', 'Duyurular'], ['links', 'Bağlantılar'], ['users', 'Kullanıcılar'], ['roles', 'Yetkiler']];
V.admin = () => {
  const tabs = `<div class="tabs">${ADMIN_TABS.map(([k, t]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-t="${k}">${t}</button>`).join('')}</div>`;
  const e = S.edit || {};
  let body = '';
  if (S.tab === 'products') {
    body = `<div class="grid2"><div class="panel"><h2>Ürün Yönetimi</h2>${S.D.products.map((p) => `<div class="item"><div class="grow"><b>${esc(p.name)}</b><div class="muted">${esc(p.category)}</div></div><b style="color:var(--gold)">${fmt(p.price)} Coin</b><button class="btn" data-act="pEdit" data-id="${p.id}">Düzenle</button><button class="btn danger" data-act="pDel" data-id="${p.id}">Sil</button></div>`).join('')}</div>
    <div class="panel"><h2>${e.id ? 'Ürünü Düzenle' : 'Yeni Ürün'}</h2>
      <label class="f">Ürün adı<input type="text" id="pName" value="${esc(e.name)}"></label>
      <label class="f">Kategori<input type="text" id="pCat" value="${esc(e.category || 'Genel')}"></label>
      <label class="f">Fiyat (Coin)<input type="number" id="pPrice" value="${e.price || 0}"></label>
      <label class="f">Açıklama<textarea id="pDesc">${esc(e.desc)}</textarea></label>
      <button class="btn pri" data-act="pSave">Kaydet</button></div></div>`;
  } else if (S.tab === 'ann') {
    body = `<div class="grid2"><div class="panel"><h2>Duyuru Yönetimi</h2>${S.D.announcements.map((a) => `<div class="item"><div class="grow"><b>${esc(a.title)}</b><div class="muted">${esc(a.badge)}</div></div><button class="btn danger" data-act="aDel" data-id="${a.id}">Sil</button></div>`).join('')}</div>
    <div class="panel"><h2>Yeni Duyuru</h2><label class="f">Başlık<input type="text" id="aTitle"></label><label class="f">Açıklama<textarea id="aDesc"></textarea></label><label class="f">Rozet<input type="text" id="aBadge" placeholder="ETKİNLİK, KAMPANYA"></label><label class="f">Bağlantı (isteğe bağlı)<input type="text" id="aLink"></label><button class="btn pri" data-act="aAdd">Yayınla</button></div></div>`;
  } else if (S.tab === 'links') {
    body = `<div class="panel" style="max-width:640px"><h2>Bağlantılar</h2><label class="f">Discord davet adresi<input type="text" id="lDiscord" value="${esc(S.D.links.discord)}"></label><label class="f">Web sitesi adresi<input type="text" id="lWeb" value="${esc(S.D.links.web)}"></label><button class="btn pri" data-act="lSave">Kaydet</button></div>`;
  } else if (S.tab === 'users') {
    body = `<div class="panel"><h2>Kullanıcı & Yetki Yönetimi</h2>${S.D.users.map((u, i) => `<div class="item"><div class="avatar">${esc(u.name[0])}</div><div class="grow"><b>${esc(u.name)}</b><div class="muted">${fmt(u.coins)} Coin · uyarı ${u.warns}${u.banned ? ' · BANLI' : ''}</div></div>
      <select style="width:130px" data-ch="role" data-i="${i}">${ROLES.map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select>
      <button class="btn" data-act="uWarn" data-i="${i}">Uyar</button><button class="btn danger" data-act="uBan" data-i="${i}">${u.banned ? 'Banı Kaldır' : 'Ban'}</button></div>`).join('')}</div>`;
  } else {
    const staff = S.D.users.filter((u) => ['owner', 'admin', 'dev'].includes(u.role));
    body = `<div class="panel"><h2>Mevcut Yetkililer</h2>${staff.map((u) => `<div class="item"><b>${esc(u.name)}</b><span class="chip">${esc(u.role)}</span></div>`).join('')}<div class="muted">Rol değiştirmek için Kullanıcılar sekmesini kullan.</div></div>`;
  }
  return `<h1>Kontrol Paneli</h1><p class="sub">Yerel veri deposu: sunucu API'si bağlanana kadar değişiklikler yalnızca bu bilgisayarda kalır.</p>${tabs}${body}`;
};

// ---------- çizim ----------
async function render() {
  renderNav();
  if (S.view === 'files') S.files = await call(api.files.list());
  $('#content').innerHTML = (V[S.view] || V.home)();
}
async function refreshMods() { S.mods = await call(api.mods.list()); renderChrome(); }
async function go(v) { S.view = v; if (v === 'store' && !S.results.length) await doSearch(); await render(); }

async function doSearch() {
  S.query = val('q') || S.query;
  try { S.results = await call(api.mods.search({ source: S.source, query: S.query })); }
  catch (e) { S.results = []; toast(e.message, true); }
}

// ---------- olaylar ----------
const actions = {
  async source(el) { S.source = el.dataset.s; S.results = []; await doSearch(); },
  async search() { await doSearch(); },
  async install(el) {
    const key = el.dataset.s + el.dataset.id;
    S.busy[key] = true; await render();
    try { await call(api.mods.install({ source: el.dataset.s, projectId: el.dataset.id })); toast('Mod kuruldu.'); }
    finally { delete S.busy[key]; await refreshMods(); }
  },
  async toggle(el) { await call(api.mods.toggle(el.dataset.f)); await refreshMods(); },
  async remove(el) { await call(api.mods.remove(el.dataset.f)); await refreshMods(); },
  async addLocal() { await call(api.mods.addLocal()); await refreshMods(); },
  async open(el) { await call(api.openFolder(el.dataset.w)); },
  async flag(el) { S.set = await call(api.settings.set({ [el.dataset.k]: !S.set[el.dataset.k] })); },
  async saveSettings() {
    S.set = await call(api.settings.set({ javaPath: val('java'), curseforgeApiKey: val('cfkey'), profile: { ...S.set.profile, mcVersion: val('mcv') || S.set.profile.mcVersion } }));
    renderChrome(); toast('Ayarlar kaydedildi.');
  },
  async tab(el) { S.tab = el.dataset.t; S.edit = null; },
  async pEdit(el) { S.edit = S.D.products.find((p) => p.id === +el.dataset.id); },
  async pDel(el) { S.D.products = S.D.products.filter((p) => p.id !== +el.dataset.id); await save('products'); },
  async pSave() {
    const p = { id: S.edit ? S.edit.id : Date.now(), name: val('pName').trim(), category: val('pCat'), price: +val('pPrice') || 0, desc: val('pDesc') };
    if (!p.name) throw new Error('Ürün adı gerekli.');
    S.D.products = S.edit ? S.D.products.map((x) => (x.id === p.id ? p : x)) : [...S.D.products, p];
    S.edit = null; await save('products');
  },
  async aAdd() {
    if (!val('aTitle').trim()) throw new Error('Başlık gerekli.');
    const link = val('aLink').trim();
    if (link && !/^https?:\/\//.test(link)) throw new Error('Bağlantı http(s):// ile başlamalı.');
    S.D.announcements = [{ id: Date.now(), title: val('aTitle'), desc: val('aDesc'), badge: val('aBadge'), link }, ...S.D.announcements]; await save('announcements');
  },
  async aDel(el) { S.D.announcements = S.D.announcements.filter((a) => a.id !== +el.dataset.id); await save('announcements'); },
  async lSave() {
    for (const v of [val('lDiscord'), val('lWeb')]) if (v && !/^https?:\/\//.test(v)) throw new Error('Adresler http(s):// ile başlamalı.');
    S.D.links = { discord: val('lDiscord').trim(), web: val('lWeb').trim() }; await save('links'); toast('Kaydedildi.');
  },
  async uWarn(el) { S.D.users[+el.dataset.i].warns++; await save('users'); },
  async uBan(el) { const u = S.D.users[+el.dataset.i]; u.banned = !u.banned; await save('users'); },
  async ticketNew() {
    if (!val('tSubject').trim()) throw new Error('Konu gerekli.');
    const t = { id: Date.now(), subject: val('tSubject'), status: 'Açık', msgs: [{ from: S.D.me.name, text: val('tBody') }] };
    S.D.tickets = [t, ...S.D.tickets]; S.ticket = t.id; await save('tickets');
  },
  async ticketSel(el) { S.ticket = +el.dataset.id; },
  async ticketReply() {
    const t = S.D.tickets.find((x) => x.id === S.ticket);
    if (t && val('tReply').trim()) { t.msgs.push({ from: S.D.me.name, text: val('tReply') }); await save('tickets'); }
  },
  async ticketClose() { const t = S.D.tickets.find((x) => x.id === S.ticket); if (t) { t.status = 'Kapalı'; await save('tickets'); } }
};

document.addEventListener('click', (e) => {
  const w = e.target.closest('[data-win]');
  if (w) return api.win[{ min: 'minimize', max: 'maximize', close: 'close' }[w.dataset.win]]();
  const n = e.target.closest('[data-nav]');
  if (n) return guard(() => go(n.dataset.nav));
  const a = e.target.closest('[data-act]');
  if (a && actions[a.dataset.act]) guard(async () => { await actions[a.dataset.act](a); await render(); });
});
document.addEventListener('change', (e) => {
  const c = e.target.dataset.ch;
  if (!c) return;
  guard(async () => {
    if (c === 'ram') S.set = await call(api.settings.set({ ramGb: +e.target.value }));
    if (c === 'loader') { S.set = await call(api.settings.set({ profile: { ...S.set.profile, loader: e.target.value } })); renderChrome(); }
    if (c === 'role') { S.D.users[+e.target.dataset.i].role = e.target.value; await save('users'); }
    await render();
  });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'q') guard(async () => { await doSearch(); await render(); }); });

// ---------- başlatma çubuğu ----------
api.launch.onProgress((p) => { $('#progFill').style.width = p.percent + '%'; $('#progText').textContent = p.step; });
$('#btnPlay').addEventListener('click', () => guard(async () => {
  $('#btnPlay').disabled = true;
  try { await call(api.launch.start()); if (S.set.minimizeOnLaunch) api.win.minimize(); }
  finally { $('#btnPlay').disabled = false; }
}));
$('#btnKur').addEventListener('click', () => toast('Profil kurulumu oyun başlatıcı bağlandığında çalışacak.'));

// ---------- açılış ----------
(async function init() {
  try {
    S.set = await call(api.settings.get());
    for (const k of ['me', 'products', 'announcements', 'links', 'users', 'tickets']) await load(k);
    await refreshMods();
    await render();
  } catch (e) { toast(e.message, true); }
})();
