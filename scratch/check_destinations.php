<?php
$config = require __DIR__ . '/../app/config.php';
try {
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset={$config['db_charset']}";
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass']);
    $stmt = $pdo->query("SELECT id, name, type, seasons FROM destinations");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo $e->getMessage();
}
