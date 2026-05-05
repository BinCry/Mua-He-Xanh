<?php
/**
 * BÌNH LỢI HEALING — FRONT CONTROLLER
 * ════════════════════════════════════
 * Tất cả request đều đi qua file này.
 * Pattern: Front Controller (MVC)
 */

// Error reporting (tắt ở production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Định nghĩa đường dẫn gốc
define('ROOT_PATH', __DIR__);
define('APP_PATH', ROOT_PATH . '/app');

// ─── AUTOLOADER (PSR-4 style) ──────────────────────────────────────────
spl_autoload_register(function (string $class) {
    // App\Core\Database → app/Core/Database.php
    // App\Models\Destination → app/Models/Destination.php
    $class = str_replace('App\\', '', $class);
    $file = APP_PATH . '/' . str_replace('\\', '/', $class) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

// ─── SESSION ───────────────────────────────────────────────────────────
session_start();

// ─── CORS (cho AJAX requests) ──────────────────────────────────────────
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ─── DISPATCH ──────────────────────────────────────────────────────────
$app = new \App\Core\App();
$app->dispatch();
