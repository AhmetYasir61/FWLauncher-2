<?php
// Gizli ayarları koddan ayırır. Öncelik: ortam değişkeni (FW_DB_PASSWORD gibi) > api/secrets.php.
// secrets.php repoya girmez; örnek için secrets.example.php dosyasına bak.
function fw_secret(string $key, string $default = ''): string {
    static $s = null;
    if ($s === null) {
        $f = __DIR__ . '/secrets.php';
        $s = is_file($f) ? (require $f) : [];
        if (!is_array($s)) $s = [];
    }
    $env = getenv('FW_' . strtoupper($key));
    if ($env !== false && $env !== '') return $env;
    return isset($s[$key]) ? (string)$s[$key] : $default;
}
