<?php
// === HATA AYIKLAMA BAŞLANGICI ===
ini_set('display_errors', 1);
error_reporting(E_ALL);
// === HATA AYIKLAMA SONU ===

// CORS BAŞLIKLARI
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') { exit(0); }

header('Content-Type: application/json');

// Sadece config.php dosyasını çağırıyoruz
require_once "config.php";

// Veritabanı bağlantı kontrolü
if ($link === false) {
    echo json_encode(['success' => false, 'message' => "HATA: config.php üzerinden veritabanına bağlanılamadı."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
$email = $data['email'] ?? '';

if (empty($email)) {
    echo json_encode(['success' => false, 'message' => 'E-posta alanı boş bırakılamaz.']);
    exit;
}

$sql = "SELECT id FROM users WHERE email = ?";
if ($stmt = mysqli_prepare($link, $sql)) {
    mysqli_stmt_bind_param($stmt, "s", $email);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);

    if (mysqli_stmt_num_rows($stmt) == 1) {
        // E-posta veritabanında bulundu.
        // Şimdilik e-posta göndermek yerine sadece başarı mesajı döndür.
        echo json_encode(['success' => true, 'message' => 'TEST BAŞARILI: E-posta veritabanında bulundu. Sorun PHPMailer kısmında.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Bu e-posta adresine kayıtlı bir hesap bulunamadı.']);
    }
    mysqli_stmt_close($stmt);
} else {
    echo json_encode(['success' => false, 'message' => 'Sunucu hatası: SQL sorgusu hazırlanamadı.']);
}
mysqli_close($link);
?>