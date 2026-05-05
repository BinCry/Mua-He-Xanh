<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Destination;

class HomeController extends Controller {
    public function index() {
        $destModel = new Destination();
        
        // Xác định mùa hiện tại theo kế hoạch Marketing LOMAR
        $month = (int)date('m');
        $season = 'summer'; // Mặc định
        $seasonName = 'Miệt vườn giữa Phố';
        
        if ($month >= 11 || $month <= 3) {
            $season = 'winter_spring';
            $seasonName = 'Du xuân Bình Lợi';
        } elseif ($month >= 7 && $month <= 10) {
            $season = 'autumn_winter';
            $seasonName = 'Lễ hội mùa Thu';
        }

        // Lấy các điểm đến nổi bật cho mùa này
        $seasonalDestinations = $destModel->getBySeason($season);
        
        // Nếu mùa này ít điểm quá thì lấy thêm điểm active khác
        $featured = (count($seasonalDestinations) < 3) ? $destModel->getActive(6) : $seasonalDestinations;

        // Lấy số liệu cộng đồng
        $checkinModel = new \App\Models\CheckIn();
        $totalCheckins = $checkinModel->getTotalCount() + 1250; 
        $activeDestinations = count($destModel->getActive(100));
        
        $data = [
            'title' => 'Bình Lợi – Miền Tây giữa lòng Sài Gòn',
            'featured' => $featured,
            'currentSeason' => $season,
            'seasonName' => $seasonName,
            'stats' => [
                'checkins' => $totalCheckins,
                'destinations' => $activeDestinations,
                'reviews' => 840 // Hardcoded for now
            ]
        ];
        
        $this->render('home/index', $data);
    }
}
