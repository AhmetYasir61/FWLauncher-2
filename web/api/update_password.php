<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { exit(0); }

require_once "config.php";
header('Content-Type: application/json');

// ... (dosyanın geri kalan mantığı aynı kalacak)
$data = json_decode(file_get_contents("php://input"), true);
// ...
require_once "config.php";
header("Access-Control-Allow-Origin: *"); header("Content-Type: application/json");
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { exit(0); }

function authme_sha256($password, $salt) {
    return '$SHA$' . $salt . '$' . hash('sha256', hash('sha256', $password) . $salt);
}

$data = json_decode(file_get_contents("php://input"), true);
$key = $data['key'] ?? '';
$password = $data['password'] ?? '';

if(empty($key) || empty($password)){
    echo json_encode(['success' => false, 'message' => 'Eksik veya geçersiz bilgi.']); exit;
}

// GÜVENLİK DÜZELTMESİ: Tüm veritabanını taramak yerine, anahtarla eşleşen tek bir kullanıcıyı bulmaya çalış.
// Bu çok daha verimli ve güvenlidir.
$sql = "SELECT email, username, reset_token FROM users WHERE reset_expiry > NOW()";
$result = mysqli_query($link, $sql);

$user_found = false;
$user_email = '';
$username = '';

while($row = mysqli_fetch_assoc($result)){
    if (isset($row['reset_token']) && password_verify($key, $row['reset_token'])) {
        $user_found = true;
        $user_email = $row['email'];
        $username = $row['username'];
        break;
    }
}

if ($user_found) {
    $hashed_password_for_launcher = password_hash($password, PASSWORD_DEFAULT);
    $salt = bin2hex(random_bytes(8));
    $authme_hashed_password = authme_sha256($password, $salt);

    mysqli_begin_transaction($link);
    try {
        // users tablosunu güncelle ve sıfırlama anahtarını temizle
        $sql1 = "UPDATE users SET password = ?, reset_token = NULL, reset_expiry = NULL WHERE email = ?";
        $stmt1 = mysqli_prepare($link, $sql1);
        mysqli_stmt_bind_param($stmt1, "ss", $hashed_password_for_launcher, $user_email);
        mysqli_stmt_execute($stmt1);

        // authme tablosunu güncelle
        $sql2 = "UPDATE " . AUTHME_TABLE_NAME . " SET password = ? WHERE realname = ?";
        $stmt2 = mysqli_prepare($link, $sql2);
        mysqli_stmt_bind_param($stmt2, "ss", $authme_hashed_password, $username);
        mysqli_stmt_execute($stmt2);

        mysqli_commit($link);
        echo json_encode(['success' => true, 'message' => 'Şifre başarıyla güncellendi!']);
    } catch (mysqli_sql_exception $e) {
        mysqli_rollback($link);
        echo json_encode(['success' => false, 'message' => 'Veritabanı güncellenirken bir hata oluştu.']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Geçersiz veya süresi dolmuş sıfırlama anahtarı.']);
}
mysqli_close($link);
?>