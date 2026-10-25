<?php
// ============================================================
//  PokeWing API — ortak yardımcılar (CORS, oturum, rol, log)
// ============================================================

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

function pw_json($arr) { echo json_encode($arr); exit; }
function pw_fail($msg = '') { pw_json(['success' => false, 'message' => $msg]); }

function pw_body() {
    $raw = file_get_contents("php://input");
    $j = json_decode($raw, true);
    if (is_array($j)) return $j;
    return $_POST;
}

/** Oturumu doğrular. ['id','username'(realname),'role','coins'] veya null. */
function pw_authuser($link, $username, $token) {
    $u = strtolower(trim((string)$username));
    $token = (string)$token;
    if ($u === '' || $token === '') return null;

    $stmt = mysqli_prepare($link,
        "SELECT id, realname, role, coins, session_token, session_expiry FROM authme WHERE username = ?");
    mysqli_stmt_bind_param($stmt, "s", $u);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_store_result($stmt);
    if (mysqli_stmt_num_rows($stmt) != 1) { mysqli_stmt_close($stmt); return null; }

    mysqli_stmt_bind_result($stmt, $id, $realname, $role, $coins, $dbtoken, $sexp);
    mysqli_stmt_fetch($stmt);
    mysqli_stmt_close($stmt);

    if (empty($dbtoken) || !hash_equals((string)$dbtoken, $token)) return null;
    try { if (new DateTime() >= new DateTime($sexp)) return null; }
    catch (Exception $e) { return null; }

    return [
        'id'       => (int)$id,
        'username' => ($realname !== null && $realname !== '') ? $realname : $u,
        'role'     => strtolower($role ?: 'player'),
        'coins'    => (int)$coins,
    ];
}

function pw_is_admin($user) {
    return $user && in_array($user['role'], ['owner', 'admin'], true);
}

function pw_log($link, $from, $to, $amount, $type, $ref) {
    $now = (string) round(microtime(true) * 1000);
    $amount = (int)$amount;
    $stmt = mysqli_prepare($link,
        "INSERT INTO pw_transactions (from_user, to_user, amount, type, ref, created_at) VALUES (?,?,?,?,?,?)");
    mysqli_stmt_bind_param($stmt, "ssisss", $from, $to, $amount, $type, $ref, $now);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_close($stmt);
}
