<?php
namespace App\Models;

use App\Core\Model;

class CheckIn extends Model
{
    protected string $table = 'check_ins';

    public function existsForStop(string $sessionId, string $destinationId): bool
    {
        $row = $this->findOne(['session_id' => $sessionId, 'destination_id' => $destinationId]);
        return $row !== null;
    }

    public function getBySession(string $sessionId): array
    {
        $stmt = $this->db->prepare(
            "SELECT ci.*, d.name, d.slug, d.type, d.cover_image, d.points as dest_points
             FROM {$this->table} ci
             JOIN destinations d ON ci.destination_id = d.id
             WHERE ci.session_id = :sid
             ORDER BY ci.created_at DESC"
        );
        $stmt->execute([':sid' => $sessionId]);
        return $stmt->fetchAll();
    }

    public function countTodayBySession(string $sessionId): int
    {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) as cnt FROM {$this->table} WHERE session_id = :sid AND DATE(created_at) = CURDATE()"
        );
        $stmt->execute([':sid' => $sessionId]);
        return (int)$stmt->fetch()['cnt'];
    }

    public function getTotalCount(): int
    {
        $stmt = $this->db->query("SELECT COUNT(*) as cnt FROM {$this->table}");
        return (int)$stmt->fetch()['cnt'];
    }
}
