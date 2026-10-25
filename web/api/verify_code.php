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

$email = $data['email'] ?? '';
$code  = $data['code'] ?? '';

if(empty($email) || empty($code) || !is_numeric($code) || strlen($code) != 6){
    echo json_encode(['success' => false, 'message' => 'Lütfen geçerli, 6 haneli bir kod girin.']);
    exit;
}

$sql = "SELECT reset_token, reset_expiry FROM users WHERE email = ?";
if ($stmt = mysqli_prepare($link, $sql)) {

    mysqli_stmt_bind_param($stmt, "s", $email);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);

    if (mysqli_stmt_num_rows($stmt) == 1) {

        mysqli_stmt_bind_result($stmt, $hashed_token, $expiry_date);
        mysqli_stmt_fetch($stmt);

        if ($hashed_token 
            && password_verify($code, $hashed_token) 
            && new DateTime() < new DateTime($expiry_date)) {

            // Yeni reset key üret
            $resetKey = bin2hex(random_bytes(32));
            $hashed_resetKey = password_hash($resetKey, PASSWORD_DEFAULT);
            $expiry_date_new = date("Y-m-d H:i:s", strtotime('+15 minutes'));

            $update_sql = "UPDATE users SET reset_token = ?, reset_expiry = ? WHERE email = ?";
            if ($update_stmt = mysqli_prepare($link, $update_sql)) {

                // ❗ BURASI DÜZELTİLDİ: "sss"
                mysqli_stmt_bind_param($update_stmt, "sss", $hashed_resetKey, $expiry_date_new, $email);
                mysqli_stmt_execute($update_stmt);

                echo json_encode([
                    'success' => true,
                    'resetKey' => $resetKey
                ]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Sıfırlama anahtarı oluşturulamadı.']);
            }

        } else {
            echo json_encode(['success' => false, 'message' => 'Kod yanlış veya süresi dolmuş.']);
        }

    } else {
        echo json_encode(['success' => false, 'message' => 'Kullanıcı bulunamadı.']);
    }

    mysqli_stmt_close($stmt);
}

mysqli_close($link);
?>
