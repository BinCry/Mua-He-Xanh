<?php
namespace App\Core;

use PDO;
use PDOException;

/**
 * Singleton Database Connection
 * Quản lý kết nối PDO duy nhất cho toàn bộ ứng dụng
 */
class Database
{
    private static ?Database $instance = null;
    private PDO $pdo;

    private function __construct()
    {
        $config = require dirname(__DIR__) . '/config.php';

        $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset={$config['db_charset']}";

        try {
            $this->pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ]);
        } catch (PDOException $e) {
            die("Lỗi kết nối Database: " . $e->getMessage());
        }
    }

    /** Lấy instance duy nhất (Singleton) */
    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /** Lấy đối tượng PDO */
    public function getConnection(): PDO
    {
        return $this->pdo;
    }

    /** Chặn clone */
    private function __clone() {}
}
