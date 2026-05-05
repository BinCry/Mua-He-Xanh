<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\UserSession;
use App\Models\Journey;

class JourneyController extends Controller {
    public function index() {
        $uuid = $this->getSessionUuid();
        if (!$uuid) $this->redirect('onboarding');

        $sessionModel = new UserSession();
        $session = $sessionModel->findByUuid($uuid);
        if (!$session || !$session['mood']) $this->redirect('onboarding');

        $journeyModel = new Journey();
        $journey = $journeyModel->getActiveBySession($session['id']);
        
        // Nếu chưa có journey nhưng đã có mood (tức là đã xong onboarding), tự động tạo
        if (!$journey && $session['mood']) {
            $interests = $session['interests'] ? json_decode($session['interests'], true) : [];
            $journeyWithStops = $journeyModel->createPersonalized(
                $session['id'], 
                $session['mood'], 
                $session['duration'] ?? 'morning', 
                $interests
            );
        } else if ($journey) {
            $journeyWithStops = $journeyModel->getWithStops($journey['id']);
        } else {
            $this->redirect('onboarding');
        }

        $data = [
            'title' => 'Gợi ý hành trình',
            'journey' => $journeyWithStops
        ];
        $this->render('journey/index', $data);
    }

    /** Tạo hành trình mẫu theo theme */
    public function preset($theme) {
        $uuid = $this->getSessionUuid();
        if (!$uuid) $this->redirect('onboarding');

        $sessionModel = new UserSession();
        $session = $sessionModel->findByUuid($uuid);
        if (!$session) $this->redirect('onboarding');

        $journeyModel = new Journey();
        try {
            $journeyModel->createPreset($session['id'], $theme);
            $this->redirect('journey');
        } catch (\Exception $e) {
            $this->redirect('home');
        }
    }
}
