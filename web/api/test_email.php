<?php
// Hata raporlamayı aç
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Gerekli PHPMailer kütüphanelerini çağır
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'Exception.php';
require 'PHPMailer.php';
require 'SMTP.php';

$mail = new PHPMailer(true);

try {
    //Sunucu Ayarları
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    require_once __DIR__ . '/fw_secrets.php';
    $mail->Username   = fw_secret('smtp_user');
    $mail->Password   = fw_secret('smtp_password');
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->CharSet    = 'UTF-8';

    //Gönderici ve Alıcı Ayarları
    $mail->setFrom(fw_secret('smtp_user'), 'FireWing Test');
    $mail->addAddress(fw_secret('smtp_user'), 'Test Alıcısı'); // Kendi e-postanızı yazın

    //İçerik
    $mail->isHTML(false);
    $mail->Subject = 'PHPMailer Test E-postası';
    $mail->Body    = 'Eğer bu mesajı aldıysanız, PHPMailer ayarlarınız doğru çalışıyor demektir.';

    $mail->send();
    echo 'E-posta başarıyla gönderildi!';
} catch (Exception $e) {
    echo "E-posta gönderilemedi. Hata: {$mail->ErrorInfo}";
}
?>
