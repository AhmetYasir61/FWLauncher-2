<?php
// =========================================================================
// CORS (Cross-Origin Resource Sharing) BAŞLIKLARI
// Bu başlıklar, web tarayıcısının bu API'ye erişmesine izin verir.
// =========================================================================
header("Access-Control-Allow-Origin: *"); // Herhangi bir alan adından gelen isteklere izin ver
header("Access-Control-Allow-Methods: POST, GET, OPTIONS"); // İzin verilen HTTP metotları
header("Access-Control-Allow-Headers: Content-Type, Authorization"); // İzin verilen başlıklar

// Tarayıcılar bazen asıl istekten önce bir 'OPTIONS' isteği gönderir.
// Bu isteği başarılı bir şekilde yanıtlamak önemlidir.
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}
// =========================================================================

// Veritabanı bağlantı bilgileri
require_once __DIR__ . '/fw_secrets.php';
define('DB_SERVER', fw_secret('db_host', 'localhost')); // Hostinger için genellikle 'localhost'tur.
define('DB_USERNAME', fw_secret('db_user')); // 1. Adımda oluşturduğunuz kullanıcı adı
define('DB_PASSWORD', fw_secret('db_password')); // 1. Adımda belirlediğiniz şifre
define('DB_NAME', fw_secret('db_name')); // 1. Adımda oluşturduğunuz veritabanı adı

// AuthMe tablonuzun adı. Varsayılan olarak 'authme'dir.
define('AUTHME_TABLE_NAME', 'authme');

// Veritabanı bağlantısı
$link = mysqli_connect(DB_SERVER, DB_USERNAME, DB_PASSWORD, DB_NAME);

if($link === false){
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Sunucu veritabanı hatası.']);
    exit;
}
?>