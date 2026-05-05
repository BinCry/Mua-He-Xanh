<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Destination;

class CheckinController extends Controller {
    public function index() {
        $slug = $_GET['slug'] ?? null;
        $destModel = new Destination();
        $dest = null;
        
        if ($slug) {
            $dest = $destModel->findBySlug($slug);
        }

        $data = [
            'title' => 'Check-in tại điểm',
            'dest' => $dest,
            'slug' => $slug
        ];
        $this->render('checkin/index', $data);
    }
}
