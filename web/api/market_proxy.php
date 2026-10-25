<?php
$endpoint = $_GET['endpoint'] ?? '';

if (empty($endpoint)) {
    $request_uri = $_SERVER['REQUEST_URI'];
    if (preg_match('#/(cosmetic\.json|session|download/.*|tebex/webhook|publish|health)#', $request_uri, $matches)) {
        $endpoint = $matches[1];
    }
}

$backend_url = 'http://193.164.7.119:1880/api/' . $endpoint;

$ch = curl_init($backend_url);

$headers = [];
foreach (getallheaders() as $key => $value) {
    if (strtolower($key) !== 'host') {
        $headers[] = "$key: $value";
    }
}

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);

$body = file_get_contents('php://input');
if (!empty($body)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);

if ($response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Pelican backend bağlantısı başarısız: ' . curl_error($ch)]);
    curl_close($ch);
    exit;
}

$header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$response_headers = substr($response, 0, $header_size);
$response_body = substr($response, $header_size);

http_response_code($http_code);

foreach (explode("\r\n", $response_headers) as $header) {
    if (!empty($header) && !str_starts_with(strtolower($header), 'transfer-encoding') && !str_starts_with(strtolower($header), 'content-length')) {
        header($header);
    }
}

echo $response_body;