<?php
namespace App\Models;

use App\Core\Model;

class Badge extends Model
{
    protected string $table = 'badges';

    public function getAll(): array
    {
        return $this->findAll('id ASC');
    }

    public function getUnlockedBySession(string $sessionId): array
    {
        $stmt = $this->db->prepare(
            "SELECT b.*, ub.created_at as unlocked_at
             FROM user_badges ub
             JOIN badges b ON ub.badge_id = b.id
             WHERE ub.session_id = :sid
             ORDER BY ub.created_at DESC"
        );
        $stmt->execute([':sid' => $sessionId]);
        return $stmt->fetchAll();
    }
}
