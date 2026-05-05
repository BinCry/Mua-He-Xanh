<?php
namespace App\Models;

use App\Core\Model;

/**
 * Model: Journey (Hành trình)
 */
class Journey extends Model
{
    protected string $table = 'journeys';

    /** Lấy journey đang active của session */
    public function getActiveBySession(string $sessionId): ?array
    {
        return $this->findOne(['session_id' => $sessionId, 'status' => 'active']);
    }

    /** Lấy journey kèm stops + destinations */
    public function getWithStops(string $journeyId): ?array
    {
        $journey = $this->findById($journeyId);
        if (!$journey) return null;

        $stmt = $this->db->prepare(
            "SELECT js.*, d.name, d.slug, d.short_desc, d.type, d.cover_image, d.lat, d.lng,
                    d.is_hub, d.points, d.map_x, d.map_y, d.radius_meter, d.qr_secret,
                    d.highlight, d.checkin_tip, d.best_time, d.story, d.zen_walk_desc,
                    d.open_hours, d.cost
             FROM journey_stops js
             JOIN destinations d ON js.destination_id = d.id
             WHERE js.journey_id = :jid
             ORDER BY js.stop_order ASC"
        );
        $stmt->execute([':jid' => $journeyId]);
        $journey['stops'] = $stmt->fetchAll();

        return $journey;
    }

    /** Tạo hành trình mới cá nhân hóa */
    public function createPersonalized(string $sessionId, string $mood, string $duration, array $interests = []): array
    {
        $destModel = new Destination();

        // 1. Hub bắt buộc (Điểm bắt đầu)
        $hub = $destModel->getHub();
        if (!$hub) throw new \Exception('Hub không tìm thấy');

        // 2. Lấy điểm phù hợp mood + interests
        $candidates = $destModel->getForJourney($mood, $interests, [$hub['id']]);

        // 3. Lọc theo mùa (Làng Mai chỉ tháng 12–1)
        $month = (int)date('n');
        $candidates = array_filter($candidates, function ($d) use ($month) {
            if ($d['slug'] === 'lang-mai-vang') return $month === 12 || $month === 1;
            return true;
        });
        $candidates = array_values($candidates);

        // 4. Xác định số lượng điểm dừng theo duration
        $maxStops = ($duration === 'full_day') ? 5 : 3;

        // 5. Greedy Nearest-Neighbor
        $selected = [$hub];
        $remaining = $candidates;
        for ($i = 0; $i < $maxStops && !empty($remaining); $i++) {
            $last = end($selected);
            usort($remaining, function ($a, $b) use ($last) {
                $d1 = Model::haversine($last['lat'], $last['lng'], $a['lat'], $a['lng']);
                $d2 = Model::haversine($last['lat'], $last['lng'], $b['lat'], $b['lng']);
                return $d1 <=> $d2;
            });
            $selected[] = array_shift($remaining);
        }

        // 6. Tính metrics
        $totalMeters = 0;
        for ($i = 1; $i < count($selected); $i++) {
            $totalMeters += Model::haversine(
                $selected[$i - 1]['lat'], $selected[$i - 1]['lng'],
                $selected[$i]['lat'], $selected[$i]['lng']
            );
        }
        $totalKm = round($totalMeters / 1000, 2);
        // Ước tính thời gian: 30-45p mỗi điểm + di chuyển
        $timePerStop = ($duration === 'full_day') ? 60 : 45;
        $totalMinutes = count($selected) * $timePerStop + round($totalKm * 15);

        // 7. Đánh dấu các journey cũ là abandoned
        $this->db->prepare("UPDATE journeys SET status = 'abandoned' WHERE session_id = :sid AND status = 'active'")
                 ->execute([':sid' => $sessionId]);

        // 8. Tạo Journey mới
        $journeyId = $this->create([
            'session_id'    => $sessionId,
            'mood'          => $mood,
            'duration'      => $duration,
            'interests'     => json_encode($interests),
            'total_km'      => $totalKm,
            'total_minutes' => $totalMinutes,
            'status'        => 'active',
        ]);

        // 9. Tạo JourneyStops
        $stopModel = new JourneyStop();
        foreach ($selected as $idx => $dest) {
            $stopModel->create([
                'journey_id'     => $journeyId,
                'destination_id' => $dest['id'],
                'stop_order'     => $idx,
                'is_completed'   => 0,
            ]);
        }

        return $this->getWithStops($journeyId);
    }

    /** Tạo hành trình mẫu (Preset) */
    public function createPreset(string $sessionId, string $theme): array
    {
        $destModel = new Destination();
        $slugs = [];

        switch ($theme) {
            case 'an-nhien':
                $slugs = ['chua-thanh-tam', 'vuon-dua-binh-loi', 'cong-vien-van-hoa-lang-le'];
                break;
            case 'lang-nghe':
                $slugs = ['lang-nghe-nhang', 'lang-mai-vang', 'chua-phap-tang'];
                break;
            case 'hoi-xuan':
                $slugs = ['lang-mai-vang', 'cong-vien-van-hoa-lang-le', 'chua-thanh-tam'];
                break;
            default:
                throw new \Exception("Theme không hợp lệ");
        }

        $selected = [];
        foreach ($slugs as $slug) {
            $d = $destModel->findBySlug($slug);
            if ($d) $selected[] = $d;
        }

        // Đánh dấu các journey cũ là replaced
        $this->db->prepare("UPDATE journeys SET status = 'replaced' WHERE session_id = :sid AND status = 'active'")
                 ->execute([':sid' => $sessionId]);

        $journeyId = $this->create([
            'session_id'    => $sessionId,
            'mood'          => $theme,
            'duration'      => 'full_day',
            'interests'     => json_encode(['preset' => $theme]),
            'total_km'      => 4.5,
            'total_minutes' => 180,
            'status'        => 'active',
        ]);

        $stopModel = new JourneyStop();
        foreach ($selected as $idx => $dest) {
            $stopModel->create([
                'journey_id'     => $journeyId,
                'destination_id' => $dest['id'],
                'stop_order'     => $idx,
                'is_completed'   => 0,
            ]);
        }

        return $this->getWithStops($journeyId);
    }
}
