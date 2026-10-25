<?php
// ============================================================
//  PokeWing — Kayıt (AuthMe uyumlu, şema-otomatik)
//  authme tablosundaki kolonları kendisi okur; NOT NULL ama
//  varsayılansız kolonları güvenli sıfır/boş ile doldurur.
//  Böylece "Kayıt oluşturulamadı" hatası (INSERT patlaması) biter.
// ============================================================
require_once "pw_common.php";
require_once "config.php";

$d        = pw_body();
$username = trim($d['username'] ?? '');
$email    = trim($d['email'] ?? '');
$password = (string)($d['password'] ?? '');
$deviceId = trim($d['deviceId'] ?? '');

// --- Doğrulama ---
if ($username === '' || $email === '' || $password === '')
    pw_fail('Tüm alanlar doldurulmalıdır.');

if (!preg_match('/^[a-zA-Z0-9_]{3,16}$/', $username))
    pw_fail('Kullanıcı adı 3-16 karakter olmalı; yalnızca harf, rakam ve alt çizgi (_) içerebilir.');

if (!filter_var($email, FILTER_VALIDATE_EMAIL))
    pw_fail('Geçerli bir e-posta adresi gir.');

if (strlen($password) < 6)
    pw_fail('Şifre en az 6 karakter olmalı.');

$lower = strtolower($username);

// --- Kullanıcı adı zaten alınmış mı? ---
$chk = mysqli_prepare($link, "SELECT 1 FROM authme WHERE username = ? LIMIT 1");
mysqli_stmt_bind_param($chk, "s", $lower);
mysqli_stmt_execute($chk);
mysqli_stmt_store_result($chk);
$taken = mysqli_stmt_num_rows($chk) > 0;
mysqli_stmt_close($chk);
if ($taken) pw_fail('Bu kullanıcı adı zaten alınmış.');

// --- AuthMe SHA256 hash:  $SHA$salt$ sha256(sha256(pass).salt) ---
$salt = bin2hex(random_bytes(8)); // 16 hex
$hash = '$SHA$' . $salt . '$' . hash('sha256', hash('sha256', $password) . $salt);

$ip    = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
$nowMs = (string) round(microtime(true) * 1000);

// --- Tablodaki kolonları oku ---
$cols = [];
$rc = mysqli_query($link, "SHOW COLUMNS FROM authme");
if (!$rc) pw_fail('Tablo okunamadı: ' . mysqli_error($link));
while ($c = mysqli_fetch_assoc($rc)) {
    $cols[$c['Field']] = $c;   // Field, Type, Null, Key, Default, Extra
}

// --- Bildiğimiz kolonlar için değerler ---
$vals = [
    'username'   => $lower,
    'realname'   => $username,
    'password'   => $hash,
    'email'      => $email,
    'ip'         => $ip,
    'regip'      => $ip,
    'regdate'    => $nowMs,
    'lastlogin'  => '0',
    'x'          => '0', 'y' => '0', 'z' => '0',
    'world'      => 'world',
    'yaw'        => '0', 'pitch' => '0',
    'isLogged'   => '0',
    'hasSession' => '0',
    'role'       => 'player',
    'coins'      => '0',
];

// --- Bilmediğimiz ama NOT NULL & varsayılansız kolonlara güvenli değer ---
foreach ($cols as $name => $meta) {
    if (isset($vals[$name])) continue;
    if (strtolower($meta['Extra']) === 'auto_increment') continue;     // id atla
    if ($meta['Null'] === 'NO' && $meta['Default'] === null) {
        $t = strtolower($meta['Type']);
        if (preg_match('/int|double|float|decimal|bit|year/', $t)) {
            $vals[$name] = '0';
        } elseif (strpos($t, 'datetime') !== false || strpos($t, 'timestamp') !== false) {
            $vals[$name] = '1970-01-01 00:00:00';
        } elseif (strpos($t, 'date') !== false) {
            $vals[$name] = '1970-01-01';
        } elseif (strpos($t, 'time') !== false) {
            $vals[$name] = '00:00:00';
        } else {
            $vals[$name] = '';   // text/varchar vb.
        }
    }
}

// --- Sadece tabloda gerçekten var olan kolonları ekle ---
$insCols = [];
$place   = [];
$args    = [];
foreach ($vals as $name => $v) {
    if (!isset($cols[$name])) continue;
    $insCols[] = "`$name`";
    $place[]   = '?';
    $args[]    = $v;
}

$sql  = "INSERT INTO authme (" . implode(',', $insCols) . ") VALUES (" . implode(',', $place) . ")";
$stmt = mysqli_prepare($link, $sql);
if (!$stmt) pw_fail('Kayıt hazırlanamadı: ' . mysqli_error($link));

$types = str_repeat('s', count($args));   // hepsini string bağla; MySQL kolona göre çevirir
mysqli_stmt_bind_param($stmt, $types, ...$args);

if (!mysqli_stmt_execute($stmt))
    pw_fail('Kayıt oluşturulamadı: ' . mysqli_stmt_error($stmt));   // gerçek hatayı göster

mysqli_stmt_close($stmt);

pw_json(['success' => true, 'message' => 'Kayıt başarıyla tamamlandı! Şimdi giriş yapabilirsin.']);
