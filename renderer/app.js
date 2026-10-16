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
const isUrl = (u) => !u || /^https?:\/\//.test(u);

// ---------- veri (sunucu API'si bağlanana kadar yerel) ----------
const SEED = {
  me: { name: '', role: 'oyuncu', coins: 0, loggedIn: false },
  products: [
    { id: 1, name: 'VIP Rütbesi', category: 'VIP', price: 650, desc: '' },
    { id: 2, name: 'MVP Rütbesi', category: 'VIP', price: 2150, desc: '' }
  ],
  announcements: [{ id: 1, title: 'Yeni launcher yayında', desc: 'Mod mağazası ve kullanıcı modları artık launcher içinde.', badge: 'YENİLİK', link: '' }],
  links: { discord: '', web: '', youtube: '', map: '' },
  users: [{ name: 'Ametio', role: 'owner', coins: 412920, warns: 0, banned: false }],
  tickets: []
};
const ROLES = ['owner', 'admin', 'moderator', 'rehber', 'oyuncu'];
const KIND_LABEL = { mod: 'Modlar', shader: 'Gölgelendiriciler', pack: 'Kaynak Paketleri' };
const KIND_DESC = { mod: 'Açıp kapatabileceğin mod listesi.', shader: 'Açıp kapatabileceğin gölgelendirici paketleri.', pack: 'Açıp kapatabileceğin kaynak paketleri.' };
const KIND_ICON = { mod: 'icon-chest.jpg', shader: 'icon-gem.jpg', pack: 'icon-shield.jpg' };
const GRADS = ['#7c5cff,#2a1a66', '#14b8a6,#0b3a45', '#e0409a,#4a1450', '#f59e0b,#4a2a08'];
const THEME = { home: 't-orange', account: 't-teal', mods: 't-violet', store: 't-pink', ads: 't-gold', map: 't-green', support: 't-blue', settings: 't-slate', admin: 't-red', login: 't-violet' };

const S = {
  view: 'login', modTab: 'mod', storeKind: 'mod', setTab: 'window', adminTab: 'products', source: 'modrinth',
  results: [], query: '', busy: {}, mods: { main: [], user: [] }, set: null, D: {}, edit: null, ticket: null,
  prog: { pct: 0, text: 'Hazır' }, running: false
};

async function load(key) {
  let v = await call(api.data.get(key));
  if (v == null) { v = SEED[key]; await call(api.data.set(key, v)); }
  S.D[key] = v;
  return v;
}
const save = (key) => call(api.data.set(key, S.D[key]));
const isStaff = () => ['owner', 'admin'].includes(S.D.me.role);
const userKind = (k) => S.mods.user.filter((m) => m.kind === k);

// ---------- üst çubuk ve sol menü ----------
const RAIL = [['home', 'Oyna', 'play'], ['account', 'Hesap', 'user'], ['mods', 'Modlar', 'mods'], ['store', 'Mağaza', 'store'], ['ads', 'Haberler', 'news'], ['map', 'Harita', 'map'], ['support', 'Destek', 'help'], ['settings', 'Ayarlar', 'settings'], ['admin', 'Panel', 'shield']];
function renderChrome() {
  const win = $('#win');
  win.className = 'win ' + (THEME[S.view] || 't-orange') + (S.view === 'login' ? ' nolayout' : '');
  const me = S.D.me;
  $('#rail').innerHTML = RAIL.filter(([k]) => k !== 'admin' || isStaff())
    .map(([k, t, ic]) => `<a href="#" data-nav="${k}" class="${S.view === k ? 'on' : ''}"><i class="ic" data-ic="${ic}"></i>${t}</a>`).join('')
    + '<span class="sp"></span><a href="#" data-act="logout"><i class="ic" data-ic="exit"></i>Çıkış</a>';
  $('#uname').textContent = me.name || '—';
  $('#urole').textContent = me.role;
  $('#av').textContent = (me.name || '?')[0].toUpperCase();
  const L = S.D.links;
  const soc = (u, ic, t) => (u ? `<a href="${esc(u)}" target="_blank" aria-label="${t}"><i class="ic" data-ic="${ic}"></i></a>` : `<a class="off" aria-label="${t}"><i class="ic" data-ic="${ic}"></i></a>`);
  $('#social').innerHTML = soc(L.discord, 'chat', 'Discord') + soc(L.web, 'globe', 'Web sitesi') + soc(L.youtube, 'video', 'YouTube');
}
function tickClock() { $('#clock').textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }

// ---------- görünümler ----------
const V = {};
const nick = () => esc(S.D.me.name || '—');
const sheet = (nav, main) => `<div class="sheet">${nav}<div class="sheet-main">${main}</div></div>`;
const subnav = (items, cur, act, foot) => `<div class="subnav">${items.map(([k, t]) => `<button class="${cur === k ? 'on' : ''}" data-act="${act}" data-k="${k}">${t}</button>`).join('')}${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
const ttl = (t, d) => `<div class="ttl"><h1>${t}</h1><p class="sub">${d}</p></div>`;
const swc = (on, attrs) => `<button class="switch ${on ? 'on' : ''}" ${attrs}><i></i></button>`;

V.login = () => `<div class="bgart" style="right:auto;left:-60px;top:80px;width:700px;height:520px;opacity:.28;-webkit-mask:linear-gradient(90deg,#000 20%,transparent 100%);mask:linear-gradient(90deg,#000 20%,transparent 100%)"></div>
  <div style="position:absolute;left:64px;top:230px;max-width:560px;display:flex;flex-direction:column;gap:18px"><h1 style="font-size:76px;line-height:1.05">Hoş<br>geldin!</h1><p class="sub" style="font-size:18px;max-width:420px">Giriş yap ve gerçek hayatta kalma havasına dal.</p></div>
  <form class="login" id="loginForm"><div class="row center gap"><i class="logo" style="width:60px;height:60px"></i><div><div style="font:30px var(--disp);letter-spacing:2px">FIREWING</div><span class="chip">BETA</span></div></div>
    <label class="f">Takma ad<input type="text" id="lNick" maxlength="16" autocomplete="username" placeholder="Oyundaki adın"></label>
    <label class="f">Şifre<input type="password" id="lPass" autocomplete="current-password" placeholder="••••••••"></label>
    <button class="btn pri" type="submit" style="height:48px;font-size:14px">GİRİŞ YAP</button>
    <div class="muted" style="text-align:center">Şifre doğrulaması sunucu bağlanınca etkinleşecek.</div></form>`;

V.home = () => {
  const news = S.D.announcements.slice(0, 6);
  const on = userKind('mod').filter((m) => m.enabled).length;
  return `<div class="bgart"></div>
  <div style="position:relative;max-width:660px;display:flex;flex-direction:column;gap:14px;padding-top:22px">
    <div><div class="big">FIRE<em>WING</em></div><div class="big" style="font-size:44px;margin-top:6px">NETWORK</div></div>
    <div class="row gap wrap"><span class="chip lg">Sürüm: ${esc(S.set.profile.mcVersion)}</span><span class="chip lg">Mod: ${on} açık</span><span class="chip lg">${esc(S.set.profile.loader)}</span></div>
    <p class="sub" style="max-width:520px">Keşfet, fethet, yüksel. Modların, gölgelendiricilerin ve kaynak paketlerin tek tıkla hazır.</p>
    <div class="row gap center"><button class="playbtn" id="btnPlay" data-act="play" ${S.running ? 'disabled' : ''}>▶ OYNA</button><button class="sqbtn" data-nav="mods" aria-label="Modlar">⚙</button>
      <div class="grow" style="max-width:300px;margin-left:12px"><div class="prog"><i id="progFill" style="width:${S.prog.pct}%"></i></div><div class="muted" id="progText" style="margin-top:6px">${esc(S.prog.text)}</div></div></div>
  </div>
  <div class="carousel">${news.map((a, i) => `<div class="ncard"><div class="cv" style="background-image:${i === 0 ? 'url(assets/banner.jpg)' : `linear-gradient(135deg,${GRADS[i % 4]})`}"></div><b>${esc(a.title)}</b><div class="muted">${esc(a.desc)}</div></div>`).join('') || '<div class="muted">Henüz haber yok.</div>'}</div>`;
};

V.account = () => {
  const me = S.D.me;
  const stat = (l, c) => `<div class="stat"><span class="l">${l}</span><b style="color:${c}">—</b></div>`;
  return `<div style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;height:100%"><div style="display:flex;flex-direction:column;gap:18px;min-width:0">
    <div class="panel hot" style="gap:18px;padding:24px"><div class="row center gap"><img class="head" style="width:78px;height:78px;border-radius:18px" src="https://mc-heads.net/avatar/${encodeURIComponent(me.name)}/96" data-fb="${esc((me.name || '?')[0].toUpperCase())}" alt=""><div class="grow"><span class="chip">${esc(me.role)}</span><h1 style="font-size:32px;margin-top:4px">${nick()}</h1></div><div style="text-align:right"><div class="muted">Bakiyen</div><div style="font:30px var(--disp);color:#ffd166">${fmt(me.coins)}</div></div></div>
      <div class="grid3">${stat('Oynama süresi', '#5ee3c8')}${stat('Öldürülen mob', '#ffb03d')}${stat('Ölüm sayısı', '#ff8a9a')}${stat('Kayıt tarihi', '#c4a8ff')}${stat('Son giriş', '#7cc4ff')}${stat('Sunucuda', '#a3e635')}</div>
      <div class="muted">İstatistikler sunucu bağlantısı kurulunca canlı gelecek.</div></div></div>
    <div class="panel" style="gap:14px"><h2>Skin</h2><div style="height:300px;border-radius:18px;background:linear-gradient(160deg,rgba(var(--a1rgb),.25),rgba(124,92,255,.15));display:grid;place-items:center;padding:10px"><img class="skin" src="https://mc-heads.net/body/${encodeURIComponent(me.name)}/right" data-fb="" alt="Skin önizleme"></div><div class="muted">Önizleme mc-heads.net üzerinden alınır.</div></div></div>`;
};

V.mods = () => {
  const k = S.modTab;
  const items = userKind(k);
  const main = k === 'mod' ? S.mods.main : [];
  return sheet(subnav(Object.entries(KIND_LABEL), k, 'modTab', 'Ana paket kilitli, senin eklediklerin ayrı klasörde durur.'),
    `${ttl(KIND_LABEL[k], KIND_DESC[k])}
    <div class="grid2">${items.map((m) => `<div class="modcard" style="opacity:${m.enabled ? 1 : .5}"><img class="ico" src="${m.iconUrl ? esc(m.iconUrl) : 'assets/' + KIND_ICON[k]}" alt=""><div class="t"><b>${esc(m.name)}</b><span>${esc(m.source)} · ${esc(m.version)}</span></div>
      ${swc(m.enabled, `data-act="toggle" data-f="${esc(m.fileName)}" data-k="${k}" aria-label="Aç/Kapat"`)}<button class="btn danger" style="padding:0 12px" data-act="remove" data-f="${esc(m.fileName)}" data-k="${k}" aria-label="Sil">✕</button></div>`).join('')}
    ${main.map((m) => `<div class="modcard"><img class="ico" src="assets/${KIND_ICON.mod}" alt=""><div class="t"><b>${esc(m.fileName)}</b><span>Ana paket · zorunlu</span></div><span class="chip">KİLİTLİ</span></div>`).join('')}
    ${!items.length && !main.length ? '<div class="muted">Henüz yok. Mağazadan ekleyebilirsin.</div>' : ''}</div>
    <div class="row gap" style="margin-top:auto"><button class="btn pri" data-act="goStore" data-k="${k}">+ Mağazadan Ekle</button><button class="btn" data-act="addLocal" data-k="${k}">Dosyadan Ekle</button><button class="btn" data-act="open" data-w="${k === 'mod' ? 'user' : k}">Klasörü Aç</button></div>`);
};

V.store = () => {
  const k = S.storeKind;
  return sheet('', `<div class="row between center wrap gap"><div class="ttl" style="margin:0"><h1 style="font-size:34px">Mağaza</h1><p class="sub">Modrinth ve CurseForge'dan ekle.</p></div>
    <div class="row gap"><button class="btn ${S.source === 'modrinth' ? 'pri' : ''}" data-act="source" data-s="modrinth">Modrinth</button><button class="btn ${S.source === 'curseforge' ? 'pri' : ''}" data-act="source" data-s="curseforge">CurseForge</button></div></div>
    <div class="row gap wrap">${Object.entries(KIND_LABEL).map(([id, t]) => `<button class="chip lg" style="border:0;cursor:pointer;${k === id ? 'background:rgba(var(--a1rgb),.35);color:#fff' : ''}" data-act="storeKind" data-k="${id}">${t}</button>`).join('')}</div>
    <div class="row gap"><input type="search" id="q" placeholder="${esc(S.source)} içinde ara…" value="${esc(S.query)}"><button class="btn pri" data-act="search">Ara</button></div>
    <div class="cards">${S.results.map((r) => {
      const key = r.source + r.projectId;
      const done = S.mods.user.some((m) => m.source === r.source && m.projectId === r.projectId);
      return `<div class="card3"><div class="cover" style="background:linear-gradient(135deg,${GRADS[r.name.length % 4]})"><img src="${r.iconUrl ? esc(r.iconUrl) : 'assets/' + KIND_ICON[k]}" alt=""></div><div class="body"><b>${esc(r.name)}</b><div class="muted" style="max-height:34px;overflow:hidden">${esc(r.description)}</div>
        <div class="row between center" style="margin-top:6px"><span class="muted">${fmt(r.downloads)} indirme</span><button class="btn ${done ? 'ok' : 'pri'}" style="height:32px;padding:0 14px" data-act="install" data-s="${r.source}" data-id="${esc(r.projectId)}" data-k="${r.kind}" ${done || S.busy[key] ? 'disabled' : ''}>${done ? 'Kuruldu ✓' : S.busy[key] ? 'Kuruluyor…' : 'Kur'}</button></div></div></div>`;
    }).join('') || '<div class="muted">Arama yap veya listeyi yükle.</div>'}</div>`);
};

V.ads = () => `${''}${sheet('', `<div class="ttl" style="margin:0"><h1 style="font-size:34px">Haberler</h1><p class="sub">Duyurular, etkinlikler ve kampanyalar.</p></div>
  <div class="banner" style="height:170px;border-radius:22px;margin:0"><h2 style="font-size:22px">FIREWING NETWORK</h2><div class="muted">Keşfet. Fethet. Yüksel.</div></div>
  <div class="grid3">${S.D.announcements.map((a, i) => `<div class="card3"><div class="cover" style="background:linear-gradient(135deg,${GRADS[i % 4]})"></div><div class="body"><span class="chip" style="align-self:flex-start">${esc(a.badge)}</span><b>${esc(a.title)}</b><div class="muted">${esc(a.desc)}</div>${a.link ? `<a class="btn" style="margin-top:6px" href="${esc(a.link)}" target="_blank">Detay</a>` : ''}</div></div>`).join('') || '<div class="muted">Duyuru yok.</div>'}</div>`)}`;

V.map = () => {
  const u = S.D.links.map;
  return `<div class="mapbox" style="background:linear-gradient(135deg,rgba(20,184,166,.35),rgba(124,92,255,.35)),url(assets/bg.jpg) center/cover">${u ? `<iframe class="mapframe" src="${esc(u)}" referrerpolicy="no-referrer"></iframe>` : '<div style="position:absolute;left:0;right:0;top:46%;text-align:center" class="muted">Harita adresi girilmemiş. Panel > Bağlantılar bölümünden ekleyebilirsin.</div>'}</div>`;
};

V.support = () => {
  const list = S.D.tickets, sel = list.find((t) => t.id === S.ticket);
  return sheet(`<div class="subnav" style="width:320px"><div class="row between center" style="padding:0 6px 8px"><h2>Taleplerim</h2></div>
    ${list.map((t) => `<button class="item" style="text-align:left;${t.id === S.ticket ? 'border-color:rgba(var(--a2rgb),.55)' : ''}" data-act="ticketSel" data-id="${t.id}"><div class="grow"><b>${esc(t.subject)}</b><div class="muted">${esc(t.status)}</div></div></button>`).join('') || '<div class="muted">Talep yok.</div>'}
    <div class="panel" style="margin-top:10px;padding:14px"><label class="f">Yeni talep: konu<input type="text" id="tSubject"></label><label class="f">Mesaj<textarea id="tBody"></textarea></label><button class="btn pri" data-act="ticketNew">Gönder</button></div></div>`,
    sel ? `<div class="row between center"><h1 style="font-size:28px">${esc(sel.subject)}</h1><span class="chip">${esc(sel.status)}</span></div>
      ${sel.msgs.map((m) => `<div class="msg ${m.from === S.D.me.name ? 'mine' : ''}"><b>${esc(m.from)}</b><div>${esc(m.text)}</div></div>`).join('')}
      <div class="row gap" style="margin-top:auto"><input type="text" id="tReply" placeholder="Yanıtını yaz…"><button class="btn pri" data-act="ticketReply">Gönder</button><button class="btn" data-act="ticketClose">Kapat</button></div>`
    : '<div class="muted">Soldan bir talep seç ya da yeni talep aç.</div>');
};

const row = (t, d, ctl) => `<div class="setrow"><div><b>${t}</b><span class="d">${d}</span></div>${ctl}</div>`;
V.settings = () => {
  const s = S.set, t = S.setTab;
  const tabs = [['look', 'Görünüm'], ['window', 'Pencere'], ['java', 'Java ve Bellek'], ['mods', 'Modlar'], ['files', 'Dosyalar']];
  const save_ = '<div style="margin-top:auto"><button class="btn pri" data-act="saveSettings">Kaydet</button></div>';
  let body = '';
  if (t === 'look') body = row('Dil', 'Launcher arayüz dili.', '<div class="field ctl">Türkçe</div>') + row('Renk teması', 'Her sayfa kendi vurgu rengini kullanır.', '<div class="row gap ctl"><i class="thumb" style="width:30px;height:30px;background:#ff5a4e"></i><i class="thumb" style="width:30px;height:30px;background:#14b8a6"></i><i class="thumb" style="width:30px;height:30px;background:#7c5cff"></i><i class="thumb" style="width:30px;height:30px;background:#e0409a"></i></div>');
  if (t === 'window') body = row('Tam ekran', 'Oyunu tam ekran modunda başlat.', swc(s.fullscreen, 'data-act="flag" data-k="fullscreen" aria-label="Tam ekran"')) + row('Genişlik', 'Oyun penceresinin açılış genişliği.', `<div class="ctl"><input type="number" id="sW" value="${s.width}"></div>`) + row('Yükseklik', 'Oyun penceresinin açılış yüksekliği.', `<div class="ctl"><input type="number" id="sH" value="${s.height}"></div>`) + row('Başlayınca launcher\'ı küçült', 'Oyun açılınca launcher görev çubuğuna iner.', swc(s.minimizeOnLaunch, 'data-act="flag" data-k="minimizeOnLaunch" aria-label="Küçült"')) + save_;
  if (t === 'java') body = row('Ayrılan RAM', `Oyuna ayrılacak bellek: <b>${s.ramGb} GB</b>. Toplam belleğinin yarısını aşma.`, `<div class="ctl"><input class="range" type="range" min="2" max="32" value="${s.ramGb}" data-ch="ram"></div>`) + row('Java yolu', 'Boşsa launcher uygun Java\'yı kendisi seçer.', `<div class="ctl"><input type="text" id="sJava" value="${esc(s.javaPath)}" placeholder="Otomatik"></div>`) + row('Mod loader', 'Modların çalışacağı loader.', `<div class="ctl"><select data-ch="loader">${['neoforge', 'forge', 'fabric', 'quilt'].map((l) => `<option ${l === s.profile.loader ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`) + row('Minecraft sürümü', 'Profilin Minecraft sürümü.', `<div class="ctl"><input type="text" id="sMc" value="${esc(s.profile.mcVersion)}"></div>`) + save_;
  if (t === 'mods') body = row('Kurmadan önce uyumluluğu denetle', 'Mod sürümü ve loader eşleşmesini kontrol eder.', swc(s.checkCompat, 'data-act="flag" data-k="checkCompat" aria-label="Uyumluluk"')) + row('Kullanıcı modlarını yükle', 'Açık kullanıcı modları oyunla birlikte yüklenir.', swc(s.loadUserMods, 'data-act="flag" data-k="loadUserMods" aria-label="Yükle"')) + row('CurseForge API anahtarı', 'Modrinth için gerekmez.', `<div class="ctl"><input type="text" id="sKey" value="${esc(s.curseforgeApiKey)}" placeholder="console.curseforge.com"></div>`) + save_;
  if (t === 'files') body = `<div class="grid2"><div class="panel hot"><div class="row between"><h2>Kullanıcı Modları</h2><span class="chip">YAZILABİLİR</span></div><div class="mono">usermods/</div><button class="btn" style="align-self:flex-start" data-act="open" data-w="user">Klasörü Aç</button></div><div class="panel"><div class="row between"><h2>Ana Mod Paketi</h2><span class="chip">SALT OKUNUR</span></div><div class="mono">mods/</div><button class="btn" style="align-self:flex-start" data-act="open" data-w="main">Klasörü Aç</button></div></div><div class="panel"><div class="row between center"><h2>Launcher klasörü</h2><button class="btn" data-act="open" data-w="root">Aç</button></div>${(S.files || []).map((f) => `<div class="item"><span class="chip">${f.dir ? 'klasör' : 'dosya'}</span><b>${esc(f.name)}</b></div>`).join('')}</div>`;
  return sheet(subnav(tabs, t, 'setTab', 'FireWing Launcher 0.1'), `${ttl('Ayarlar', 'İstemciyi ve launcher\'ı istediğin gibi ayarla.')}${body}`);
};

V.admin = () => {
  const t = S.adminTab, e = S.edit || {};
  const tabs = [['products', 'Ürünler'], ['ann', 'Duyurular'], ['links', 'Bağlantılar'], ['users', 'Kullanıcılar'], ['roles', 'Yetkiler']];
  let body = '';
  if (t === 'products') body = `<div class="grid2" style="grid-template-columns:minmax(0,1fr) 300px"><div style="display:flex;flex-direction:column;gap:10px">${S.D.products.map((p, i) => `<div class="item"><img class="ico" src="assets/icon-${['shield', 'gem', 'chest', 'sword'][i % 4]}.jpg" alt=""><div class="grow"><b>${esc(p.name)}</b><div class="muted">${esc(p.category)}</div></div><b style="color:#ffd166">${fmt(p.price)} Coin</b><button class="btn" data-act="pEdit" data-id="${p.id}">Düzenle</button><button class="btn danger" data-act="pDel" data-id="${p.id}">Sil</button></div>`).join('')}</div>
    <div class="panel hot"><h2>${e.id ? 'Ürünü Düzenle' : 'Yeni Ürün'}</h2><label class="f">Ürün adı<input type="text" id="pName" value="${esc(e.name)}"></label><label class="f">Kategori<input type="text" id="pCat" value="${esc(e.category || 'Genel')}"></label><label class="f">Fiyat (Coin)<input type="number" id="pPrice" value="${e.price || 0}"></label><label class="f">Açıklama<textarea id="pDesc">${esc(e.desc)}</textarea></label><button class="btn pri" data-act="pSave">Kaydet</button></div></div>`;
  if (t === 'ann') body = `<div class="grid2"><div style="display:flex;flex-direction:column;gap:10px">${S.D.announcements.map((a) => `<div class="item"><div class="grow"><b>${esc(a.title)}</b><div class="muted">${esc(a.badge)}</div></div><button class="btn danger" data-act="aDel" data-id="${a.id}">Sil</button></div>`).join('')}</div>
    <div class="panel hot"><h2>Yeni Duyuru</h2><label class="f">Başlık<input type="text" id="aTitle"></label><label class="f">Açıklama<textarea id="aDesc"></textarea></label><label class="f">Rozet<input type="text" id="aBadge" placeholder="ETKİNLİK"></label><label class="f">Bağlantı (isteğe bağlı)<input type="text" id="aLink" placeholder="https://"></label><button class="btn pri" data-act="aAdd">Yayınla</button></div></div>`;
  if (t === 'links') body = `<div class="panel hot" style="max-width:600px"><label class="f">Discord davet adresi<input type="text" id="lDiscord" value="${esc(S.D.links.discord)}"></label><label class="f">Web sitesi adresi<input type="text" id="lWeb" value="${esc(S.D.links.web)}"></label><label class="f">YouTube adresi<input type="text" id="lYt" value="${esc(S.D.links.youtube)}"></label><label class="f">Harita adresi<input type="text" id="lMap" value="${esc(S.D.links.map)}"></label><button class="btn pri" style="align-self:flex-start" data-act="lSave">Kaydet</button></div>`;
  if (t === 'users') body = `<div style="display:flex;flex-direction:column;gap:10px">${S.D.users.map((u, i) => `<div class="item" style="opacity:${u.banned ? .6 : 1}"><span class="head" style="width:40px;height:40px;font-size:16px">${esc(u.name[0])}</span><div class="grow"><b>${esc(u.name)}</b> <span class="chip">${esc(u.role)}</span><div class="muted">${fmt(u.coins)} Coin · uyarı ${u.warns}${u.banned ? ' · BANLI' : ''}</div></div>
    <select style="width:140px;height:36px" data-ch="role" data-i="${i}">${ROLES.map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select><button class="btn" data-act="uWarn" data-i="${i}">Uyar</button><button class="btn danger" data-act="uBan" data-i="${i}">${u.banned ? 'Banı Kaldır' : 'Ban'}</button></div>`).join('')}</div>`;
  if (t === 'roles') body = `<div class="panel hot"><h2>Rol değiştir</h2><div class="muted">Rol değiştirmek için Kullanıcılar sekmesindeki listeyi kullan.</div></div><div style="display:flex;flex-direction:column;gap:10px">${S.D.users.filter((u) => ['owner', 'admin'].includes(u.role)).map((u) => `<div class="item"><b>${esc(u.name)}</b><span class="chip">${esc(u.role)}</span></div>`).join('')}</div>`;
  return sheet(subnav(tabs, t, 'adminTab', 'Sadece owner ve admin görür. Veriler şimdilik bu bilgisayarda.'), `${ttl('Panel', 'Oyuncuların göreceği içerikleri buradan yönet.')}${body}`);
};

// ---------- çizim ----------
async function render() {
  renderChrome();
  if (S.view === 'settings' && S.setTab === 'files') S.files = await call(api.files.list());
  const root = $('#content');
  root.innerHTML = (V[S.view] || V.home)();
}
async function refreshMods() { S.mods = await call(api.mods.list()); }
async function go(v) {
  S.view = v;
  if (v === 'store' && !S.results.length) await doSearch();
  await render();
}
async function doSearch() {
  S.query = document.getElementById('q') ? val('q') : S.query;
  try { S.results = await call(api.mods.search({ source: S.source, query: S.query, kind: S.storeKind })); }
  catch (e) { S.results = []; toast(e.message, true); }
}

// ---------- olaylar ----------
const actions = {
  async modTab(el) { S.modTab = el.dataset.k; },
  async setTab(el) { S.setTab = el.dataset.k; },
  async adminTab(el) { S.adminTab = el.dataset.k; S.edit = null; },
  async goStore(el) { S.storeKind = el.dataset.k; S.results = []; S.view = 'store'; await doSearch(); },
  async storeKind(el) { S.storeKind = el.dataset.k; S.results = []; await doSearch(); },
  async source(el) { S.source = el.dataset.s; S.results = []; await doSearch(); },
  async search() { await doSearch(); },
  async install(el) {
    const key = el.dataset.s + el.dataset.id;
    S.busy[key] = true; await render();
    try { await call(api.mods.install({ source: el.dataset.s, projectId: el.dataset.id, kind: el.dataset.k })); toast('Kuruldu.'); }
    finally { delete S.busy[key]; await refreshMods(); }
  },
  async toggle(el) { await call(api.mods.toggle(el.dataset.f, el.dataset.k)); await refreshMods(); },
  async remove(el) { await call(api.mods.remove(el.dataset.f, el.dataset.k)); await refreshMods(); },
  async addLocal(el) { await call(api.mods.addLocal(el.dataset.k)); await refreshMods(); },
  async open(el) { await call(api.openFolder(el.dataset.w)); },
  async flag(el) { S.set = await call(api.settings.set({ [el.dataset.k]: !S.set[el.dataset.k] })); },
  async saveSettings() {
    const p = {};
    if (document.getElementById('sW')) { p.width = +val('sW') || 854; p.height = +val('sH') || 480; }
    if (document.getElementById('sJava')) { p.javaPath = val('sJava'); p.profile = { ...S.set.profile, mcVersion: val('sMc') || S.set.profile.mcVersion }; }
    if (document.getElementById('sKey')) p.curseforgeApiKey = val('sKey');
    S.set = await call(api.settings.set(p));
    toast('Ayarlar kaydedildi.');
  },
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
    if (!isUrl(link)) throw new Error('Bağlantı http(s):// ile başlamalı.');
    S.D.announcements = [{ id: Date.now(), title: val('aTitle'), desc: val('aDesc'), badge: val('aBadge'), link }, ...S.D.announcements]; await save('announcements');
  },
  async aDel(el) { S.D.announcements = S.D.announcements.filter((a) => a.id !== +el.dataset.id); await save('announcements'); },
  async lSave() {
    const v = { discord: val('lDiscord').trim(), web: val('lWeb').trim(), youtube: val('lYt').trim(), map: val('lMap').trim() };
    for (const u of Object.values(v)) if (!isUrl(u)) throw new Error('Adresler http(s):// ile başlamalı.');
    S.D.links = v; await save('links'); toast('Kaydedildi.');
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
  async ticketClose() { const t = S.D.tickets.find((x) => x.id === S.ticket); if (t) { t.status = 'Kapalı'; await save('tickets'); } },
  async logout() { S.D.me = { ...S.D.me, loggedIn: false }; await save('me'); S.view = 'login'; },
  async play() {
    S.running = true; S.prog = { pct: 5, text: 'Başlatılıyor…' }; await render();
    try { await call(api.launch.start()); if (S.set.minimizeOnLaunch) api.win.minimize(); }
    finally { S.running = false; await render(); }
  }
};

document.addEventListener('click', (e) => {
  const w = e.target.closest('[data-win]');
  if (w) return api.win[{ min: 'minimize', max: 'maximize', close: 'close' }[w.dataset.win]]();
  const n = e.target.closest('[data-nav]');
  if (n) { e.preventDefault(); return guard(() => go(n.dataset.nav)); }
  const a = e.target.closest('[data-act]');
  if (a && actions[a.dataset.act]) { e.preventDefault(); guard(async () => { await actions[a.dataset.act](a); await render(); }); }
});
document.addEventListener('change', (e) => {
  const c = e.target.dataset.ch;
  if (!c) return;
  guard(async () => {
    if (c === 'ram') S.set = await call(api.settings.set({ ramGb: +e.target.value }));
    if (c === 'loader') S.set = await call(api.settings.set({ profile: { ...S.set.profile, loader: e.target.value } }));
    if (c === 'role') { S.D.users[+e.target.dataset.i].role = e.target.value; await save('users'); }
    await render();
  });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'q') guard(async () => { await doSearch(); await render(); }); });
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'loginForm') return;
  e.preventDefault();
  guard(async () => {
    const name = val('lNick').trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('Takma ad 3-16 karakter olmalı (harf, rakam, _).');
    const known = S.D.users.find((u) => u.name.toLowerCase() === name.toLowerCase());
    S.D.me = { name: known ? known.name : name, role: known ? known.role : 'oyuncu', coins: known ? known.coins : 0, loggedIn: true };
    await save('me'); S.view = 'home'; await render();
  });
});
// profil resmi yüklenemezse harf göster
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.dataset.fb !== undefined) { const s = document.createElement('span'); s.className = t.className.includes('head') ? 'head' : 'muted'; s.textContent = t.dataset.fb || 'Önizleme yok'; s.style.cssText = t.getAttribute('style') || ''; if (t.className.includes('head')) s.style.display = 'grid'; t.replaceWith(s); }
}, true);

// ---------- başlatma ilerlemesi ----------
api.launch.onProgress((p) => {
  S.prog = { pct: p.percent, text: p.step };
  const f = document.getElementById('progFill'), t = document.getElementById('progText');
  if (f) f.style.width = p.percent + '%';
  if (t) t.textContent = p.step;
});

// ---------- açılış ----------
(async function init() {
  try {
    S.set = await call(api.settings.get());
    for (const k of ['me', 'products', 'announcements', 'links', 'users', 'tickets']) await load(k);
    S.D.links = { discord: '', web: '', youtube: '', map: '', ...S.D.links };
    await refreshMods();
    S.view = S.D.me.loggedIn && S.D.me.name ? 'home' : 'login';
    tickClock(); setInterval(tickClock, 30000);
    await render();
  } catch (e) { toast(e.message, true); }
})();
