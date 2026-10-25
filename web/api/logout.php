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

if (empty($username) || empty($token)) {
    echo json_encode(['success' => false, 'message' => 'Eksik bilgi']);
    exit;
}

// ================= UPDATE =================
$sql = "UPDATE authme 
        SET session_token = NULL, 
            device_id = NULL, 
            session_expiry = NULL 
        WHERE username = ? AND session_token = ?";

$stmt = mysqli_prepare($link, $sql);
mysqli_stmt_bind_param($stmt, "ss", $username, $token);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false]);
}

mysqli_stmt_close($stmt);
mysqli_close($link);
?>
