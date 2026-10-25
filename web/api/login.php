<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

require_once "config.php";

$data = json_decode(file_get_contents("php://input"), true);

$username_input = trim($data['username'] ?? '');
$password       = $data['password'] ?? '';
$deviceId       = $data['deviceId'] ?? '';

if ($username_input === '' || $password === '' || $deviceId === '') {
    echo json_encode(['success' => false, 'message' => 'Eksik bilgi gönderildi.']);
    exit;
}

// AuthMe 'username' sütunu daima küçük harftir; aramayı küçük harfle yap.
// Gerçek yazım (Ametio) 'realname' sütunundadır.
$username_lookup = strtolower($username_input);

$sql  = "SELECT id, username, realname, password FROM authme WHERE username = ?";
$stmt = mysqli_prepare($link, $sql);
mysqli_stmt_bind_param($stmt, "s", $username_lookup);
mysqli_stmt_execute($stmt);
mysqli_stmt_store_result($stmt);

if (mysqli_stmt_num_rows($stmt) != 1) {
    echo json_encode(['success' => false, 'message' => 'Hesap bulunamadı.']);
    exit;
}

mysqli_stmt_bind_result($stmt, $id, $db_username, $db_realname, $hashed_password);
mysqli_stmt_fetch($stmt);

// ================= AUTHME PASSWORD VERIFY (SHA256 + BCRYPT) =================
$valid = false;

if (strpos($hashed_password, '$SHA$') === 0) {
    // AuthMe varsayılanı: $SHA$<salt>$<sha256(sha256(pass)+salt)>
    $parts = explode('$', $hashed_password);
    if (count($parts) >= 4) {
        $salt = $parts[2];
        $hash = $parts[3];
        $calc = hash('sha256', hash('sha256', $password) . $salt);
        $valid = hash_equals($hash, $calc);
    }
} elseif (preg_match('/^\$2[aby]\$/', $hashed_password)) {
    // BCRYPT ($2a$ / $2b$ / $2y$)
    $valid = password_verify($password, $hashed_password);
} else {
    echo json_encode(['success' => false, 'message' => 'Şifre formatı desteklenmiyor.']);
    exit;
}

if (!$valid) {
    echo json_encode(['success' => false, 'message' => 'Geçersiz şifre.']);
    exit;
}
// ==========================================================================

$token  = bin2hex(random_bytes(32));
$expiry = date("Y-m-d H:i:s", strtotime("+7 days"));

$update = "UPDATE authme
           SET session_token = ?, device_id = ?, session_expiry = ?
           WHERE id = ?";

$stmt2 = mysqli_prepare($link, $update);
mysqli_stmt_bind_param($stmt2, "sssi", $token, $deviceId, $expiry, $id);

if (!mysqli_stmt_execute($stmt2)) {
    echo json_encode(['success' => false, 'message' => 'Oturum oluşturulamadı.']);
    exit;
}

// Kayıtlı (gerçek) kullanıcı adını döndür: realname yoksa username'e düş.
$display_name = (isset($db_realname) && $db_realname !== '') ? $db_realname : $db_username;

echo json_encode([
    'success'  => true,
    'message'  => 'Giriş başarılı',
    'username' => $display_name,
    'token'    => $token
]);

mysqli_stmt_close($stmt);
mysqli_stmt_close($stmt2);
mysqli_close($link);
?>
