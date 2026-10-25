<?php
// ================= CORS =================
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

// ================= DB =================
require_once "config.php";

// ================= INPUT =================
$data = json_decode(file_get_contents("php://input"), true);

$username = $data['username'] ?? '';
$token    = $data['token'] ?? '';
$deviceId = $data['deviceId'] ?? '';

if (empty($username) || empty($token) || empty($deviceId)) {
    echo json_encode(['success' => false, 'message' => 'Eksik veri']);
    exit;
}

// ================= QUERY =================
$sql = "SELECT session_token, device_id, session_expiry 
        FROM users WHERE username = ?";

$stmt = mysqli_prepare($link, $sql);
mysqli_stmt_bind_param($stmt, "s", $username);
mysqli_stmt_execute($stmt);
mysqli_stmt_store_result($stmt);

if (mysqli_stmt_num_rows($stmt) != 1) {
    echo json_encode(['success' => false, 'message' => 'Kullanıcı yok']);
    exit;
}

mysqli_stmt_bind_result($stmt, $dbToken, $dbDeviceId, $dbExpiry);
mysqli_stmt_fetch($stmt);

// ================= CHECK =================
$now = new DateTime();
$expiry = new DateTime($dbExpiry);

if (
    hash_equals($dbToken, $token) &&
    hash_equals($dbDeviceId, $deviceId) &&
    $now < $expiry
) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Oturum geçersiz veya başka cihazdan giriş yapıldı.'
    ]);
}

mysqli_stmt_close($stmt);
mysqli_close($link);
?>
