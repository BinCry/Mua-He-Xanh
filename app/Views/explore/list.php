<section class="site-section">
    <div class="container-site">
        <div class="text-center mb-5 animate__animated animate__fadeIn">
            <span class="text-primary fw-bold mb-2 d-block">🌟 HỆ THỐNG ĐIỂM ĐẾN</span>
            <h2 class="display-text">Khám phá Bản sắc Bình Lợi</h2>
            <p class="text-muted mx-auto" style="max-width: 700px;">Từ di tích lịch sử Láng Le hào hùng đến những làng nghề truyền thống và không gian sinh thái an nhiên.</p>
        </div>

        <!-- Search and Filter -->
        <div class="row justify-content-center mb-5">
            <div class="col-md-6">
                <form action="<?= $APP_URL ?>/destinations" method="GET" class="input-group card-bl p-1 shadow-sm">
                    <input type="text" name="q" class="form-control border-0 px-3" placeholder="Tìm tên điểm đến, câu chuyện..." value="<?= htmlspecialchars($searchQuery ?? '') ?>">
                    <button class="btn btn-primary-bl rounded-3" type="submit"><i class="bi bi-search"></i></button>
                </form>
                <?php if ($searchQuery): ?>
                    <div class="text-center mt-3 animate__animated animate__fadeIn">
                        <small class="text-muted">Kết quả tìm kiếm cho: <strong>"<?= htmlspecialchars($searchQuery) ?>"</strong></small>
                        <a href="<?= $APP_URL ?>/destinations" class="ms-2 small text-primary text-decoration-none">Xóa tìm kiếm</a>
                    </div>
                <?php endif; ?>
            </div>
        </div>

        <!-- Filter tabs -->
        <div class="mb-5">
            <div class="d-flex justify-content-center gap-2 mb-3 flex-wrap">
                <a href="<?= $APP_URL ?>/destinations" class="btn <?= !$currentType && !$currentSeason ? 'btn-primary-bl' : 'btn-outline-bl' ?> btn-sm px-4">Tất cả</a>
                <a href="<?= $APP_URL ?>/destinations?type=temple" class="btn <?= $currentType == 'temple' ? 'btn-primary-bl' : 'btn-outline-bl' ?> btn-sm px-4">Chùa cổ</a>
                <a href="<?= $APP_URL ?>/destinations?type=park" class="btn <?= $currentType == 'park' ? 'btn-primary-bl' : 'btn-outline-bl' ?> btn-sm px-4">Công viên</a>
                <a href="<?= $APP_URL ?>/destinations?type=craft" class="btn <?= $currentType == 'craft' ? 'btn-primary-bl' : 'btn-outline-bl' ?> btn-sm px-4">Làng nghề</a>
                <a href="<?= $APP_URL ?>/destinations?type=nature" class="btn <?= $currentType == 'nature' ? 'btn-primary-bl' : 'btn-outline-bl' ?> btn-sm px-4">Sinh thái</a>
            </div>
            <div class="d-flex justify-content-center gap-2 flex-wrap">
                <span class="small text-muted w-100 text-center mb-2">Gợi ý theo mùa (Marketing LOMAR):</span>
                <a href="<?= $APP_URL ?>/destinations?season=winter_spring" class="btn <?= $currentSeason == 'winter_spring' ? 'btn-secondary text-white' : 'btn-outline-secondary' ?> btn-sm px-3 rounded-pill">🌸 Du xuân Bình Lợi</a>
                <a href="<?= $APP_URL ?>/destinations?season=summer" class="btn <?= $currentSeason == 'summer' ? 'btn-secondary text-white' : 'btn-outline-secondary' ?> btn-sm px-3 rounded-pill">🥥 Miệt vườn giữa Phố</a>
                <a href="<?= $APP_URL ?>/destinations?season=autumn_winter" class="btn <?= $currentSeason == 'autumn_winter' ? 'btn-secondary text-white' : 'btn-outline-secondary' ?> btn-sm px-3 rounded-pill">🏮 Lễ hội mùa Thu</a>
            </div>
        </div>

        <div class="grid-3col">
            <?php foreach ($destinations as $dest): ?>
                <div class="card-bl animate__animated animate__fadeInUp">
                    <?php 
                    $coverImg = $dest['cover_image'];
                    if ($coverImg) {
                        $imgSrc = (strpos($coverImg, 'http') === 0) ? $coverImg : ($BASE_URL . '/' . $coverImg);
                    } else {
                        $imgSrc = $BASE_URL . '/public/images/hero-2.png';
                    }
                    ?>
                    <div class="position-relative">
                        <img src="<?= $imgSrc ?>" class="card-bl-img" alt="<?= $dest['name'] ?>">
                        <div class="position-absolute top-0 end-0 m-3">
                             <span class="badge bg-white text-primary rounded-pill shadow-sm">+<?= $dest['points'] ?> ✨</span>
                        </div>
                    </div>
                    <div class="card-bl-body">
                        <span class="card-bl-tag tag-<?= $dest['type'] ?>"><?= strtoupper($dest['type']) ?></span>
                        <h3 class="card-bl-title"><?= $dest['name'] ?></h3>
                        <p class="card-bl-desc text-truncate-2" style="min-height: 40px;"><?= $dest['short_desc'] ?></p>
                        <div class="d-grid mt-3">
                            <a href="<?= $APP_URL ?>/explore/<?= $dest['slug'] ?>" class="btn btn-outline-bl btn-sm py-2">Khám phá chi tiết</a>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <!-- Pagination -->
        <div class="mt-5 pt-3">
            <?php 
            $queryParams = [];
            if ($currentType) $queryParams['type'] = $currentType;
            if ($currentSeason) $queryParams['season'] = $currentSeason;
            if ($searchQuery) $queryParams['q'] = $searchQuery;
            $queryString = !empty($queryParams) ? '?' . http_build_query($queryParams) : '';

            $this->renderPartial('partials/pagination', [
                'pagination' => $pagination,
                'paginationUrl' => $APP_URL . '/destinations' . $queryString
            ]); 
            ?>
        </div>
    </div>
</section>
