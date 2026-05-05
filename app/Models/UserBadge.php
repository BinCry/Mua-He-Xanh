<?php
namespace App\Models;

use App\Core\Model;

class UserBadge extends Model
{
    protected string $table = 'user_badges';

    public function hasUnlocked(string $sessionId, string $badgeId): bool
    {
        return $this->findOne(['session_id' => $sessionId, 'badge_id' => $badgeId]) !== null;
    }

    public function unlock(string $sessionId, string $badgeId): string
    {
        return $this->create(['session_id' => $sessionId, 'badge_id' => $badgeId]);
    }

    /** Lấy danh sách huy hiệu đã mở khóa của session */
    public function getUnlockedBySession(string $sessionId): array
    {
        $sql = "SELECT b.* FROM badges b 
                JOIN user_badges ub ON b.id = ub.badge_id 
                WHERE ub.session_id = :sid";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':sid' => $sessionId]);
        return $stmt->fetchAll();
    }

    /** Kiểm tra và unlock badges dựa trên điều kiện */
    public function checkAndUnlock(string $sessionId): array
    {
        $badgeModel = new Badge();
        $allBadges = $badgeModel->getAll();
        $sessionModel = new UserSession();
        $session = $this->db->prepare("SELECT * FROM user_sessions WHERE id = :id");
        $session->execute([':id' => $sessionId]);
        $session = $session->fetch();

        $checkinModel = new CheckIn();
        $checkins = $checkinModel->getBySession($sessionId);
        $todayCount = $checkinModel->countTodayBySession($sessionId);

        $newBadges = [];
        foreach ($allBadges as $badge) {
            if ($this->hasUnlocked($sessionId, $badge['id'])) continue;

            $condition = json_decode($badge['condition'] ?? '{}', true);
            $unlocked = false;

            switch ($condition['type'] ?? '') {
                case 'first_journey_complete':
                    $stmt = $this->db->prepare("SELECT COUNT(*) as cnt FROM journeys WHERE session_id = :sid AND status = 'completed'");
                    $stmt->execute([':sid' => $sessionId]);
                    $unlocked = (int)$stmt->fetch()['cnt'] >= 1;
                    break;

                case 'checkins_same_day':
                    $unlocked = $todayCount >= ($condition['count'] ?? 3);
                    break;

                case 'total_points':
                    $unlocked = ($session['total_points'] ?? 0) >= ($condition['min_points'] ?? 100);
                    break;

                case 'total_checkins':
                    $unlocked = count($checkins) >= ($condition['count'] ?? 6);
                    break;

                case 'destination_type_count':
                    $typeCount = count(array_filter($checkins, fn($c) => $c['type'] === ($condition['dest_type'] ?? '')));
                    $unlocked = $typeCount >= ($condition['min_count'] ?? 2);
                    break;

                case 'multi_type_journey':
                    $types = array_unique(array_column($checkins, 'type'));
                    $required = $condition['types'] ?? [];
                    $unlocked = count(array_intersect($required, $types)) === count($required);
                    break;
            }

            if ($unlocked) {
                $this->unlock($sessionId, $badge['id']);
                $sessionModel->addPoints($sessionId, $badge['points'] ?? 0);
                $newBadges[] = $badge;
            }
        }
        return $newBadges;
    }
}
