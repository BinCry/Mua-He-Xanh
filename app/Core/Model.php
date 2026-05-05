<?php
namespace App\Core;

use PDO;

/**
 * Base Model — Abstract OOP
 * Tất cả Model đều kế thừa class này
 */
abstract class Model
{
    protected PDO $db;
    protected string $table;       // Tên bảng
    protected string $primaryKey = 'id';

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    // ─── CRUD CƠ BẢN ──────────────────────────────────────────────────

    /** Lấy tất cả bản ghi */
    public function findAll(string $orderBy = 'created_at DESC', int $limit = 100): array
    {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} ORDER BY {$orderBy} LIMIT :lim");
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /** Tìm theo ID */
    public function findById(string $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE {$this->primaryKey} = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /** Tìm theo điều kiện (1 bản ghi) */
    public function findOne(array $conditions): ?array
    {
        $where = [];
        $params = [];
        foreach ($conditions as $col => $val) {
            $where[] = "{$col} = :{$col}";
            $params[":{$col}"] = $val;
        }
        $whereStr = implode(' AND ', $where);
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE {$whereStr} LIMIT 1");
        $stmt->execute($params);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /** Tìm nhiều bản ghi theo điều kiện */
    public function findWhere(array $conditions, string $orderBy = 'created_at DESC'): array
    {
        $where = [];
        $params = [];
        foreach ($conditions as $col => $val) {
            $where[] = "{$col} = :{$col}";
            $params[":{$col}"] = $val;
        }
        $whereStr = implode(' AND ', $where);
        $stmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE {$whereStr} ORDER BY {$orderBy}");
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /** Tạo bản ghi mới */
    public function create(array $data): string
    {
        // Tự tạo UUID nếu chưa có
        if (!isset($data[$this->primaryKey])) {
            $data[$this->primaryKey] = $this->generateUuid();
        }

        $cols = implode(', ', array_keys($data));
        $placeholders = ':' . implode(', :', array_keys($data));
        $params = [];
        foreach ($data as $k => $v) {
            $params[":{$k}"] = $v;
        }

        $stmt = $this->db->prepare("INSERT INTO {$this->table} ({$cols}) VALUES ({$placeholders})");
        $stmt->execute($params);
        return $data[$this->primaryKey];
    }

    /** Cập nhật theo ID */
    public function update(string $id, array $data): bool
    {
        $sets = [];
        $params = [':_id' => $id];
        foreach ($data as $col => $val) {
            $sets[] = "{$col} = :{$col}";
            $params[":{$col}"] = $val;
        }
        $setStr = implode(', ', $sets);
        $stmt = $this->db->prepare("UPDATE {$this->table} SET {$setStr} WHERE {$this->primaryKey} = :_id");
        return $stmt->execute($params);
    }

    /** Xóa theo ID */
    public function delete(string $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM {$this->table} WHERE {$this->primaryKey} = :id");
        return $stmt->execute([':id' => $id]);
    }

    // ─── PAGINATION ────────────────────────────────────────────────────

    /**
     * Phân trang
     * @return array ['data' => [...], 'pagination' => [...]]
     */
    public function paginate(int $page = 1, int $limit = 10, string $where = '1=1', array $params = [], string $orderBy = 'created_at DESC'): array
    {
        $page = max(1, $page);
        $limit = min(50, max(1, $limit));
        $offset = ($page - 1) * $limit;

        // Đếm tổng
        $countStmt = $this->db->prepare("SELECT COUNT(*) as total FROM {$this->table} WHERE {$where}");
        $countStmt->execute($params);
        $total = (int)$countStmt->fetch()['total'];

        // Lấy data
        $dataStmt = $this->db->prepare("SELECT * FROM {$this->table} WHERE {$where} ORDER BY {$orderBy} LIMIT {$limit} OFFSET {$offset}");
        $dataStmt->execute($params);
        $data = $dataStmt->fetchAll();

        $totalPages = (int)ceil($total / $limit);

        return [
            'data' => $data,
            'pagination' => [
                'total_records' => $total,
                'current_page'  => $page,
                'limit'         => $limit,
                'total_pages'   => $totalPages,
                'has_next'      => $page < $totalPages,
                'has_prev'      => $page > 1,
            ]
        ];
    }

    // ─── UTILITIES ─────────────────────────────────────────────────────

    /** Tạo UUID v4 */
    protected function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    /** Haversine — Tính khoảng cách GPS (mét) */
    public static function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $R = 6371000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        return $R * $c;
    }
}
