'use strict';
// Oyuncu ve yönetim paneli. Tüm işlemler mevcut PHP API'sine (web/api) gider.

const P = { me: null, view: 'hesap', ticket: null, data: {} };
const STAFF_TICKET = ['owner', 'admin', 'moderator', 'rehber'];
const ROLES = ['player', 'rehber', 'moderator', 'admin'];
const isAdmin = () => P.me && P.me.isAdmin;
const isTicketStaff = () => P.me && STAFF_TICKET.includes(P.me.role);
const when = (ms) => (ms ? new Date(+ms).toLocaleString('tr-TR') : '—');
const val = (id) => (document.getElementById(id) || {}).value || '';

const MENU = () => [
  ['hesap', 'Hesabım'], ['coin', 'Coin Yükle'], ['magaza', 'Mağaza'], ['destek', 'Destek'],
  ...(isTicketStaff() ? [['talepler', 'Tüm Talepler']] : []),
  ...(isAdmin() ? [['istatistik', 'İstatistik'], ['kullanicilar', 'Kullanıcılar'], ['urunler', 'Ürünler'], ['duyurular', 'Duyurular'], ['surumler', 'Launcher Sürümleri'], ['paketler', 'Coin Paketleri'], ['kuponlar', 'Kuponlar'], ['site', 'Site ve Bağlantılar'], ['yasaklar', 'Yasaklar']] : [])
];

// ---------------- giriş / kayıt ----------------
function renderAuth(mode = 'login') {
  $('#who').textContent = '';
  $('#app').innerHTML = `<form class="authcard" id="authForm">
    <div class="row"><img src="assets/logo.png" alt="" width="54" height="54"><div><h2 style="font-size:26px">${mode === 'login' ? 'Giriş yap' : 'Kayıt ol'}</h2><div class="muted">Oyundaki hesabınla aynı kullanıcı adı ve şifre.</div></div></div>
    <div class="tabs"><button type="button" class="${mode === 'login' ? 'on' : ''}" data-mode="login">Giriş</button><button type="button" class="${mode === 'register' ? 'on' : ''}" data-mode="register">Kayıt</button></div>
    <label class="f">Kullanıcı adı<input id="aUser" required maxlength="16" autocomplete="username"></label>
    ${mode === 'register' ? '<label class="f">E-posta<input id="aMail" type="email" required autocomplete="email"></label>' : ''}
    <label class="f">Şifre<input id="aPass" type="password" required autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></label>
    <button class="btn pri" type="submit">${mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}</button>
    ${mode === 'login' ? '<a class="muted" href="api/sifremi_unuttum.html" style="text-align:center">Şifremi unuttum</a>' : ''}
  </form>`;
  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => renderAuth(b.dataset.mode)));
  $('#authForm').addEventListener('submit', (e) => {
    e.preventDefault();
    run(async () => {
      if (mode === 'register') {
        const r = await FW.register(val('aUser').trim(), val('aMail').trim(), val('aPass'));
        toast(r.message || 'Kayıt tamam.');
        return renderAuth('login');
      }
      await FW.login(val('aUser').trim(), val('aPass'));
      await boot();
    });
  });
}

// ---------------- iskelet ----------------
async function run(fn) { try { await fn(); } catch (e) { toast(e.message, true); } }

function shell(content) {
  $('#who').innerHTML = `${esc(P.me.username)} · <b style="color:var(--gold)">${fmt(P.me.coins)} Coin</b> <button class="btn sm" id="logout" style="margin-left:8px">Çıkış</button>`;
  $('#app').innerHTML = `<div class="panelapp"><nav class="side">${MENU().map(([k, t]) => `<button data-go="${k}" class="${P.view === k ? 'on' : ''}">${t}</button>`).join('')}</nav><div id="view">${content}</div></div>`;
  $('#logout').addEventListener('click', () => run(async () => { await FW.logout(); P.me = null; renderAuth(); }));
}

async function go(view) {
  if (!MENU().some(([k]) => k === view)) view = 'hesap';
  P.view = view;
  history.replaceState(null, '', '#' + view);
  shell('<div class="muted">Yükleniyor…</div>');
  try { $('#view').innerHTML = await V[view](); } catch (e) { $('#view').innerHTML = `<div class="box"><b>Yüklenemedi</b><div class="muted">${esc(e.message)}</div></div>`; }
}
const refresh = () => go(P.view);

const V = {};
const field = (label, id, value = '', type = 'text', extra = '') => `<label class="f">${label}<input id="${id}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const area = (label, id, value = '') => `<label class="f">${label}<textarea id="${id}">${esc(value)}</textarea></label>`;

// ---------------- oyuncu bölümleri ----------------
V.hesap = async () => `<div class="box"><div class="row"><img src="https://mc-heads.net/avatar/${encodeURIComponent(P.me.username)}/64" width="64" height="64" alt="" style="border-radius:14px"><div class="grow"><span class="chip">${esc(P.me.role)}</span><h2 style="font-size:28px;margin-top:4px">${esc(P.me.username)}</h2></div><div style="text-align:right"><div class="muted">Bakiye</div><div class="price" style="font-size:28px">${fmt(P.me.coins)}</div></div></div></div>
  <div class="box"><h3>Coin gönder</h3><div class="muted">Bir arkadaşına coin gönder.</div>
    <div class="row">${field('Alıcı', 'tTo')}${field('Miktar', 'tAmt', '', 'number', 'min="1"')}</div><button class="btn pri" data-act="transfer" style="align-self:flex-start">Gönder</button></div>`;

V.coin = async () => {
  const r = await FW.get('coin_packages_list.php');
  return `<div class="box"><h2>Coin Yükle</h2><div class="muted">Ödeme Tebex üzerinden güvenli şekilde alınır.</div>
    <div class="row">${field('Kupon kodu (isteğe bağlı)', 'cCode')}<button class="btn" data-act="coupon" style="align-self:flex-end">Kontrol et</button></div>
    <div class="grid3">${(r.packages || []).map((p) => `<div class="feat"><div class="row" style="justify-content:space-between"><h3>${esc(p.name)}</h3>${p.popular ? '<span class="chip">POPÜLER</span>' : ''}</div><div class="price" style="font-size:30px;margin:8px 0">${fmt(p.coins)} Coin</div><div>${p.oldPriceLabel ? `<s class="muted">${esc(p.oldPriceLabel)}</s> ` : ''}<b>${esc(p.priceLabel)}</b></div><button class="btn pri" style="margin-top:12px;width:100%" data-act="topup" data-id="${esc(p.id)}">Satın al</button></div>`).join('') || '<div class="muted">Paket yok.</div>'}</div></div>`;
};

V.magaza = async () => {
  const r = await FW.get('products.php');
  P.data.products = r.products || [];
  return `<div class="box"><h2>Mağaza</h2><div class="muted">Coin ile satın aldığın ürünler oyuna girdiğinde otomatik teslim edilir.</div>
    <div class="grid3">${P.data.products.map((p, i) => `<div class="card"><div class="cv" style="height:110px;display:grid;place-items:center;background:linear-gradient(135deg,${GRADS[i % 4]})">${safeUrl(p.imageUrl) ? `<img src="${esc(p.imageUrl)}" alt="" style="width:70px;height:70px;border-radius:14px;object-fit:cover">` : ''}</div><div class="bd">${p.badge ? `<span class="chip">${esc(p.badge)}</span>` : ''}<h3>${esc(p.name)}</h3><p class="muted" style="margin:0">${esc(p.description)}</p><div class="row" style="justify-content:space-between;margin-top:auto"><span class="price">${fmt(p.price)} Coin</span><button class="btn pri sm" data-act="buy" data-id="${esc(p.id)}">Satın al</button></div></div></div>`).join('') || '<div class="muted">Ürün yok.</div>'}</div></div>`;
};

async function ticketsView(all) {
  const r = await FW.call('ticket_list.php');
  const list = r.tickets || [];
  let thread = '';
  if (P.ticket) {
    const m = await FW.call('ticket_messages.php', { ticketId: P.ticket, afterId: 0 });
    const t = list.find((x) => x.id === P.ticket) || {};
    const closed = m.status === 'closed';
    thread = `<div class="box"><div class="row" style="justify-content:space-between"><h3>#${P.ticket} ${esc(t.subject || '')}</h3><span class="chip">${closed ? 'Kapalı' : 'Açık'}${m.assignedName ? ' · ' + esc(m.assignedName) : ''}</span></div>
      <div style="display:flex;flex-direction:column;gap:8px">${(m.messages || []).map((x) => `<div class="msg ${x.senderName === P.me.username ? 'mine' : ''} ${STAFF_TICKET.includes(x.senderRole) ? 'staff' : ''}"><b>${esc(x.senderName)}</b> <span class="muted">${esc(x.senderRole || '')}</span><div>${esc(x.body)}</div></div>`).join('')}</div>
      ${closed ? (!r.staff && !t.rating ? `<div class="row"><span class="muted">Yardımı puanla:</span>${[1, 2, 3, 4, 5].map((s) => `<button class="btn sm" data-act="rate" data-s="${s}">${'★'.repeat(s)}</button>`).join('')}</div>` : '')
        : `<div class="row">${field('', 'tReply')}<button class="btn pri" data-act="reply">Gönder</button>${r.staff ? '<button class="btn" data-act="claim">Üstlen</button>' : ''}<button class="btn" data-act="close">Kapat</button>${all && isAdmin() ? '<button class="btn danger" data-act="tdel">Sil</button>' : ''}</div>`}</div>`;
  }
  return `<div class="box"><div class="row" style="justify-content:space-between"><h2>${all ? 'Tüm Talepler' : 'Destek'}</h2></div>
    ${list.map((t) => `<button class="item" style="text-align:left;color:inherit;cursor:pointer;${t.id === P.ticket ? 'border-color:rgba(255,176,61,.6)' : ''}" data-act="topen" data-id="${t.id}"><b class="grow">#${t.id} ${esc(t.subject)}</b><span class="muted">${esc(t.playerName)} · ${t.status === 'closed' ? 'Kapalı' : 'Açık'}</span></button>`).join('') || '<div class="muted">Talep yok.</div>'}</div>
    ${thread}
    ${all ? '' : `<div class="box"><h3>Yeni talep</h3>${field('Konu', 'nSubject')}${area('Mesaj', 'nMsg')}<button class="btn pri" data-act="tnew" style="align-self:flex-start">Talep aç</button></div>`}`;
}
V.destek = () => ticketsView(false);
V.talepler = () => ticketsView(true);

// ---------------- yönetim bölümleri ----------------
V.istatistik = async () => {
  const [s, o] = await Promise.all([FW.call('admin_stats.php'), FW.call('admin_orders.php')]);
  return `<div class="box"><h2>İstatistik</h2><div class="stats"><div class="stat"><span class="muted">Toplam oyuncu</span><b>${fmt(s.totalPlayers)}</b></div><div class="stat"><span class="muted">Son 24 saatte kayıt</span><b>${fmt(s.newMembers24h)}</b></div><div class="stat"><span class="muted">Bugünkü gelir</span><b>${esc(s.revenueLabel)}</b></div></div></div>
    <div class="box"><h3>Son siparişler</h3><div style="overflow-x:auto"><table><tr><th>Oyuncu</th><th>Ürün</th><th>Tutar</th><th>Durum</th><th>Zaman</th></tr>${(o.orders || []).map((x) => `<tr><td>${esc(x.player)}</td><td>${esc(x.product)}</td><td>${esc(x.price)}</td><td>${esc(x.status)}</td><td>${when(x.when)}</td></tr>`).join('')}</table></div></div>`;
};

V.kullanicilar = async () => {
  const r = await FW.call('admin_users.php', { q: P.data.userQ || '' });
  return `<div class="box"><h2>Kullanıcılar</h2><div class="row"><input id="uQ" placeholder="Kullanıcı ara" value="${esc(P.data.userQ || '')}" style="flex:1"><button class="btn" data-act="usearch">Ara</button></div>
    ${(r.users || []).map((u) => `<div class="item"><img src="https://mc-heads.net/avatar/${encodeURIComponent(u.name)}/32" width="32" height="32" alt="" style="border-radius:8px"><div class="grow"><b>${esc(u.name)}</b> <span class="chip">${esc(u.role)}</span><div class="muted">${fmt(u.coins)} Coin${u.banned ? ' · YASAKLI' : ''}${u.warnRemaining ? ' · uyarılı' : ''}</div></div>
      ${u.role === 'owner' ? '' : `<select data-role="${esc(u.username)}" style="width:140px">${ROLES.map((x) => `<option ${x === u.role ? 'selected' : ''}>${x}</option>`).join('')}</select><button class="btn sm" data-act="warn" data-u="${esc(u.username)}">Uyar</button>${u.banned ? `<button class="btn sm" data-act="unban" data-u="${esc(u.username)}">Yasağı kaldır</button>` : `<button class="btn sm danger" data-act="ban" data-u="${esc(u.username)}">Yasakla</button>`}`}</div>`).join('') || '<div class="muted">Kullanıcı yok.</div>'}</div>`;
};

V.urunler = async () => {
  const r = await FW.get('products.php');
  P.data.products = r.products || [];
  const e = P.data.editProduct || {};
  return `<div class="box"><h2>Ürünler</h2>${P.data.products.map((p) => `<div class="item"><b class="grow">${esc(p.name)} <span class="muted">· ${esc(p.category)} · ${esc(p.type)}</span></b><span class="price" style="font-size:16px">${fmt(p.price)}</span><button class="btn sm" data-act="pedit" data-id="${esc(p.id)}">Düzenle</button><button class="btn sm danger" data-act="pdel" data-id="${esc(p.id)}">Sil</button></div>`).join('') || '<div class="muted">Ürün yok.</div>'}</div>
  <div class="box"><h3>${e.id ? 'Ürünü düzenle' : 'Yeni ürün'}</h3>
    <div class="grid3">${field('Ad', 'pName', e.name)}${field('Kategori', 'pCat', e.category || 'Genel')}<label class="f">Tür<select id="pType">${['item', 'rank', 'kit', 'command'].map((t) => `<option ${t === (e.type || 'item') ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${field('Fiyat (coin)', 'pPrice', e.price || 0, 'number')}${field('Rozet', 'pBadge', e.badge)}${field('Görsel adresi', 'pImg', e.imageUrl)}${field('Stok (0 = sınırsız)', 'pStock', e.stock || 0, 'number')}${field('Slot', 'pSlots', e.slots || 1, 'number')}</div>
    ${area('Kısa açıklama', 'pDesc', e.description)}${area('Uzun açıklama', 'pLong', e.longDesc)}
    ${field('Teslimat komutu ({player} oyuncu adıyla değişir)', 'pCmd', e.command)}${area('Kit komutları (her satıra bir komut)', 'pKit', (e.kitCommands || []).join('\n'))}${area('Galeri görselleri (her satıra bir adres)', 'pGal', (e.gallery || []).join('\n'))}
    <div class="row"><button class="btn pri" data-act="psave">Kaydet</button>${e.id ? '<button class="btn" data-act="pnew">Yeni ürün</button>' : ''}</div></div>`;
};

V.duyurular = async () => {
  const list = await FW.get('ads.php');
  return `<div class="box"><h2>Duyurular</h2><div class="muted">Hem sitede hem launcher'da görünür.</div>${list.map((a) => `<div class="item"><b class="grow">${esc(a.title)} <span class="muted">· ${esc(a.badge)}</span></b><button class="btn sm danger" data-act="adel" data-id="${esc(a.id)}">Sil</button></div>`).join('') || '<div class="muted">Duyuru yok.</div>'}</div>
  <div class="box"><h3>Yeni duyuru</h3>${field('Başlık', 'aTitle')}${area('Açıklama', 'aDesc')}<div class="grid3">${field('Rozet', 'aBadge', '', 'text', 'placeholder="ETKİNLİK"')}${field('Görsel adresi', 'aImg')}${field('Bağlantı', 'aUrl')}</div><button class="btn pri" data-act="asave" style="align-self:flex-start">Yayınla</button></div>`;
};

const PACK_KEYS = [['Id', 'Kimlik'], ['Name', 'Ad'], ['Version', 'Sürüm'], ['McVersion', 'Minecraft sürümü'], ['Loader', 'Loader'], ['ZipUrl', 'Mod paketi zip adresi'], ['LoaderInstallerUrl', 'Loader kurulum adresi'], ['ForgeInstallerUrl', 'Forge kurulum adresi'], ['JavaUrl', 'Java adresi'], ['ServerIp', 'Sunucu IP'], ['ServerPort', 'Port'], ['Mode', 'Mod (cobblemon/roleplay)'], ['Description', 'Açıklama']];
const packsHtml = () => `<div class="box"><h2>Launcher Sürümleri</h2><div class="muted">Launcher'ın indireceği ana mod paketleri (Versions/modpacks.json). Launcher bir sonraki açılışta yeni listeyi görür.</div></div>
  ${P.data.packs.map((p, i) => `<div class="box"><div class="row" style="justify-content:space-between"><h3>${esc(p.Name || 'Yeni paket')}</h3><button class="btn sm danger" data-act="packdel" data-i="${i}">Kaldır</button></div><div class="grid3">${PACK_KEYS.map(([k, t]) => field(t, `pk_${i}_${k}`, p[k] ?? '')).join('')}</div></div>`).join('')}
  <div class="row"><button class="btn" data-act="packadd">+ Paket ekle</button><button class="btn pri" data-act="packsave">Kaydet</button></div>`;
V.surumler = async () => {
  if (!P.data.packs) {
    const r = await FW.call('versions_admin.php', { action: 'get' });
    P.data.packs = r.packs && r.packs.length ? r.packs : [{ Id: 'firewing', Name: 'FireWing Network', ServerIp: 'play.firewing.store', ServerPort: 25565, McVersion: '1.21.4', Loader: 'neoforge' }];
  }
  return packsHtml();
};

const cpHtml = () => `<div class="box"><h2>Coin Paketleri</h2><div class="muted">Fiyatlar kuruş cinsinden (29,00 TL = 2900). Tebex ürün numarası coin_packages.php içinde eşlenir.</div></div>
  ${P.data.coinPkgs.map((p, i) => `<div class="box"><div class="grid3">${field('Kimlik', `cp_${i}_id`, p.id)}${field('Ad', `cp_${i}_name`, p.name)}${field('Coin', `cp_${i}_coins`, p.coins, 'number')}${field('Fiyat (kuruş)', `cp_${i}_price`, p.price, 'number')}${field('Eski fiyat (kuruş)', `cp_${i}_oldPrice`, p.oldPrice, 'number')}<label class="f">Popüler<select id="cp_${i}_popular"><option value="0">Hayır</option><option value="1" ${p.popular ? 'selected' : ''}>Evet</option></select></label></div><button class="btn sm danger" data-act="cpdel" data-i="${i}" style="align-self:flex-start">Kaldır</button></div>`).join('')}
  <div class="row"><button class="btn" data-act="cpadd">+ Paket ekle</button><button class="btn pri" data-act="cpsave">Kaydet</button></div>`;
V.paketler = async () => {
  if (!P.data.coinPkgs) P.data.coinPkgs = (await FW.get('coin_packages_list.php')).packages || [];
  return cpHtml();
};

V.kuponlar = async () => {
  const r = await FW.call('coupons_admin.php', { action: 'list' });
  return `<div class="box"><h2>Kuponlar</h2>${(r.coupons || []).map((c) => `<div class="item"><b class="grow">${esc(c.code)} <span class="muted">· %${c.percent} · ${c.used}/${c.maxUses || '∞'} kullanım${c.active ? '' : ' · pasif'}</span></b><button class="btn sm danger" data-act="kdel" data-c="${esc(c.code)}">Sil</button></div>`).join('') || '<div class="muted">Kupon yok.</div>'}</div>
  <div class="box"><h3>Yeni kupon</h3><div class="grid3">${field('Kod', 'kCode')}${field('İndirim %', 'kPct', 10, 'number')}${field('En fazla kullanım (0 = sınırsız)', 'kMax', 0, 'number')}</div><button class="btn pri" data-act="ksave" style="align-self:flex-start">Kaydet</button></div>`;
};

V.site = async () => {
  const [c, s] = await Promise.all([FW.get('site_content.php'), FW.get('settings.php')]);
  P.data.content = (c.content && typeof c.content === 'object' && !Array.isArray(c.content)) ? c.content : {};
  const f = P.data.content.firewingSite || {};
  return `<div class="box"><h2>Site ve Bağlantılar</h2>${field('Discord davet adresi', 'sDiscord', s.discord_url)}${field('Web sitesi adresi', 'sWeb', s.website_url)}<button class="btn pri" data-act="linksave" style="align-self:flex-start">Bağlantıları kaydet</button></div>
  <div class="box"><h3>Ana sayfa metinleri</h3>${area('Tanıtım yazısı', 'sHero', f.heroText)}${field('Üst etiket (ör. 1.21.4 · NeoForge)', 'sVer', f.versionLabel)}${field('Launcher indirme adresi', 'sDl', f.downloadUrl)}<button class="btn pri" data-act="contentsave" style="align-self:flex-start">Kaydet</button></div>`;
};

V.yasaklar = async () => {
  const r = await FW.call('admin_ban.php', { action: 'list' });
  return `<div class="box"><h2>Yasaklar</h2>${(r.bans || []).map((b) => `<div class="item"><b class="grow">${esc(b.username)} <span class="muted">· ${esc(b.reason)} · ${esc(b.byAdmin)}${b.hasHwid ? ' · cihaz' : ''}</span></b><button class="btn sm" data-act="unban" data-u="${esc(b.username)}">Kaldır</button></div>`).join('') || '<div class="muted">Yasak yok.</div>'}</div>`;
};

// ---------------- işlemler ----------------
const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const A = {
  async transfer() { const r = await FW.call('transfer.php', { toUsername: val('tTo').trim(), amount: +val('tAmt') }); toast(r.message || 'Gönderildi.'); await loadMe(); },
  async coupon() { const r = await FW.call('coupon_check.php', { code: val('cCode').trim() }); toast(r.valid ? `Kupon geçerli: %${r.percent} indirim` : (r.message || 'Kupon geçersiz.'), !r.valid); return false; },
  async topup(el) {
    const r = await FW.call('tebex_create.php', { packageId: el.dataset.id, coupon: val('cCode').trim() });
    const u = safeUrl(r.checkoutUrl);
    if (!u) throw new Error('Ödeme sayfası alınamadı.');
    location.href = u;
    return false;
  },
  async buy(el) { const p = P.data.products.find((x) => String(x.id) === el.dataset.id); if (!confirm(`${p ? p.name : 'Ürün'} satın alınsın mı?`)) return false; const r = await FW.call('buy.php', { productId: +el.dataset.id }); toast(r.message); await loadMe(); },
  async topen(el) { P.ticket = +el.dataset.id; },
  async tnew() { const r = await FW.call('ticket_create.php', { subject: val('nSubject').trim(), message: val('nMsg').trim() }); P.ticket = r.id; toast(r.message || 'Talep açıldı.'); },
  async reply() { await FW.call('ticket_send.php', { ticketId: P.ticket, body: val('tReply').trim() }); },
  async claim() { const r = await FW.call('ticket_claim.php', { ticketId: P.ticket }); toast(r.message); },
  async close() { const r = await FW.call('ticket_close.php', { ticketId: P.ticket }); toast(r.message); },
  async rate(el) { await FW.call('ticket_rate.php', { ticketId: P.ticket, stars: +el.dataset.s }); toast('Teşekkürler!'); },
  async tdel() { if (!confirm('Talep silinsin mi?')) return false; await FW.call('ticket_delete.php', { ticketId: P.ticket }); P.ticket = null; },
  async usearch() { P.data.userQ = val('uQ').trim(); },
  async warn(el) { const m = prompt(`${el.dataset.u} kaç dakika uyarılsın?`, '60'); if (!m) return false; const reason = prompt('Sebep', 'Kural ihlali') || ''; const r = await FW.call('admin_warn.php', { target: el.dataset.u, minutes: +m, reason }); toast(r.message); },
  async ban(el) { const reason = prompt(`${el.dataset.u} kalıcı yasaklansın. Sebep:`, 'Kural ihlali'); if (reason === null) return false; const r = await FW.call('admin_ban.php', { action: 'ban', target: el.dataset.u, reason, byAdmin: P.me.username }); toast(r.message); },
  async unban(el) { const r = await FW.call('admin_ban.php', { action: 'unban', target: el.dataset.u }); toast(r.message); },
  async pedit(el) { P.data.editProduct = P.data.products.find((x) => String(x.id) === el.dataset.id); },
  async pnew() { P.data.editProduct = null; },
  async pdel(el) { if (!confirm('Ürün silinsin mi?')) return false; await FW.call('admin_delete_product.php', { id: el.dataset.id }); toast('Silindi.'); },
  async psave() {
    const e = P.data.editProduct || {};
    await FW.call('admin_save_product.php', { id: e.id || '', name: val('pName').trim(), category: val('pCat').trim(), type: val('pType'), price: +val('pPrice') || 0, badge: val('pBadge').trim(), imageUrl: val('pImg').trim(), stock: +val('pStock') || 0, slots: +val('pSlots') || 1, description: val('pDesc'), longDesc: val('pLong'), command: val('pCmd').trim(), kitCommands: lines(val('pKit')), gallery: lines(val('pGal')) });
    P.data.editProduct = null; toast('Ürün kaydedildi.');
  },
  async asave() { await FW.call('admin_save_ad.php', { title: val('aTitle').trim(), description: val('aDesc').trim(), badge: val('aBadge').trim(), imageUrl: val('aImg').trim(), url: val('aUrl').trim() }); toast('Duyuru yayınlandı.'); },
  async adel(el) { if (!confirm('Duyuru silinsin mi?')) return false; await FW.call('admin_delete_ad.php', { id: el.dataset.id }); },
  readPacks() { P.data.packs = P.data.packs.map((p, i) => Object.fromEntries(PACK_KEYS.map(([k]) => [k, val(`pk_${i}_${k}`)]))); },
  async packadd() { A.readPacks(); P.data.packs.push({ ServerIp: 'play.firewing.store', ServerPort: 25565 }); $('#view').innerHTML = packsHtml(); return false; },
  async packdel(el) { A.readPacks(); P.data.packs.splice(+el.dataset.i, 1); $('#view').innerHTML = packsHtml(); return false; },
  async packsave() { A.readPacks(); const r = await FW.call('versions_admin.php', { action: 'save', packs: P.data.packs }); toast(r.message); },
  readCp() { P.data.coinPkgs = P.data.coinPkgs.map((p, i) => ({ id: val(`cp_${i}_id`), name: val(`cp_${i}_name`), coins: +val(`cp_${i}_coins`), price: +val(`cp_${i}_price`), oldPrice: +val(`cp_${i}_oldPrice`), popular: val(`cp_${i}_popular`) === '1', sort: i })); },
  async cpadd() { A.readCp(); P.data.coinPkgs.push({ id: 'p' + Date.now().toString(36), name: '', coins: 0, price: 0, oldPrice: 0 }); $('#view').innerHTML = cpHtml(); return false; },
  async cpdel(el) { A.readCp(); P.data.coinPkgs.splice(+el.dataset.i, 1); $('#view').innerHTML = cpHtml(); return false; },
  async cpsave() { A.readCp(); await FW.call('coin_packages_save.php', { packages: P.data.coinPkgs }); toast('Paketler kaydedildi.'); },
  async ksave() { await FW.call('coupons_admin.php', { action: 'save', code: val('kCode').trim(), percent: +val('kPct'), maxUses: +val('kMax'), active: 1 }); toast('Kupon kaydedildi.'); },
  async kdel(el) { await FW.call('coupons_admin.php', { action: 'delete', code: el.dataset.c }); },
  async linksave() {
    for (const [key, id] of [['discord_url', 'sDiscord'], ['website_url', 'sWeb']]) await FW.call('admin_save_setting.php', { key, value: val(id).trim() });
    toast('Bağlantılar kaydedildi.');
  },
  async contentsave() {
    // Diğer alanlara dokunmadan sadece bu sitenin bölümünü güncelle.
    const content = { ...P.data.content, firewingSite: { heroText: val('sHero').trim(), versionLabel: val('sVer').trim(), downloadUrl: val('sDl').trim() } };
    await FW.call('site_content_save.php', { content }); toast('Kaydedildi.');
  }
};
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { P.ticket = null; P.data.packs = null; P.data.coinPkgs = null; return go(g.dataset.go); }
  const a = e.target.closest('[data-act]');
  if (a && A[a.dataset.act]) run(async () => { a.disabled = true; try { const r = await A[a.dataset.act](a); if (r !== false) await refresh(); } finally { a.disabled = false; } });
});
document.addEventListener('change', (e) => {
  const t = e.target.dataset.role;
  if (t) run(async () => { const r = await FW.call('admin_set_role.php', { target: t, role: e.target.value }); toast(r.message); await refresh(); });
});

async function loadMe() { P.me = await FW.call('me.php'); }
async function boot() {
  if (!FW.loggedIn()) return renderAuth();
  try { await loadMe(); } catch { return renderAuth(); }
  await go((location.hash || '#hesap').slice(1));
}
boot();
