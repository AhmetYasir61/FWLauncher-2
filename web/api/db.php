<?php
// =====================================================
// CORS AYARLARI
// =====================================================
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// =====================================================
// JSON HEADER
// =====================================================
header("Content-Type: application/json; charset=UTF-8");

// =====================================================
// DATABASE CONFIG
// =====================================================
require_once __DIR__ . '/fw_secrets.php';
define('DB_SERVER', fw_secret('db_host', 'localhost'));
define('DB_USERNAME', fw_secret('db_user'));
define('DB_PASSWORD', fw_secret('db_password'));
define('DB_NAME', fw_secret('db_name'));

// AuthMe tablo adı (opsiyonel)
define('AUTHME_TABLE_NAME', 'authme');

// =====================================================
// DB CONNECT
// =====================================================
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function db(): mysqli {
    $conn = new mysqli(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_NAME);
    $conn->set_charset("utf8mb4");
    return $conn;
}

// =====================================================
// JSON HELPERS
// =====================================================
function json_input(): array {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function json_response(int $code, array $payload) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

// =====================================================
// SECURITY
// =====================================================
function sha256_password(string $password): string {
    return hash("sha256", $password);
}

// =====================================================
// OFFLINE UUID (AuthMe uyumlu)
// =====================================================
function offline_uuid(string $username): string {
    $hash = md5("OfflinePlayer:" . $username, true);

    $hash[6] = chr((ord($hash[6]) & 0x0F) | 0x30);
    $hash[8] = chr((ord($hash[8]) & 0x3F) | 0x80);

    $hex = bin2hex($hash);
    return sprintf('%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12)
    );
}

// =====================================================
// TOKEN (Launcher Session Token)
// =====================================================
function generate_token(): string {
    return bin2hex(random_bytes(32));
}
