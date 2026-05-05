<?php
/**
 * Cấu hình ứng dụng Bình Lợi Healing
 */

// Tự động xác định APP_URL và BASE_URL
$scriptName = $_SERVER['SCRIPT_NAME'] ?? ''; // /binh-loi-healing/index.php
$appUrl = str_replace('/index.php', '', $scriptName); // /binh-loi-healing
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$baseUrl = $protocol . $host . $appUrl;

return [
    // Database
    'db_host'     => 'localhost',
    'db_name'     => 'binhloi_tourism',
    'db_user'     => 'root',
    'db_pass'     => '',
    'db_charset'  => 'utf8mb4',

    // App
    'app_name'    => 'Bình Lợi Healing',
    'app_url'     => $appUrl,     // Tự động detect (ví dụ: /binh-loi-healing)
    'base_url'    => $baseUrl,    // Tự động detect (ví dụ: http://localhost/binh-loi-healing)

    // Session
    'session_name'    => 'bl_session',
    'session_lifetime' => 604800,
    'cookie_name'      => 'bl_session_uuid',
];
