<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\Destination;

class ExploreController extends Controller {
    
    /** Danh sách tất cả điểm đến */
    public function list() {
        $destModel = new Destination();
        $page = $_GET['page'] ?? 1;
        $type = $_GET['type'] ?? null;
        $season = $_GET['season'] ?? null;
        $search = $_GET['q'] ?? null;
        
        $result = $destModel->paginateActive((int)$page, 6, $type, null, $search, $season);
        
        $data = [
            'title' => 'Khám phá Bình Lợi',
            'destinations' => $result['data'],
            'pagination' => $result['pagination'],
            'currentType' => $type,
            'currentSeason' => $season,
            'searchQuery' => $search
        ];
        
        $this->render('explore/list', $data);
    }

    /** Chi tiết một điểm đến */
    public function show($slug) {
        $destModel = new Destination();
        $dest = $destModel->findBySlug($slug);
        
        if (!$dest) {
            http_response_code(404);
            $this->render('errors/404', ['title' => 'Không tìm thấy địa điểm']);
            return;
        }

        $related = $destModel->getRelated($dest['type'], $dest['id']);

        $data = [
            'title' => $dest['name'],
            'dest' => $dest,
            'related' => $related
        ];
        
        $this->render('explore/show', $data);
    }
}
