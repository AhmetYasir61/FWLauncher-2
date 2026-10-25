'use strict';
// FireWing Launcher arayüzü. Hesap, haberler, mağaza, destek ve panel FireWing API'sinden (web/api) gelir;
// modlar, gölgelendiriciler ve kaynak paketleri bu bilgisayarda yönetilir.

// ---------- yardımcılar ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (id) => (document.getElementById(id) || {}).value || '';
const fmt = (n) => Number(n || 0).toLocaleString('tr-TR');
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
const api = window.api;

async function call(p) {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}
const R = {
  call: (ep, body) => call(api.remote.call(ep, body)),
  get: (ep) => call(api.remote.get(ep))
};
let toastTimer;
function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
}
async function guard(fn) { try { await fn(); } catch (e) { toast(e.message, true); } }

const KIND_LABEL = { mod: 'Modlar', shader: 'Gölgelendiriciler', pack: 'Kaynak Paketleri' };
const KIND_DESC = { mod: 'Açıp kapatabileceğin mod listesi.', shader: 'Açıp kapatabileceğin gölgelendirici paketleri.', pack: 'Açıp kapatabileceğin kaynak paketleri.' };
const KIND_ICON = { mod: 'icon-chest.jpg', shader: 'icon-gem.jpg', pack: 'icon-shield.jpg' };
const GRADS = ['#7c5cff,#2a1a66', '#14b8a6,#0b3a45', '#e0409a,#4a1450', '#f59e0b,#4a2a08'];
const THEME = { home: 't-orange', account: 't-teal', mods: 't-violet', store: 't-pink', ads: 't-gold', map: 't-green', support: 't-blue', settings: 't-slate', admin: 't-red', login: 't-violet' };
const TICKET_STAFF = ['owner', 'admin', 'moderator', 'rehber'];
const ROLES = ['player', 'rehber', 'moderator', 'admin'];

const S = {
  view: 'login', modTab: 'mod', storeKind: 'mod', setTab: 'window', adminTab: 'products', source: 'modrinth',
  results: [], query: '', busy: {}, mods: { main: [], user: [] }, set: null,
  me: null, D: { ads: [], products: [], links: {}, users: [], bans: [] }, status: null,
  tickets: [], ticketStaff: false, ticket: null, msgs: null, edit: null, packs: [],
  prog: { pct: 0, text: 'Hazır' }, running: false
};
const isAdmin = () => !!(S.me && S.me.isAdmin);
const userKind = (k) => S.mods.user.filter((m) => m.kind === k);
const siteUrl = () => String(S.set.apiUrl || '').replace(/\/+$/, '').replace(/\/api$/, '') + '/';

// ---------- API'den veri ----------
async function loadPublic() {
  const [ads, prods, sets, content] = await Promise.allSettled([R.get('ads.php'), R.get('products.php'), R.get('settings.php'), R.get('site_content.php')]);
  if (ads.status === 'fulfilled' && Array.isArray(ads.value)) S.D.ads = ads.value;
  if (prods.status === 'fulfilled') S.D.products = prods.value.products || [];
  const site = content.status === 'fulfilled' ? ((content.value.content || {}).firewingSite || {}) : {};
  const s = sets.status === 'fulfilled' ? sets.value : {};
  S.D.links = { discord: safeUrl(s.discord_url), web: safeUrl(s.website_url), youtube: safeUrl(site.youtubeUrl), map: safeUrl(site.mapUrl) };
}
async function loadStatus() {
  try { S.status = await R.get('server_status.php'); } catch { S.status = null; }
  renderTop();
}
async function loadMe() { S.me = await R.call('me.php'); }

// ---------- üst çubuk ve sol menü ----------
const RAIL = [['home', 'Oyna', 'play'], ['account', 'Hesap', 'user'], ['mods', 'Modlar', 'mods'], ['store', 'Mağaza', 'store'], ['ads', 'Haberler', 'news'], ['map', 'Harita', 'map'], ['support', 'Destek', 'help'], ['settings', 'Ayarlar', 'settings'], ['admin', 'Panel', 'shield']];
function renderTop() {
  const st = S.status;
  const b = document.querySelector('.meter');
  if (!b) return;
  if (st && st.online) b.innerHTML = `<div class="mrow"><b>${fmt(st.players.online)}</b><span>/${fmt(st.players.max)}</span></div><div class="prog"><i style="width:${st.players.max ? Math.min(100, st.players.online / st.players.max * 100) : 0}%"></i></div><small>oyuncu çevrimiçi</small>`;
  else b.innerHTML = `<div class="mrow"><b>—</b></div><div class="prog"><i style="width:0"></i></div><small>${st ? 'sunucu kapalı' : 'sunucu durumu alınamadı'}</small>`;
}
function renderChrome() {
  $('#win').className = 'win ' + (THEME[S.view] || 't-orange') + (S.view === 'login' ? ' nolayout' : '');
  $('#rail').innerHTML = RAIL.filter(([k]) => k !== 'admin' || isAdmin())
    .map(([k, t, ic]) => `<a href="#" data-nav="${k}" class="${S.view === k ? 'on' : ''}"><i class="ic" data-ic="${ic}"></i>${t}</a>`).join('')
    + '<span class="sp"></span><a href="#" data-act="logout"><i class="ic" data-ic="exit"></i>Çıkış</a>';
  const me = S.me || { username: '—', role: '', coins: 0 };
  $('#uname').textContent = me.username;
  $('#urole').textContent = `${me.role} · ${fmt(me.coins)} Coin`;
  $('#av').textContent = (me.username || '?')[0].toUpperCase();
  const L = S.D.links;
  const soc = (u, ic, t) => (u ? `<a href="${esc(u)}" target="_blank" aria-label="${t}"><i class="ic" data-ic="${ic}"></i></a>` : `<a class="off" aria-label="${t}"><i class="ic" data-ic="${ic}"></i></a>`);
  $('#social').innerHTML = soc(L.discord, 'chat', 'Discord') + soc(L.web, 'globe', 'Web sitesi') + soc(L.youtube, 'video', 'YouTube');
  renderTop();
}
function tickClock() { $('#clock').textContent = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }

// ---------- görünümler ----------
const V = {};
const sheet = (nav, main) => `<div class="sheet">${nav}<div class="sheet-main">${main}</div></div>`;
const subnav = (items, cur, act, foot) => `<div class="subnav">${items.map(([k, t]) => `<button class="${cur === k ? 'on' : ''}" data-act="${act}" data-k="${k}">${t}</button>`).join('')}${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
const ttl = (t, d) => `<div class="ttl"><h1>${t}</h1><p class="sub">${d}</p></div>`;
const swc = (on, attrs) => `<button class="switch ${on ? 'on' : ''}" ${attrs}><i></i></button>`;
const input = (label, id, value = '', type = 'text', extra = '') => `<label class="f">${label}<input type="${type}" id="${id}" value="${esc(value)}" ${extra}></label>`;
const cover = (img, i) => (safeUrl(img) ? `url('${esc(img)}')` : i === 0 ? 'url(assets/banner.jpg)' : `linear-gradient(135deg,${GRADS[i % 4]})`);

V.login = () => `<div class="bgart" style="right:auto;left:-60px;top:80px;width:700px;height:520px;opacity:.28;-webkit-mask:linear-gradient(90deg,#000 20%,transparent 100%);mask:linear-gradient(90deg,#000 20%,transparent 100%)"></div>
  <div style="position:absolute;left:64px;top:230px;max-width:560px;display:flex;flex-direction:column;gap:18px"><h1 style="font-size:76px;line-height:1.05">Hoş<br>geldin!</h1><p class="sub" style="font-size:18px;max-width:420px">Giriş yap ve gerçek hayatta kalma havasına dal.</p></div>
  <form class="login" id="loginForm"><div class="row center gap"><i class="logo" style="width:60px;height:60px"></i><div><div style="font:30px var(--disp);letter-spacing:2px">FIREWING</div><span class="chip">BETA</span></div></div>
    <label class="f">Kullanıcı adı<input type="text" id="lNick" maxlength="16" autocomplete="username" placeholder="Oyundaki adın"></label>
    <label class="f">Şifre<input type="password" id="lPass" autocomplete="current-password" placeholder="Oyundaki şifren"></label>
    <button class="btn pri" type="submit" style="height:48px;font-size:14px">GİRİŞ YAP</button>
    <div class="muted" style="text-align:center">Hesabın yok mu? <a href="${esc(siteUrl())}panel.html" target="_blank" style="color:var(--a2)">Sitede kayıt ol</a></div></form>`;

V.home = () => {
  const on = userKind('mod').filter((m) => m.enabled).length;
  return `<div class="bgart"></div>
  <div style="position:relative;max-width:660px;display:flex;flex-direction:column;gap:14px;padding-top:22px">
    <div><div class="big">FIRE<em>WING</em></div><div class="big" style="font-size:44px;margin-top:6px">NETWORK</div></div>
    <div class="row gap wrap"><span class="chip lg">Sürüm: ${esc(S.set.profile.mcVersion)}</span><span class="chip lg">Mod: ${on} açık</span><span class="chip lg">${esc(S.set.profile.loader)}</span></div>
    <p class="sub" style="max-width:520px">Keşfet, fethet, yüksel. Sunucu paketi otomatik güncellenir; modların, gölgelendiricilerin ve kaynak paketlerin tek tıkla hazır.</p>
    <div class="row gap center"><button class="playbtn" id="btnPlay" data-act="play" ${S.running ? 'disabled' : ''}>▶ OYNA</button><button class="sqbtn" data-nav="mods" aria-label="Modlar">⚙</button>
      <div class="grow" style="max-width:300px;margin-left:12px"><div class="prog"><i id="progFill" style="width:${S.prog.pct}%"></i></div><div class="muted" id="progText" style="margin-top:6px">${esc(S.prog.text)}</div></div></div>
  </div>
  <div class="carousel">${S.D.ads.slice(0, 6).map((a, i) => `<div class="ncard"><div class="cv" style="background-image:${cover(a.imageUrl, i)}"></div><b>${esc(a.title)}</b><div class="muted">${esc(a.description)}</div></div>`).join('') || '<div class="muted">Henüz haber yok.</div>'}</div>`;
};

V.account = () => {
  const me = S.me;
  return `<div style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;height:100%"><div style="display:flex;flex-direction:column;gap:18px;min-width:0">
    <div class="panel hot" style="gap:18px;padding:24px"><div class="row center gap"><img class="head" style="width:78px;height:78px;border-radius:18px" src="https://mc-heads.net/avatar/${encodeURIComponent(me.username)}/96" data-fb="${esc(me.username[0].toUpperCase())}" alt=""><div class="grow"><span class="chip">${esc(me.role)}</span><h1 style="font-size:32px;margin-top:4px">${esc(me.username)}</h1></div><div style="text-align:right"><div class="muted">Bakiyen</div><div style="font:30px var(--disp);color:#ffd166">${fmt(me.coins)}</div></div></div>
      <div class="row gap"><a class="btn pri" href="${esc(siteUrl())}panel.html#coin" target="_blank">Coin Yükle</a><button class="btn" data-nav="store">Mağaza</button></div></div>
    <div class="panel"><h2>Coin gönder</h2><div class="muted">Bir arkadaşına coin gönder.</div><div class="row gap">${input('Alıcı', 'tTo')}${input('Miktar', 'tAmt', '', 'number', 'min="1"')}</div><button class="btn pri" style="align-self:flex-start" data-act="transfer">Gönder</button></div></div>
    <div class="panel" style="gap:14px"><h2>Skin</h2><div style="height:300px;border-radius:18px;background:linear-gradient(160deg,rgba(var(--a1rgb),.25),rgba(124,92,255,.15));display:grid;place-items:center;padding:10px"><img class="skin" src="https://mc-heads.net/body/${encodeURIComponent(me.username)}/right" data-fb="" alt="Skin önizleme"></div><div class="muted">Önizleme mc-heads.net üzerinden alınır.</div></div></div>`;
};

V.mods = () => {
  const k = S.modTab;
  const items = userKind(k);
  const main = k === 'mod' ? S.mods.main : [];
  return sheet(subnav(Object.entries(KIND_LABEL), k, 'modTab', 'Ana paket sunucudan otomatik iner; senin eklediklerin ayrı klasörde durur.'),
    `${ttl(KIND_LABEL[k], KIND_DESC[k])}
    <div class="grid2">${items.map((m) => `<div class="modcard" style="opacity:${m.enabled ? 1 : .5}"><img class="ico" src="${safeUrl(m.iconUrl) ? esc(m.iconUrl) : 'assets/' + KIND_ICON[k]}" alt=""><div class="t"><b>${esc(m.name)}</b><span>${esc(m.source)} · ${esc(m.version)}</span></div>
      ${swc(m.enabled, `data-act="toggle" data-f="${esc(m.fileName)}" data-k="${k}" aria-label="Aç/Kapat"`)}<button class="btn danger" style="padding:0 12px" data-act="remove" data-f="${esc(m.fileName)}" data-k="${k}" aria-label="Sil">✕</button></div>`).join('')}
    ${main.map((m) => `<div class="modcard"><img class="ico" src="assets/${KIND_ICON.mod}" alt=""><div class="t"><b>${esc(m.fileName)}</b><span>Ana paket · zorunlu</span></div><span class="chip">KİLİTLİ</span></div>`).join('')}
    ${!items.length && !main.length ? `<div class="muted">${k === 'mod' ? 'Ana paket ilk OYNA\'da sunucudan iner. Kendi modlarını mağazadan ekleyebilirsin.' : 'Henüz yok. Mağazadan ekleyebilirsin.'}</div>` : ''}</div>
    <div class="row gap" style="margin-top:auto"><button class="btn pri" data-act="goStore" data-k="${k}">+ Mağazadan Ekle</button><button class="btn" data-act="addLocal" data-k="${k}">Dosyadan Ekle</button><button class="btn" data-act="open" data-w="${k === 'mod' ? 'user' : k}">Klasörü Aç</button></div>`);
};

V.store = () => {
  const k = S.storeKind;
  const shop = S.D.products;
  return sheet('', `<div class="row between center wrap gap"><div class="ttl" style="margin:0"><h1 style="font-size:34px">Mağaza</h1><p class="sub">Sunucu ürünleri ve Modrinth / CurseForge.</p></div>
    <div class="row gap"><button class="btn ${S.source === 'server' ? 'pri' : ''}" data-act="source" data-s="server">Sunucu</button><button class="btn ${S.source === 'modrinth' ? 'pri' : ''}" data-act="source" data-s="modrinth">Modrinth</button><button class="btn ${S.source === 'curseforge' ? 'pri' : ''}" data-act="source" data-s="curseforge">CurseForge</button></div></div>
    ${S.source === 'server' ? `<div class="cards">${shop.map((p, i) => `<div class="card3"><div class="cover" style="background:linear-gradient(135deg,${GRADS[i % 4]})">${safeUrl(p.imageUrl) ? `<img src="${esc(p.imageUrl)}" alt="">` : ''}</div><div class="body">${p.badge ? `<span class="chip" style="align-self:flex-start">${esc(p.badge)}</span>` : ''}<b>${esc(p.name)}</b><div class="muted" style="max-height:34px;overflow:hidden">${esc(p.description)}</div>
      <div class="row between center" style="margin-top:6px"><b style="color:#ffd166">${fmt(p.price)} Coin</b><button class="btn pri" style="height:32px;padding:0 14px" data-act="buy" data-id="${esc(p.id)}">Satın al</button></div></div></div>`).join('') || '<div class="muted">Mağaza boş.</div>'}</div>`
    : `<div class="row gap wrap">${Object.entries(KIND_LABEL).map(([id, t]) => `<button class="chip lg" style="border:0;cursor:pointer;${k === id ? 'background:rgba(var(--a1rgb),.35);color:#fff' : ''}" data-act="storeKind" data-k="${id}">${t}</button>`).join('')}</div>
    <div class="row gap"><input type="search" id="q" placeholder="${esc(S.source)} içinde ara…" value="${esc(S.query)}"><button class="btn pri" data-act="search">Ara</button></div>
    <div class="cards">${S.results.map((r) => {
      const key = r.source + r.projectId;
      const done = S.mods.user.some((m) => m.source === r.source && m.projectId === r.projectId);
      return `<div class="card3"><div class="cover" style="background:linear-gradient(135deg,${GRADS[r.name.length % 4]})"><img src="${safeUrl(r.iconUrl) ? esc(r.iconUrl) : 'assets/' + KIND_ICON[k]}" alt=""></div><div class="body"><b>${esc(r.name)}</b><div class="muted" style="max-height:34px;overflow:hidden">${esc(r.description)}</div>
        <div class="row between center" style="margin-top:6px"><span class="muted">${fmt(r.downloads)} indirme</span><button class="btn ${done ? 'ok' : 'pri'}" style="height:32px;padding:0 14px" data-act="install" data-s="${r.source}" data-id="${esc(r.projectId)}" data-k="${r.kind}" ${done || S.busy[key] ? 'disabled' : ''}>${done ? 'Kuruldu ✓' : S.busy[key] ? 'Kuruluyor…' : 'Kur'}</button></div></div></div>`;
    }).join('') || '<div class="muted">Arama yap veya listeyi yükle.</div>'}</div>`}`);
};

V.ads = () => sheet('', `<div class="ttl" style="margin:0"><h1 style="font-size:34px">Haberler</h1><p class="sub">Duyurular, etkinlikler ve kampanyalar.</p></div>
  <div class="grid3">${S.D.ads.map((a, i) => `<div class="card3"><div class="cover" style="background-image:${cover(a.imageUrl, i)}"></div><div class="body">${a.badge ? `<span class="chip" style="align-self:flex-start">${esc(a.badge)}</span>` : ''}<b>${esc(a.title)}</b><div class="muted">${esc(a.description)}</div>${safeUrl(a.url) ? `<a class="btn" style="margin-top:6px" href="${esc(a.url)}" target="_blank">Detay</a>` : ''}</div></div>`).join('') || '<div class="muted">Duyuru yok.</div>'}</div>`);

V.map = () => {
  const u = S.D.links.map;
  return `<div class="mapbox" style="background:linear-gradient(135deg,rgba(20,184,166,.35),rgba(124,92,255,.35)),url(assets/bg.jpg) center/cover">${u ? `<iframe class="mapframe" src="${esc(u)}" referrerpolicy="no-referrer"></iframe>` : '<div style="position:absolute;left:0;right:0;top:46%;text-align:center" class="muted">Harita adresi henüz eklenmemiş.</div>'}</div>`;
};

V.support = () => {
  const sel = S.tickets.find((t) => t.id === S.ticket);
  const closed = S.msgs && S.msgs.status === 'closed';
  return sheet(`<div class="subnav" style="width:330px;overflow:auto"><div class="row between center" style="padding:0 6px 8px"><h2>${S.ticketStaff ? 'Tüm talepler' : 'Taleplerim'}</h2><button class="btn" style="height:32px" data-act="ticketNewForm">+ Yeni</button></div>
    ${S.tickets.map((t) => `<button class="item" style="text-align:left;color:inherit;${t.id === S.ticket ? 'border-color:rgba(var(--a2rgb),.6)' : ''}" data-act="ticketSel" data-id="${t.id}"><div class="grow"><b>#${t.id} ${esc(t.subject)}</b><div class="muted">${esc(t.playerName)} · ${t.status === 'closed' ? 'Kapalı' : 'Açık'}</div></div></button>`).join('') || '<div class="muted">Talep yok.</div>'}</div>`,
    S.ticket === 'new' ? `${ttl('Yeni talep', 'Yetkililer en kısa sürede yanıtlayacak.')}${input('Konu', 'tSubject')}<label class="f">Mesaj<textarea id="tBody"></textarea></label><button class="btn pri" style="align-self:flex-start" data-act="ticketNew">Gönder</button>`
    : sel && S.msgs ? `<div class="row between center"><h1 style="font-size:26px">#${sel.id} ${esc(sel.subject)}</h1><span class="chip">${closed ? 'KAPALI' : 'AÇIK'}${S.msgs.assignedName ? ' · ' + esc(S.msgs.assignedName) : ''}</span></div>
      ${(S.msgs.messages || []).map((m) => `<div class="msg ${m.senderName === S.me.username ? 'mine' : ''}"><b>${esc(m.senderName)}</b> <span class="muted">${esc(m.senderRole || '')}</span><div>${esc(m.body)}</div></div>`).join('')}
      ${closed ? (S.ticketStaff ? '' : `<div class="row gap center" style="margin-top:auto"><span class="muted">Yardımı puanla:</span>${[1, 2, 3, 4, 5].map((s) => `<button class="btn" data-act="ticketRate" data-s="${s}">${'★'.repeat(s)}</button>`).join('')}</div>`)
        : `<div class="row gap" style="margin-top:auto"><input type="text" id="tReply" placeholder="Yanıtını yaz…"><button class="btn pri" data-act="ticketReply">Gönder</button>${S.ticketStaff ? '<button class="btn" data-act="ticketClaim">Üstlen</button>' : ''}<button class="btn" data-act="ticketClose">Kapat</button></div>`}`
    : '<div class="muted">Soldan bir talep seç ya da yeni talep aç.</div>');
};

const row = (t, d, ctl) => `<div class="setrow"><div><b>${t}</b><span class="d">${d}</span></div>${ctl}</div>`;
V.settings = () => {
  const s = S.set, t = S.setTab;
  const tabs = [['window', 'Pencere'], ['java', 'Java ve Bellek'], ['mods', 'Modlar'], ['server', 'Sunucu'], ['files', 'Dosyalar']];
  const save_ = '<div style="margin-top:auto"><button class="btn pri" data-act="saveSettings">Kaydet</button></div>';
  let body = '';
  if (t === 'window') body = row('Tam ekran', 'Oyunu tam ekran modunda başlat.', swc(s.fullscreen, 'data-act="flag" data-k="fullscreen" aria-label="Tam ekran"')) + row('Genişlik', 'Oyun penceresinin açılış genişliği.', `<div class="ctl"><input type="number" id="sW" value="${s.width}"></div>`) + row('Yükseklik', 'Oyun penceresinin açılış yüksekliği.', `<div class="ctl"><input type="number" id="sH" value="${s.height}"></div>`) + row('Başlayınca launcher\'ı küçült', 'Oyun açılınca launcher görev çubuğuna iner.', swc(s.minimizeOnLaunch, 'data-act="flag" data-k="minimizeOnLaunch" aria-label="Küçült"')) + save_;
  if (t === 'java') body = row('Ayrılan RAM', `Oyuna ayrılacak bellek: <b>${s.ramGb} GB</b>. Toplam belleğinin yarısını aşma.`, `<div class="ctl"><input class="range" type="range" min="2" max="32" value="${s.ramGb}" data-ch="ram"></div>`) + row('Java yolu', 'Boşsa launcher uygun Java\'yı kendisi seçer.', `<div class="ctl"><input type="text" id="sJava" value="${esc(s.javaPath)}" placeholder="Otomatik"></div>`) + save_;
  if (t === 'mods') body = row('Kurmadan önce uyumluluğu denetle', 'Mod sürümü ve loader eşleşmesini kontrol eder.', swc(s.checkCompat, 'data-act="flag" data-k="checkCompat" aria-label="Uyumluluk"')) + row('Kullanıcı modlarını yükle', 'Açık kullanıcı modları oyunla birlikte yüklenir.', swc(s.loadUserMods, 'data-act="flag" data-k="loadUserMods" aria-label="Yükle"')) + row('CurseForge API anahtarı', 'Modrinth için gerekmez.', `<div class="ctl"><input type="text" id="sKey" value="${esc(s.curseforgeApiKey)}" placeholder="console.curseforge.com"></div>`) + save_;
  if (t === 'server') body = row('Sunucu paketi', 'Panelde tanımlanan launcher sürümlerinden hangisiyle oynayacağın.', `<div class="ctl"><select data-ch="pack">${S.packs.map((p) => `<option value="${esc(p.Id)}" ${p.Id === s.packId ? 'selected' : ''}>${esc(p.Name)} ${esc(p.Version || '')}</option>`).join('') || '<option>Liste alınamadı</option>'}</select></div>`)
    + row('Profil', `${esc(s.profile.name)} · Minecraft ${esc(s.profile.mcVersion)} · ${esc(s.profile.loader)}`, '<span></span>')
    + row('API adresi', 'FireWing sitesinin API adresi. Değiştirirsen tekrar giriş yapman gerekir.', `<div class="ctl"><input type="text" id="sApi" value="${esc(s.apiUrl)}"></div>`) + save_;
  if (t === 'files') body = `<div class="grid2"><div class="panel hot"><div class="row between"><h2>Kullanıcı Modları</h2><span class="chip">YAZILABİLİR</span></div><div class="mono">usermods/</div><button class="btn" style="align-self:flex-start" data-act="open" data-w="user">Klasörü Aç</button></div><div class="panel"><div class="row between"><h2>Ana Mod Paketi</h2><span class="chip">SUNUCUDAN</span></div><div class="mono">mods/</div><button class="btn" style="align-self:flex-start" data-act="open" data-w="main">Klasörü Aç</button></div></div><div class="panel"><div class="row between center"><h2>Launcher klasörü</h2><button class="btn" data-act="open" data-w="root">Aç</button></div>${(S.files || []).map((f) => `<div class="item"><span class="chip">${f.dir ? 'klasör' : 'dosya'}</span><b>${esc(f.name)}</b></div>`).join('')}</div>`;
  return sheet(subnav(tabs, t, 'setTab', 'FireWing Launcher 0.1'), `${ttl('Ayarlar', 'İstemciyi ve launcher\'ı istediğin gibi ayarla.')}${body}`);
};

V.admin = () => {
  const t = S.adminTab, e = S.edit || {};
  const tabs = [['products', 'Ürünler'], ['ann', 'Duyurular'], ['links', 'Bağlantılar'], ['users', 'Kullanıcılar'], ['bans', 'Yasaklar']];
  let body = '';
  if (t === 'products') body = `<div class="grid2" style="grid-template-columns:minmax(0,1fr) 320px"><div style="display:flex;flex-direction:column;gap:10px">${S.D.products.map((p, i) => `<div class="item"><img class="ico" src="${safeUrl(p.imageUrl) ? esc(p.imageUrl) : `assets/icon-${['shield', 'gem', 'chest', 'sword'][i % 4]}.jpg`}" alt=""><div class="grow"><b>${esc(p.name)}</b><div class="muted">${esc(p.category)} · ${esc(p.type)}</div></div><b style="color:#ffd166">${fmt(p.price)}</b><button class="btn" data-act="pEdit" data-id="${esc(p.id)}">Düzenle</button><button class="btn danger" data-act="pDel" data-id="${esc(p.id)}">Sil</button></div>`).join('') || '<div class="muted">Ürün yok.</div>'}</div>
    <div class="panel hot"><h2>${e.id ? 'Ürünü Düzenle' : 'Yeni Ürün'}</h2>${input('Ürün adı', 'pName', e.name)}${input('Kategori', 'pCat', e.category || 'Genel')}${input('Fiyat (Coin)', 'pPrice', e.price || 0, 'number')}${input('Rozet', 'pBadge', e.badge)}${input('Görsel adresi', 'pImg', e.imageUrl)}${input('Teslimat komutu ({player})', 'pCmd', e.command)}<label class="f">Açıklama<textarea id="pDesc">${esc(e.description)}</textarea></label><div class="row gap"><button class="btn pri" data-act="pSave">Kaydet</button>${e.id ? '<button class="btn" data-act="pNew">Yeni</button>' : ''}</div></div></div>`;
  if (t === 'ann') body = `<div class="grid2"><div style="display:flex;flex-direction:column;gap:10px">${S.D.ads.map((a) => `<div class="item"><div class="grow"><b>${esc(a.title)}</b><div class="muted">${esc(a.badge)}</div></div><button class="btn danger" data-act="aDel" data-id="${esc(a.id)}">Sil</button></div>`).join('') || '<div class="muted">Duyuru yok.</div>'}</div>
    <div class="panel hot"><h2>Yeni Duyuru</h2>${input('Başlık', 'aTitle')}<label class="f">Açıklama<textarea id="aDesc"></textarea></label>${input('Rozet', 'aBadge', '', 'text', 'placeholder="ETKİNLİK"')}${input('Görsel adresi', 'aImg')}${input('Bağlantı (isteğe bağlı)', 'aLink', '', 'text', 'placeholder="https://"')}<button class="btn pri" data-act="aAdd">Yayınla</button></div></div>`;
  if (t === 'links') body = `<div class="panel hot" style="max-width:600px">${input('Discord davet adresi', 'lDiscord', S.D.links.discord)}${input('Web sitesi adresi', 'lWeb', S.D.links.web)}<div class="muted">Harita ve YouTube adresleri sitedeki panelden (Site ve Bağlantılar) eklenir.</div><button class="btn pri" style="align-self:flex-start" data-act="lSave">Kaydet</button></div>`;
  if (t === 'users') body = `<div class="panel hot"><div class="row gap">${input('Kullanıcı', 'uTarget')}${input('Uyarı süresi (dk)', 'uMin', 60, 'number')}${input('Sebep', 'uReason', 'Kural ihlali')}</div><div class="row gap"><button class="btn" data-act="uWarn">Uyar</button><button class="btn danger" data-act="uBan">Kalıcı yasakla</button></div></div>
    <div class="row gap"><input type="search" id="uQ" placeholder="Oyuncu ara" value="${esc(S.userQ || '')}"><button class="btn" data-act="uSearch">Ara</button></div>
    <div style="display:flex;flex-direction:column;gap:10px">${S.D.users.map((u) => `<div class="item" style="opacity:${u.banned ? .6 : 1}"><span class="head" style="width:40px;height:40px;font-size:16px">${esc(u.name[0])}</span><div class="grow"><b>${esc(u.name)}</b> <span class="chip">${esc(u.role)}</span><div class="muted">${fmt(u.coins)} Coin${u.banned ? ' · YASAKLI' : ''}${u.warnRemaining ? ' · uyarılı' : ''}</div></div>
      ${u.role === 'owner' ? '' : `<select style="width:140px;height:36px" data-ch="role" data-u="${esc(u.username)}">${ROLES.map((r) => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select><button class="btn" data-act="uPick" data-u="${esc(u.username)}">Seç</button>`}</div>`).join('') || '<div class="muted">Kullanıcı yok.</div>'}</div>`;
  if (t === 'bans') body = `<div style="display:flex;flex-direction:column;gap:10px">${S.D.bans.map((b) => `<div class="item"><div class="grow"><b>${esc(b.username)}</b><div class="muted">${esc(b.reason)} · ${esc(b.byAdmin)}</div></div><button class="btn" data-act="uUnban" data-u="${esc(b.username)}">Yasağı kaldır</button></div>`).join('') || '<div class="muted">Yasak yok.</div>'}</div>`;
  return sheet(subnav(tabs, t, 'adminTab', '<a href="#" data-act="openSitePanel" style="color:var(--a2)">Gelişmiş ayarlar için web paneli ↗</a>'), `${ttl('Panel', 'Değişiklikler hem sitede hem launcher\'da görünür.')}${body}`);
};

// ---------- çizim ----------
async function render() {
  renderChrome();
  if (S.view === 'settings' && S.setTab === 'files') S.files = await call(api.files.list());
  $('#content').innerHTML = (V[S.view] || V.home)();
}
async function refreshMods() { S.mods = await call(api.mods.list()); }
async function loadTickets() {
  const r = await R.call('ticket_list.php');
  S.tickets = r.tickets || []; S.ticketStaff = !!r.staff;
}
async function loadTicket() {
  S.msgs = typeof S.ticket === 'number' ? await R.call('ticket_messages.php', { ticketId: S.ticket, afterId: 0 }) : null;
}
async function loadAdmin() {
  if (S.adminTab === 'users') S.D.users = (await R.call('admin_users.php', { q: S.userQ || '' })).users || [];
  if (S.adminTab === 'bans') S.D.bans = (await R.call('admin_ban.php', { action: 'list' })).bans || [];
  if (S.adminTab === 'products') S.D.products = (await R.get('products.php')).products || [];
  if (S.adminTab === 'ann') S.D.ads = await R.get('ads.php');
}
async function go(v) {
  S.view = v;
  if (v === 'store' && S.source !== 'server' && !S.results.length) await doSearch();
  if (v === 'support') { await loadTickets(); await loadTicket(); }
  if (v === 'admin') await loadAdmin();
  if (v === 'account') await loadMe();
  if (v === 'settings' && !S.packs.length) S.packs = await call(api.remote.packs()).catch(() => []);
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
  async adminTab(el) { S.adminTab = el.dataset.k; S.edit = null; await loadAdmin(); },
  async goStore(el) { S.storeKind = el.dataset.k; S.source = 'modrinth'; S.results = []; S.view = 'store'; await doSearch(); },
  async storeKind(el) { S.storeKind = el.dataset.k; S.results = []; await doSearch(); },
  async source(el) { S.source = el.dataset.s; S.results = []; if (S.source !== 'server') await doSearch(); },
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
  async openSitePanel() { window.open(siteUrl() + 'panel.html', '_blank'); },
  async flag(el) { S.set = await call(api.settings.set({ [el.dataset.k]: !S.set[el.dataset.k] })); },
  async saveSettings() {
    const p = {};
    if (document.getElementById('sW')) { p.width = +val('sW') || 854; p.height = +val('sH') || 480; }
    if (document.getElementById('sJava')) p.javaPath = val('sJava');
    if (document.getElementById('sKey')) p.curseforgeApiKey = val('sKey');
    if (document.getElementById('sApi')) {
      const u = val('sApi').trim();
      if (!/^https?:\/\//.test(u)) throw new Error('API adresi http(s):// ile başlamalı.');
      p.apiUrl = u;
    }
    S.set = await call(api.settings.set(p));
    if (!S.set.loggedIn) { S.me = null; S.view = 'login'; toast('API adresi değişti, tekrar giriş yap.'); return; }
    toast('Ayarlar kaydedildi.');
  },
  async buy(el) {
    const p = S.D.products.find((x) => String(x.id) === el.dataset.id);
    if (!confirm(`${p ? p.name : 'Ürün'} satın alınsın mı?`)) return;
    const r = await R.call('buy.php', { productId: +el.dataset.id });
    toast(r.message); await loadMe();
  },
  async transfer() { const r = await R.call('transfer.php', { toUsername: val('tTo').trim(), amount: +val('tAmt') }); toast(r.message || 'Gönderildi.'); await loadMe(); },
  async pEdit(el) { S.edit = S.D.products.find((p) => String(p.id) === el.dataset.id); },
  async pNew() { S.edit = null; },
  async pDel(el) { if (!confirm('Ürün silinsin mi?')) return; await R.call('admin_delete_product.php', { id: el.dataset.id }); await loadAdmin(); },
  async pSave() {
    const e = S.edit || {};
    if (!val('pName').trim()) throw new Error('Ürün adı gerekli.');
    // Panelde gösterilmeyen alanlar (galeri, kit komutları, stok…) olduğu gibi korunur.
    await R.call('admin_save_product.php', { ...e, id: e.id || '', name: val('pName').trim(), category: val('pCat').trim(), price: +val('pPrice') || 0, badge: val('pBadge').trim(), imageUrl: val('pImg').trim(), command: val('pCmd').trim(), description: val('pDesc'), type: e.type || 'item', kitCommands: e.kitCommands || [], gallery: e.gallery || [], slots: e.slots || 1, stock: e.stock || 0, longDesc: e.longDesc || '' });
    S.edit = null; toast('Ürün kaydedildi.'); await loadAdmin();
  },
  async aAdd() {
    if (!val('aTitle').trim()) throw new Error('Başlık gerekli.');
    const url = val('aLink').trim();
    if (url && !safeUrl(url)) throw new Error('Bağlantı http(s):// ile başlamalı.');
    await R.call('admin_save_ad.php', { title: val('aTitle').trim(), description: val('aDesc').trim(), badge: val('aBadge').trim(), imageUrl: val('aImg').trim(), url });
    toast('Duyuru yayınlandı.'); await loadAdmin();
  },
  async aDel(el) { if (!confirm('Duyuru silinsin mi?')) return; await R.call('admin_delete_ad.php', { id: el.dataset.id }); await loadAdmin(); },
  async lSave() {
    for (const [key, id] of [['discord_url', 'lDiscord'], ['website_url', 'lWeb']]) {
      const v = val(id).trim();
      if (v && !safeUrl(v)) throw new Error('Adresler http(s):// ile başlamalı.');
      await R.call('admin_save_setting.php', { key, value: v });
    }
    await loadPublic(); toast('Kaydedildi.');
  },
  async uSearch() { S.userQ = val('uQ').trim(); await loadAdmin(); },
  async uPick(el) { S.pick = el.dataset.u; const i = document.getElementById('uTarget'); if (i) i.value = el.dataset.u; return 'keep'; },
  async uWarn() { const r = await R.call('admin_warn.php', { target: val('uTarget').trim(), minutes: +val('uMin'), reason: val('uReason') }); toast(r.message); await loadAdmin(); },
  async uBan() { const t = val('uTarget').trim(); if (!t || !confirm(`${t} kalıcı olarak yasaklansın mı?`)) return; const r = await R.call('admin_ban.php', { action: 'ban', target: t, reason: val('uReason'), byAdmin: S.me.username }); toast(r.message); await loadAdmin(); },
  async uUnban(el) { const r = await R.call('admin_ban.php', { action: 'unban', target: el.dataset.u }); toast(r.message); await loadAdmin(); },
  async ticketNewForm() { S.ticket = 'new'; S.msgs = null; },
  async ticketNew() {
    const r = await R.call('ticket_create.php', { subject: val('tSubject').trim(), message: val('tBody').trim() });
    toast(r.message || 'Talep açıldı.'); S.ticket = r.id; await loadTickets(); await loadTicket();
  },
  async ticketSel(el) { S.ticket = +el.dataset.id; await loadTicket(); },
  async ticketReply() { if (!val('tReply').trim()) return; await R.call('ticket_send.php', { ticketId: S.ticket, body: val('tReply').trim() }); await loadTicket(); },
  async ticketClaim() { const r = await R.call('ticket_claim.php', { ticketId: S.ticket }); toast(r.message); await loadTicket(); },
  async ticketClose() { const r = await R.call('ticket_close.php', { ticketId: S.ticket }); toast(r.message); await loadTickets(); await loadTicket(); },
  async ticketRate(el) { await R.call('ticket_rate.php', { ticketId: S.ticket, stars: +el.dataset.s }); toast('Teşekkürler!'); },
  async logout() { await call(api.remote.logout()); S.me = null; S.view = 'login'; },
  async play() {
    S.running = true; S.prog = { pct: 2, text: 'Başlatılıyor…' }; await render();
    try {
      await call(api.launch.start());
      S.set = await call(api.settings.get());
      await refreshMods();
      if (S.set.minimizeOnLaunch) api.win.minimize();
    } finally { S.running = false; await render(); }
  }
};

document.addEventListener('click', (e) => {
  const w = e.target.closest('[data-win]');
  if (w) return api.win[{ min: 'minimize', max: 'maximize', close: 'close' }[w.dataset.win]]();
  const n = e.target.closest('[data-nav]');
  if (n) { e.preventDefault(); return guard(() => go(n.dataset.nav)); }
  const a = e.target.closest('[data-act]');
  if (a && actions[a.dataset.act]) {
    e.preventDefault();
    guard(async () => { a.disabled = true; try { if ((await actions[a.dataset.act](a)) !== 'keep') await render(); } finally { a.disabled = false; } });
  }
});
document.addEventListener('change', (e) => {
  const c = e.target.dataset.ch;
  if (!c) return;
  guard(async () => {
    if (c === 'ram') S.set = await call(api.settings.set({ ramGb: +e.target.value }));
    if (c === 'pack') { S.set = await call(api.settings.set({ packId: e.target.value, packVersion: '' })); toast('Paket bir sonraki OYNA\'da indirilecek.'); }
    if (c === 'role') { const r = await R.call('admin_set_role.php', { target: e.target.dataset.u, role: e.target.value }); toast(r.message); await loadAdmin(); }
    await render();
  });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'q') guard(async () => { await doSearch(); await render(); }); });
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'loginForm') return;
  e.preventDefault();
  guard(async () => {
    const name = val('lNick').trim(), pass = val('lPass');
    if (!name || !pass) throw new Error('Kullanıcı adı ve şifre gerekli.');
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Giriş yapılıyor…';
    try {
      S.me = await call(api.remote.login(name, pass));
      S.set = await call(api.settings.get());
      await loadPublic();
      $('#toast').hidden = true;
      S.view = 'home'; await render();
    } finally { btn.disabled = false; btn.textContent = 'GİRİŞ YAP'; }
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
    await refreshMods();
    tickClock(); setInterval(tickClock, 30000);
    loadStatus(); setInterval(loadStatus, 60000);
    if (S.set.loggedIn) {
      try { await loadMe(); S.view = 'home'; } catch { S.view = 'login'; }
    }
    if (S.view !== 'login') await loadPublic().catch(() => {});
    await render();
  } catch (e) { toast(e.message, true); }
})();
