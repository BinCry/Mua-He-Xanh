<?php
namespace App\Models;

use App\Core\Model;
use PDO;

/**
 * Model: Destination (Điểm đến)
 */
class Destination extends Model
{
    protected string $table = 'destinations';

    /** Lấy tất cả điểm đến đang hoạt động */
    public function getActive(int $limit = 100): array
    {
        $stmt = $this->db->prepare(
            "SELECT * FROM {$this->table} WHERE is_active = 1 ORDER BY sort_order ASC LIMIT :lim"
        );
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /** Tìm theo slug */
    public function findBySlug(string $slug): ?array
    {
        return $this->findOne(['slug' => $slug]);
    }

    /** Lấy Hub (Công viên Láng Le) */
    public function getHub(): ?array
    {
        return $this->findOne(['is_hub' => 1, 'is_active' => 1]);
    }

    /** Lấy điểm đến cho hành trình (lọc theo mood và sở thích) */
    public function getForJourney(string $mood, array $interests = [], array $excludeIds = []): array
    {
        $where = "is_active = 1";
        $params = [];

        // Lọc theo mood
        $where .= " AND moods LIKE :mood";
        $params[':mood'] = "%{$mood}%";

        // Lọc theo sở thích (nếu có)
        if (!empty($interests)) {
            $intParts = [];
            foreach ($interests as $i => $int) {
                $key = ":int{$i}";
                $intParts[] = "type = {$key}";
                $params[$key] = $int;
            }
            $where .= " AND (" . implode(' OR ', $intParts) . ")";
        }

        // Loại trừ
        if (!empty($excludeIds)) {
            $placeholders = [];
            foreach ($excludeIds as $i => $id) {
                $key = ":exc{$i}";
                $placeholders[] = $key;
                $params[$key] = $id;
            }
            $where .= " AND id NOT IN (" . implode(',', $placeholders) . ")";
        }

        $sql = "SELECT * FROM {$this->table} WHERE {$where} ORDER BY sort_order ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /** Lấy theo loại */
    public function getByType(string $type): array
    {
        return $this->findWhere(['type' => $type, 'is_active' => 1], 'sort_order ASC');
    }

    /** Phân trang điểm đến */
    public function paginateActive(int $page = 1, int $limit = 6, ?string $type = null, ?string $mood = null, ?string $search = null, ?string $season = null): array
    {
        $where = "is_active = 1";
        $params = [];

        if ($type) {
            $where .= " AND type = :type";
            $params[':type'] = $type;
        }
        if ($mood) {
            $where .= " AND moods LIKE :mood";
            $params[':mood'] = "%{$mood}%";
        }
        if ($season) {
            $where .= " AND seasons LIKE :season";
            $params[':season'] = "%{$season}%";
        }
        if ($search) {
            $where .= " AND (name LIKE :s1 OR short_desc LIKE :s2 OR story LIKE :s3)";
            $params[':s1'] = "%{$search}%";
            $params[':s2'] = "%{$search}%";
            $params[':s3'] = "%{$search}%";
        }

        return $this->paginate($page, $limit, $where, $params, 'sort_order ASC');
    }

    /** Lấy điểm đến theo mùa (marketing plan) */
    public function getBySeason(string $season): array
    {
        try {
            $sql = "SELECT * FROM {$this->table} WHERE is_active = 1 AND seasons LIKE :season ORDER BY sort_order ASC";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':season' => "%{$season}%"]);
            return $stmt->fetchAll() ?: [];
        } catch (\PDOException $e) {
            error_log("Error in getBySeason: " . $e->getMessage());
            return [];
        }
    }

    /** Lấy các điểm đến liên quan */
    public function getRelated(string $type, string $excludeId, int $limit = 3): array
    {
        $sql = "SELECT * FROM {$this->table} WHERE type = :type AND id != :id AND is_active = 1 LIMIT :lim";
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(':type', $type);
        $stmt->bindValue(':id', $excludeId);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
