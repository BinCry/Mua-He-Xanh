<?php
namespace App\Models;

use App\Core\Model;

/**
 * Model: UserSession (Phiên người dùng ẩn danh)
 */
class UserSession extends Model
{
    protected string $table = 'user_sessions';

    /** Tìm hoặc tạo session theo UUID */
    public function findOrCreate(string $uuid): array
    {
        $session = $this->findOne(['uuid' => $uuid]);
        if ($session) return $session;

        $id = $this->create([
            'uuid'         => $uuid,
            'total_points' => 0,
            'ip_address'   => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent'   => $_SERVER['HTTP_USER_AGENT'] ?? '',
        ]);

        return $this->findById($id);
    }

    /** Tìm theo UUID */
    public function findByUuid(string $uuid): ?array
    {
        return $this->findOne(['uuid' => $uuid]);
    }

    /** Cộng điểm */
    public function addPoints(string $id, int $points): bool
    {
        $stmt = $this->db->prepare("UPDATE {$this->table} SET total_points = total_points + :pts WHERE id = :id");
        return $stmt->execute([':pts' => $points, ':id' => $id]);
    }
}
