<?php
// tebex_result.php — Tebex checkout sonrası dönülen sayfa (paytr_result.php muadili).
// tebex_create.php basket'i complete_url = .../tebex_result.php?status=ok,
// cancel_url = .../tebex_result.php?status=fail ile oluşturur.
// Coin YÜKLEME burada YAPILMAZ — o iş güvenli olarak tebex_webhook.php'de olur.
$status = (($_GET['status'] ?? '') === 'ok') ? 'ok' : 'fail';
?><!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PokeWing — Ödeme</title>
<style>
  body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0a0f2c;color:#eaf0ff;
       display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
  .card{max-width:400px}
  h2{font-size:24px;margin:0 0 10px}
  p{color:#aab4dd;line-height:1.5}
  a.btn{display:inline-block;margin-top:16px;padding:10px 20px;background:linear-gradient(135deg,#46c4f2,#2a6df0);border-radius:11px;color:#fff;text-decoration:none;font-weight:700}
  .note{margin-top:12px;font-size:13px;color:#6f7cad}
</style>
</head>
<body>
  <div class="card">
    <?php if ($status === 'ok'): ?>
      <h2>✅ Ödeme başarılı</h2>
      <p>PCoin bakiyene birkaç dakika içinde eklenecek. Gelmezse Discord'da destek talebi aç.</p>
    <?php else: ?>
      <h2>❌ Ödeme tamamlanamadı</h2>
      <p>Bir sorun oluştu ya da işlem iptal edildi. Dilersen tekrar deneyebilirsin.</p>
    <?php endif; ?>
    <a class="btn" href="https://pokewing.com/">Ana Sayfaya Dön</a>
    <p class="note" id="pwCountdown"></p>
  </div>
  <script>
    // Bu sayfa hem site içi iframe'de (popup) hem de Tebex'in top-level yönlendirmesiyle
    // (tam sayfa) açılabilir. İframe'deysek parent'a haber ver; değilse birkaç saniye
    // sonra otomatik olarak ana siteye dön ki kullanıcı burada asılı kalmasın.
    var isEmbedded = window.parent && window.parent !== window;
    try { window.parent.postMessage({ type: 'pw_tebex', status: '<?php echo $status; ?>' }, '*'); } catch (e) {}
    if (!isEmbedded) {
      var secs = 5;
      var el = document.getElementById('pwCountdown');
      function tick() {
        el.textContent = secs + ' saniye içinde ana sayfaya yönlendirileceksin…';
        if (secs <= 0) { window.location.href = 'https://pokewing.com/'; return; }
        secs--; setTimeout(tick, 1000);
      }
      tick();
    }
  </script>
</body>
</html>
