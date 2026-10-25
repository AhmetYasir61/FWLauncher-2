<?php
// Minecraft sunucusunun açık olup olmadığını ve oyuncu sayısını döndürür (Server List Ping).
// Sonuç 30 sn önbellekte tutulur. Yanıt: { success, online, players:{online,max}, version, motd, ip, port }
require_once "pw_common.php";
require_once __DIR__ . '/fw_secrets.php';

$host = fw_secret('mc_host', 'play.firewing.store');
$port = (int) fw_secret('mc_port', '25565');
$cache = sys_get_temp_dir() . '/fw_server_status.json';

if (is_file($cache) && time() - filemtime($cache) < 30) {
    echo file_get_contents($cache);
    exit;
}

function fw_varint(int $n): string {
    $out = '';
    do { $b = $n & 0x7f; $n >>= 7; if ($n) $b |= 0x80; $out .= chr($b); } while ($n);
    return $out;
}
function fw_read_varint($sock): int {
    $n = 0; $shift = 0;
    do {
        $c = fread($sock, 1);
        if ($c === false || $c === '') throw new Exception('bağlantı kapandı');
        $b = ord($c); $n |= ($b & 0x7f) << $shift; $shift += 7;
        if ($shift > 35) throw new Exception('VarInt çok uzun');
    } while ($b & 0x80);
    return $n;
}

$result = ['success' => true, 'online' => false, 'players' => ['online' => 0, 'max' => 0], 'version' => '', 'motd' => '', 'ip' => $host, 'port' => $port];
try {
    $sock = @fsockopen($host, $port, $errno, $errstr, 3);
    if (!$sock) throw new Exception('ulaşılamadı');
    stream_set_timeout($sock, 3);
    $hs = fw_varint(0) . fw_varint(767) . fw_varint(strlen($host)) . $host . pack('n', $port) . fw_varint(1);
    fwrite($sock, fw_varint(strlen($hs)) . $hs);
    fwrite($sock, fw_varint(1) . fw_varint(0));
    fw_read_varint($sock);            // paket uzunluğu
    fw_read_varint($sock);            // paket kimliği
    $len = fw_read_varint($sock);     // JSON uzunluğu
    $json = '';
    while (strlen($json) < $len && !feof($sock)) { $chunk = fread($sock, $len - strlen($json)); if ($chunk === false || $chunk === '') break; $json .= $chunk; }
    fclose($sock);
    $r = json_decode($json, true);
    if (is_array($r)) {
        $d = $r['description'] ?? '';
        $result['online'] = true;
        $result['players'] = ['online' => (int)($r['players']['online'] ?? 0), 'max' => (int)($r['players']['max'] ?? 0)];
        $result['version'] = (string)($r['version']['name'] ?? '');
        $result['motd'] = is_string($d) ? $d : (string)($d['text'] ?? '');
    }
} catch (Exception $e) {
    // kapalı say
}

$out = json_encode($result, JSON_UNESCAPED_UNICODE);
@file_put_contents($cache, $out);
echo $out;
