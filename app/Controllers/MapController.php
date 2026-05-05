<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\UserSession;
use App\Models\Journey;

class MapController extends Controller {
    public function index() {
        $uuid = $this->getSessionUuid();
        if (!$uuid) $this->redirect('onboarding');

        $sessionModel = new UserSession();
        $session = $sessionModel->findByUuid($uuid);
        if (!$session) $this->redirect('onboarding');

        $journeyModel = new Journey();
        $journey = $journeyModel->getActiveBySession($session['id']);
        if (!$journey) $this->redirect('onboarding');
        
        $journeyWithStops = $journeyModel->getWithStops($journey['id']);

        $data = [
            'title' => 'Bản đồ cảm xúc',
            'journey' => $journeyWithStops
        ];
        $this->render('map/index', $data);
    }
}
