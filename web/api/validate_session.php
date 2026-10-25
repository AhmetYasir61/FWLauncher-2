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

$username = trim($data['username'] ?? '');
$token    = $data['token'] ?? '';

if ($username === '' || $token === '') {
    echo json_encode(['success' => false]);
    exit;
}

// AuthMe 'username' küçük harftir; gerçek yazım 'realname' sütunundadır.
$username_lookup = strtolower($username);

// ================= QUERY =================
$sql = "SELECT realname, session_token, session_expiry
        FROM authme
        WHERE username = ?";

$stmt = mysqli_prepare($link, $sql);
mysqli_stmt_bind_param($stmt, "s", $username_lookup);
mysqli_stmt_execute($stmt);
mysqli_stmt_store_result($stmt);

if (mysqli_stmt_num_rows($stmt) != 1) {
    echo json_encode(['success' => false]);
    exit;
}

mysqli_stmt_bind_result($stmt, $db_realname, $db_token, $db_expiry);
mysqli_stmt_fetch($stmt);

// ================= CHECK =================
$valid = false;
if (!empty($db_token) && hash_equals((string)$db_token, (string)$token)) {
    try {
        $valid = (new DateTime() < new DateTime($db_expiry));
    } catch (Exception $e) {
        $valid = false;
    }
}

if ($valid) {
    // Kanonik (kayıtlı) kullanıcı adını döndür ki launcher doğru yazımı göstersin.
    $display_name = (isset($db_realname) && $db_realname !== '') ? $db_realname : $username;
    echo json_encode(['success' => true, 'username' => $display_name]);
} else {
    echo json_encode(['success' => false]);
}

mysqli_stmt_close($stmt);
mysqli_close($link);
?>
