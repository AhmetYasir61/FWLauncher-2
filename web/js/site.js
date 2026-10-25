'use strict';
// Ana sayfa: sunucu durumu, haberler, mağaza, son destekler. İçerik panelden yönetilir.
const ICONS = ['shield', 'gem', 'chest', 'sword'];

$('#copyIp').addEventListener('click', async () => {
  const ip = $('#ip').textContent;
  try { await navigator.clipboard.writeText(ip); toast('IP kopyalandı: ' + ip); } catch { toast(ip); }
});

FW.get('server_status.php').then((s) => {
  $('#ip').textContent = s.port && s.port !== 25565 ? `${s.ip}:${s.port}` : s.ip;
  $('#dot').classList.toggle('on', s.online);
  $('#statusText').textContent = s.online ? `Çevrimiçi · ${fmt(s.players.online)} / ${fmt(s.players.max)} oyuncu` : 'Sunucu şu an kapalı';
}).catch(() => { $('#statusText').textContent = 'Sunucu durumu alınamadı'; });

// Panelden düzenlenen site metinleri (pw_site_content içindeki firewingSite alanı).
FW.get('site_content.php').then((r) => {
  const c = (r.content && r.content.firewingSite) || {};
  if (c.heroText) $('#heroText').textContent = c.heroText;
  if (c.versionLabel) $('#verChip').textContent = c.versionLabel;
  const dl = safeUrl(c.downloadUrl);
  if (dl) $('#dlBtn').href = dl; else { $('#dlBtn').textContent = 'Yakında'; $('#dlBtn').removeAttribute('href'); }
}).catch(() => {});

FW.get('ads.php').then((list) => {
  $('#news').innerHTML = list.slice(0, 6).map((a, i) => {
    const img = safeUrl(a.imageUrl), url = safeUrl(a.url);
    return `<article class="card"><div class="cv" style="background-image:${img ? `url('${esc(img)}')` : i === 0 ? 'url(assets/banner.jpg)' : `linear-gradient(135deg,${GRADS[i % 4]})`}"></div><div class="bd">${a.badge ? `<span class="chip">${esc(a.badge)}</span>` : ''}<h3>${esc(a.title)}</h3><p class="muted" style="margin:0">${esc(a.description)}</p>${url ? `<a class="btn sm" style="align-self:flex-start;margin-top:6px" href="${esc(url)}" target="_blank" rel="noopener">Detay</a>` : ''}</div></article>`;
  }).join('') || '<div class="muted">Henüz haber yok.</div>';
}).catch(() => { $('#news').innerHTML = '<div class="muted">Haberler yüklenemedi.</div>'; });

FW.get('products.php').then((r) => {
  const list = r.products || [];
  $('#products').innerHTML = list.slice(0, 9).map((p, i) => {
    const img = safeUrl(p.imageUrl);
    return `<article class="card"><div class="cv" style="height:120px;display:grid;place-items:center;background:linear-gradient(135deg,${GRADS[i % 4]})"><img src="${img ? esc(img) : `assets/icon-${ICONS[i % 4]}.jpg`}" alt="" style="width:72px;height:72px;border-radius:16px;object-fit:cover"></div><div class="bd">${p.badge ? `<span class="chip">${esc(p.badge)}</span>` : ''}<h3>${esc(p.name)}</h3><p class="muted" style="margin:0">${esc(p.description)}</p><div class="row" style="margin-top:auto;justify-content:space-between"><span class="price">${fmt(p.price)} Coin</span><a class="btn sm" href="panel.html#magaza">Satın al</a></div></div></article>`;
  }).join('') || '<div class="muted">Mağaza boş.</div>';
}).catch(() => { $('#products').innerHTML = '<div class="muted">Mağaza yüklenemedi.</div>'; });

FW.get('site_feed.php').then((f) => {
  const row = (name, right) => `<div class="item"><img src="https://mc-heads.net/avatar/${encodeURIComponent(name)}/32" alt="" width="32" height="32" style="border-radius:8px"><b class="grow">${esc(name)}</b><span class="muted">${right}</span></div>`;
  $('#topCoins').innerHTML = (f.topCoins || []).slice(0, 5).map((u) => row(u.name, `${fmt(u.coins)} Coin`)).join('') || '<div class="muted">Henüz veri yok.</div>';
  $('#topups').innerHTML = (f.topups || []).slice(0, 5).map((u) => row(u.name, `+${fmt(u.coins)} Coin`)).join('') || '<div class="muted">Henüz destek yok.</div>';
}).catch(() => { $('#feedSec').hidden = true; });

FW.get('settings.php').then((s) => {
  const d = safeUrl(s.discord_url);
  if (d) $('#discordBtn').href = d; else $('#discordBtn').hidden = true;
}).catch(() => {});

if (FW.loggedIn()) $('#accountBtn').textContent = FW.session().username;
