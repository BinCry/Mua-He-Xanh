<?php
namespace App\Controllers;

use App\Core\Controller;

class OnboardingController extends Controller {
    public function index() {
        $data = [
            'title' => 'Bạn đang cảm thấy thế nào?'
        ];
        $this->render('onboarding/index', $data);
    }
}
