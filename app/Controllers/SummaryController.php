<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\UserSession;
use App\Models\Badge;
use App\Models\UserBadge;
use App\Models\CheckIn;

class SummaryController extends Controller {
    public function index() {
        $uuid = $this->getSessionUuid();
        if (!$uuid) $this->redirect('onboarding');

        $sessionModel = new UserSession();
        $session = $sessionModel->findByUuid($uuid);
        if (!$session) $this->redirect('onboarding');

        $badgeModel = new Badge();
        $allBadges = $badgeModel->getAll();
        
        $userBadgeModel = new UserBadge();
        $unlockedBadges = $userBadgeModel->getUnlockedBySession($session['id']);
        $unlockedIds = array_column($unlockedBadges, 'id');

        $checkinModel = new CheckIn();
        $history = $checkinModel->getBySession($session['id']);

        $data = [
            'title' => 'Hộ chiếu Du lịch Bình Lợi',
            'session' => $session,
            'allBadges' => $allBadges,
            'unlockedBadges' => $unlockedBadges,
            'history' => $history
        ];
        $this->render('summary/index', $data);
    }
}
