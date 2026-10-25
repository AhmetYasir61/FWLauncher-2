<?php
// PCoin paketleri — veritabanı tabanlı (admin panelinden yönetilir).
// Fiyat KURUŞ cinsindendir (PayTR kuruş ister). İlk açılışta varsayılanlar seed edilir.

function pw_coin_default_packages() {
    return [
        ['id' => '200PCoin',  'coins' => 200,  'price' => 200,  'name' => '200 PCoin',  'popular' => 0, 'sort' => 1,  'tebex_id'=> 7576250],
        ['id' => '400PCoin',  'coins' => 400,  'price' => 400,  'name' => '400 PCoin',  'popular' => 0, 'sort' => 2,  'tebex_id'=> 7576252],
        ['id' => '800PCoin',  'coins' => 800,  'price' => 800,  'name' => '800 PCoin',  'popular' => 1, 'sort' => 3,  'tebex_id'=> 7576253],
        ['id' => '1600PCoin', 'coins' => 1600, 'price' => 1600, 'name' => '1.600 PCoin', 'popular' => 0, 'sort' => 4,  'tebex_id'=> 7576255],
    ];
}

function pw_ensure_coin_table($link) {
    mysqli_query($link, "
        CREATE TABLE IF NOT EXISTS pw_coin_packages (
            id        VARCHAR(32) NOT NULL PRIMARY KEY,
            coins     INT NOT NULL,
            price     INT NOT NULL,
            old_price INT NOT NULL DEFAULT 0,
            name      VARCHAR(64) NOT NULL,
            popular   TINYINT NOT NULL DEFAULT 0,
            sort      INT NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    // Eski kurulumlara old_price sütununu ekle (üstü çizili indirim fiyatı, kuruş)
    $c = mysqli_query($link, "SHOW COLUMNS FROM pw_coin_packages LIKE 'old_price'");
    if ($c && mysqli_num_rows($c) === 0) {
        mysqli_query($link, "ALTER TABLE pw_coin_packages ADD old_price INT NOT NULL DEFAULT 0 AFTER price");
    }
    $c = mysqli_query($link, "SELECT COUNT(*) AS n FROM pw_coin_packages");
    $row = $c ? mysqli_fetch_assoc($c) : null;
    if (!$row || (int)$row['n'] === 0) {
        foreach (pw_coin_default_packages() as $p) {
            $st = mysqli_prepare($link, "INSERT INTO pw_coin_packages (id,coins,price,name,popular,sort) VALUES (?,?,?,?,?,?)");
            mysqli_stmt_bind_param($st, "siisii", $p['id'], $p['coins'], $p['price'], $p['name'], $p['popular'], $p['sort']);
            mysqli_stmt_execute($st);
            mysqli_stmt_close($st);
        }
    }
}

// paytr_create.php ve callback bu fonksiyonu kullanır (id => [coins, price, name, popular]).
function pw_coin_packages() {
    global $link;
    pw_ensure_coin_table($link);
    $out = [];
    $res = mysqli_query($link, "SELECT id,coins,price,old_price,name,popular FROM pw_coin_packages ORDER BY sort ASC, price ASC");
    while ($res && ($r = mysqli_fetch_assoc($res))) {
        $out[$r['id']] = ['coins' => (int)$r['coins'], 'price' => (int)$r['price'], 'oldPrice' => (int)$r['old_price'], 'name' => $r['name'], 'popular' => (int)$r['popular']];
    }
    if (!$out) {
        foreach (pw_coin_default_packages() as $p) {
            $out[$p['id']] = ['coins' => $p['coins'], 'price' => $p['price'], 'name' => $p['name'], 'popular' => $p['popular']];
        }
    }
    return $out;
}

function pw_price_label($cent) {
    // Fiyatlar sent cinsinden (4.24 USD = 424); gerçek tahsilatı Tebex yapar.
    return '$' . number_format(((int)$cent) / 100, 2, '.', ',');
}

// Ödeme kayıtları tablosunu (yoksa) oluştur.
function pw_ensure_payments_table($link) {
    mysqli_query($link, "
        CREATE TABLE IF NOT EXISTS pw_payments (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            merchant_oid VARCHAR(64)  NOT NULL,
            user_id      BIGINT       NOT NULL,
            username     VARCHAR(64)  NOT NULL,
            package_id   VARCHAR(128) NOT NULL,
            coins        INT          NOT NULL,
            amount       INT          NOT NULL,
            coupon       VARCHAR(32)  NOT NULL DEFAULT '',
            status       VARCHAR(16)  NOT NULL DEFAULT 'pending',
            created_at   BIGINT       NOT NULL,
            paid_at      BIGINT       NULL,
            UNIQUE KEY uniq_oid (merchant_oid)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    // Eski kurulum geçişi: kupon sütunu + çoklu paket için geniş package_id
    $c = mysqli_query($link, "SHOW COLUMNS FROM pw_payments LIKE 'coupon'");
    if ($c && mysqli_num_rows($c) === 0) {
        mysqli_query($link, "ALTER TABLE pw_payments ADD coupon VARCHAR(32) NOT NULL DEFAULT '' AFTER amount");
        mysqli_query($link, "ALTER TABLE pw_payments MODIFY package_id VARCHAR(128) NOT NULL");
    }
}

// --- Kuponlar (sepette % indirim) ---
function pw_ensure_coupons_table($link) {
    mysqli_query($link, "
        CREATE TABLE IF NOT EXISTS pw_coupons (
            code       VARCHAR(32) NOT NULL PRIMARY KEY,
            percent    INT NOT NULL,
            max_uses   INT NOT NULL DEFAULT 0,
            used       INT NOT NULL DEFAULT 0,
            active     TINYINT NOT NULL DEFAULT 1,
            created_at BIGINT NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
}

// Kupon doğrula: ['percent'=>..] veya ['error'=>mesaj] döner. $code normalize edilir.
function pw_coupon_lookup($link, &$code) {
    $code = strtoupper(preg_replace('/[^a-zA-Z0-9_\-]/', '', (string)$code));
    if ($code === '') return ['error' => 'Kupon kodu boş.'];
    pw_ensure_coupons_table($link);
    $st = mysqli_prepare($link, "SELECT percent, max_uses, used, active FROM pw_coupons WHERE code = ? LIMIT 1");
    mysqli_stmt_bind_param($st, "s", $code);
    mysqli_stmt_execute($st);
    mysqli_stmt_store_result($st);
    if (mysqli_stmt_num_rows($st) !== 1) { mysqli_stmt_close($st); return ['error' => 'Böyle bir kupon yok.']; }
    mysqli_stmt_bind_result($st, $percent, $maxUses, $used, $active);
    mysqli_stmt_fetch($st);
    mysqli_stmt_close($st);
    if (!(int)$active) return ['error' => 'Bu kupon artık geçerli değil.'];
    if ((int)$maxUses > 0 && (int)$used >= (int)$maxUses) return ['error' => 'Bu kuponun kullanım hakkı doldu.'];
    $percent = (int)$percent;
    if ($percent < 1 || $percent > 100) return ['error' => 'Kupon tanımı hatalı.'];
    return ['percent' => $percent];
}
