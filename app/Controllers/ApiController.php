<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\UserSession;
use App\Models\Destination;
use App\Models\Journey;
use App\Models\CheckIn;
use App\Models\UserBadge;

class ApiController extends Controller {
    
    // ─── SESSION API ──────────────────────────────────────────────────
    
    public function session($uuid = null) {
        $sessionModel = new UserSession();
        
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $body = $this->getJsonBody();
            $uuid = $this->getSessionUuid(); // Lấy từ cookie hoặc helper
            
            if (!$uuid) {
                $uuid = bin2hex(random_bytes(16));
                setcookie('session_uuid', $uuid, time() + (86400 * 30), '/');
            }
            
            $data = [
                'mood' => $body['mood'] ?? null,
                'duration' => $body['duration'] ?? null,
                'interests' => isset($body['interests']) ? json_encode($body['interests']) : null
            ];
            
            $session = $sessionModel->findOrCreate($uuid);
            $sessionModel->update($session['id'], $data);
            
            $this->json(['success' => true, 'data' => array_merge($session, $data)]);
        } else {
            if (!$uuid) $this->jsonError('Missing UUID');
            $session = $sessionModel->findByUuid($uuid);
            if (!$session) $this->jsonError('Session not found', 404);
            
            // Get badges
            $badgeModel = new UserBadge();
            $session['badges'] = $badgeModel->db->prepare(
                "SELECT b.* FROM user_badges ub JOIN badges b ON ub.badge_id = b.id WHERE ub.session_id = ?"
            );
            $session['badges']->execute([$session['id']]);
            $session['badges'] = $session['badges']->fetchAll();
            
            $this->json(['success' => true, 'data' => $session]);
        }
    }

    // ─── DESTINATIONS API ─────────────────────────────────────────────
    
    public function destinations() {
        $destModel = new Destination();
        $page = $_GET['page'] ?? 1;
        $limit = $_GET['limit'] ?? 6;
        $type = $_GET['type'] ?? null;
        $mood = $_GET['mood'] ?? null;
        
        $result = $destModel->paginateActive((int)$page, (int)$limit, $type, $mood);
        $this->json($result);
    }

    // ─── JOURNEY API ──────────────────────────────────────────────────
    
    public function journey() {
        $journeyModel = new Journey();
        $body = $this->getJsonBody();
        $sessionUuid = $body['sessionUuid'] ?? null;
        $mood = $body['mood'] ?? 'an_nhien';
        
        if (!$sessionUuid) $this->jsonError('Missing sessionUuid');
        
        $sessionModel = new UserSession();
        $session = $sessionModel->findByUuid($sessionUuid);
        if (!$session) $this->jsonError('Session not found');
        
        try {
            $journey = $journeyModel->createFromMood($session['id'], $mood);
            $this->json(['success' => true, 'data' => $journey]);
        } catch (\Exception $e) {
            $this->jsonError($e->getMessage());
        }
    }

    // ─── CHECK-IN API ─────────────────────────────────────────────────
    
    public function checkin() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->jsonError('Method not allowed', 405);
        
        $body = $this->getJsonBody();
        $sessionUuid = $body['sessionUuid'] ?? null;
        $slug = $body['slug'] ?? null;
        $lat = $body['lat'] ?? null;
        $lng = $body['lng'] ?? null;
        $method = $body['method'] ?? 'qr'; // qr or manual
        
        if (!$sessionUuid || !$slug || !$lat || !$lng) {
            $this->jsonError('Dữ liệu không đầy đủ');
        }

        $sessionModel = new UserSession();
        $session = $sessionModel->findByUuid($sessionUuid);
        if (!$session) $this->jsonError('Session not found');

        $destModel = new Destination();
        $dest = $destModel->findBySlug($slug);
        if (!$dest) $this->jsonError('Điểm đến không tồn tại');

        // Verify distance
        $distance = \App\Core\Model::haversine($lat, $lng, $dest['lat'], $dest['lng']);
        if ($distance > $dest['radius_meter'] * 1.5) { // Cho phép sai số 50%
            $this->jsonError("Bạn đang cách quá xa địa điểm (" . round($distance) . "m)");
        }

        $checkinModel = new CheckIn();
        if ($checkinModel->existsForStop($session['id'], $dest['id'])) {
            $this->jsonError('Bạn đã check-in điểm này rồi');
        }

        // Perform check-in
        $checkinId = $checkinModel->create([
            'session_id' => $session['id'],
            'destination_id' => $dest['id'],
            'points_earned' => $dest['points'],
            'checkin_method' => $method,
            'user_lat' => $lat,
            'user_lng' => $lng,
            'distance_meter' => round($distance)
        ]);

        // Update total points in session
        $sessionModel->db->prepare("UPDATE user_sessions SET total_points = total_points + ? WHERE id = ?")
            ->execute([$dest['points'], $session['id']]);

        // Mark journey stop as completed if applicable
        $journeyModel = new Journey();
        $journey = $journeyModel->getActiveBySession($session['id']);
        if ($journey) {
            $stmt = $sessionModel->db->prepare(
                "UPDATE journey_stops SET is_completed = 1, completed_at = NOW() 
                 WHERE journey_id = ? AND destination_id = ?"
            );
            $stmt->execute([$journey['id'], $dest['id']]);
        }

        // Check badges
        $userBadgeModel = new UserBadge();
        $newBadges = $userBadgeModel->checkAndUnlock($session['id']);

        $this->json([
            'success' => true,
            'points_earned' => $dest['points'],
            'new_badges' => $newBadges
        ]);
    }
}
