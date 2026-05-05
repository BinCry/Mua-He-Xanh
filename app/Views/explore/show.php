<section class="explore-hero-premium position-relative overflow-hidden">
    <?php 
    $coverImg = $dest['cover_image'];
    $imgSrc = ($coverImg && strpos($coverImg, 'http') === 0) ? $coverImg : ($BASE_URL . '/' . ($coverImg ?: 'public/images/hero-3.png'));
    ?>
    <div class="hero-bg animate__animated animate__zoomIn">
        <img src="<?= $imgSrc ?>" class="w-100 h-100 object-fit-cover" alt="<?= $dest['name'] ?>">
    </div>
    <div class="hero-overlay-dark"></div>
    <div class="hero-content container-site text-white">
        <div class="animate__animated animate__fadeInUp">
            <span class="badge bg-secondary text-dark mb-3 px-3 py-2 rounded-pill"><?= strtoupper($dest['type']) ?></span>
            <h1 class="display-1 fw-black mb-3"><?= $dest['name'] ?></h1>
            <p class="lead opacity-75 d-flex align-items-center gap-2">
                <i class="bi bi-geo-alt-fill text-secondary"></i> <?= $dest['short_desc'] ?>
            </p>
        </div>
    </div>
</section>

<div class="container-site mt-n5 position-relative" style="z-index: 100;">
    <div class="row g-5">
        <!-- Main Content: Storytelling -->
        <div class="col-lg-8">
            <div class="card-bl p-4 p-md-5 mb-5 shadow-lg border-0">
                <!-- QR Storytelling Component -->
                <div class="qr-story-badge d-flex align-items-center gap-3 p-3 rounded-4 mb-5" style="background: rgba(200, 169, 110, 0.1); border: 1px dashed var(--color-secondary);">
                    <div class="qr-icon-wrapper bg-white p-2 rounded-3 shadow-sm">
                        <i class="bi bi-qr-code-scan fs-3 text-secondary"></i>
                    </div>
                    <div>
                        <h6 class="mb-0 fw-bold">QR Storytelling đang hoạt động</h6>
                        <p class="small text-muted mb-0">Bạn có thể quét mã tại điểm để nghe thuyết minh tự động.</p>
                    </div>
                    <button class="btn btn-secondary btn-sm ms-auto rounded-pill px-3" onclick="startStorytelling()">
                        <i class="bi bi-play-fill"></i> Thử ngay
                    </button>
                </div>

                <h2 class="display-text text-primary mb-4">Mảnh ghép ký ức</h2>
                <div class="story-text-rich" style="font-size: 1.1rem; line-height: 2; color: #333;">
                    <?= nl2br($dest['story']) ?>
                </div>

                <!-- Highlight Box -->
                <div class="highlight-quote p-4 rounded-4 mt-5 position-relative overflow-hidden">
                    <div class="position-absolute top-0 start-0 w-100 h-100 bg-primary opacity-5"></div>
                    <i class="bi bi-quote display-1 position-absolute top-0 start-0 opacity-10 m-n3"></i>
                    <h5 class="position-relative mb-2 fw-bold"><i class="bi bi-stars text-secondary me-2"></i> Trải nghiệm tinh hoa</h5>
                    <p class="position-relative mb-0 fst-italic text-muted"><?= $dest['highlight'] ?></p>
                </div>
            </div>

            <!-- Zen Walk Section -->
            <?php if ($dest['zen_walk_desc']): ?>
            <div class="zen-section p-5 rounded-4 mb-5 text-center text-white position-relative overflow-hidden shadow-lg">
                <div class="zen-overlay"></div>
                <div class="position-relative" style="z-index: 5;">
                    <div class="zen-icon mb-4">🧘‍♂️</div>
                    <h2 class="display-text text-white">Zen Walk</h2>
                    <p class="lead opacity-75 mx-auto mb-5" style="max-width: 600px;"><?= $dest['zen_walk_desc'] ?></p>
                    <div class="audio-player-mockup bg-white p-3 rounded-pill d-inline-flex align-items-center gap-4 text-dark shadow">
                        <button class="btn btn-primary-bl rounded-circle p-2" style="width:45px; height:45px;"><i class="bi bi-play-fill fs-4"></i></button>
                        <div class="text-start pe-4">
                            <span class="d-block small fw-bold">Ambiance: Healing River</span>
                            <div class="progress" style="height: 4px; width: 150px; margin-top: 5px;">
                                <div class="progress-bar bg-primary" style="width: 30%;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <?php endif; ?>

            <!-- Additional Info Grid -->
            <div class="row g-4 mb-5">
                <div class="col-md-6">
                    <div class="card-bl p-4 h-100 bg-light border-0 shadow-sm">
                        <h6 class="text-primary fw-bold mb-4 text-uppercase letter-spacing-sm"><i class="bi bi-clock-fill me-2"></i> Thông tin hữu ích</h6>
                        <div class="d-flex justify-content-between mb-3">
                            <span class="text-muted small">Giờ mở cửa</span>
                            <span class="fw-bold small"><?= $dest['open_hours'] ?></span>
                        </div>
                        <div class="d-flex justify-content-between mb-3 border-top pt-3">
                            <span class="text-muted small">Chi phí dự kiến</span>
                            <span class="fw-bold small"><?= $dest['cost'] ?></span>
                        </div>
                        <div class="d-flex justify-content-between border-top pt-3">
                            <span class="text-muted small">Thời điểm đẹp</span>
                            <span class="fw-bold small"><?= $dest['best_time'] ?></span>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card-bl p-4 h-100 bg-light border-0 shadow-sm">
                        <h6 class="text-primary fw-bold mb-4 text-uppercase letter-spacing-sm"><i class="bi bi-camera-fill me-2"></i> Góc nhìn nghệ thuật</h6>
                        <p class="small text-muted mb-0"><?= $dest['checkin_tip'] ?></p>
                    </div>
                </div>
            </div>

            <!-- Image Gallery & Video -->
            <div class="mb-5">
                <h3 class="display-text mb-4">Ghi chép bằng hình ảnh</h3>
                <div class="row g-2">
                    <div class="col-8">
                        <div class="rounded-4 overflow-hidden shadow-sm ratio ratio-16x9">
                            <img src="<?= $imgSrc ?>" class="w-100 h-100 object-fit-cover" alt="Gallery 1">
                        </div>
                    </div>
                    <div class="col-4">
                        <div class="d-flex flex-column gap-2 h-100">
                            <div class="rounded-4 overflow-hidden shadow-sm flex-grow-1 ratio ratio-1x1">
                                <img src="<?= $BASE_URL ?>/public/images/hero-1.png" class="w-100 h-100 object-fit-cover" alt="Gallery 2">
                            </div>
                            <div class="rounded-4 overflow-hidden shadow-sm flex-grow-1 ratio ratio-1x1 position-relative">
                                <img src="<?= $BASE_URL ?>/public/images/hero-2.png" class="w-100 h-100 object-fit-cover" alt="Gallery 3">
                                <div class="position-absolute top-0 start-0 w-100 h-100 bg-dark opacity-50 d-flex align-items-center justify-content-center text-white">
                                    <span class="h4 mb-0">+5</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mt-4 p-4 rounded-4 bg-dark text-white d-flex align-items-center justify-content-between shadow-lg">
                    <div class="d-flex align-items-center gap-3">
                        <i class="bi bi-play-circle-fill display-4 text-secondary"></i>
                        <div>
                            <h6 class="mb-0 fw-bold">Video trải nghiệm thực tế</h6>
                            <p class="small opacity-75 mb-0">Cảm nhận không gian qua góc nhìn 4K.</p>
                        </div>
                    </div>
                    <button class="btn btn-outline-light rounded-pill px-4">Xem ngay</button>
                </div>
            </div>

            <!-- Reviews Section -->
            <div class="card-bl p-4 p-md-5 border-0 shadow-sm mb-5">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h3 class="display-text mb-0">Đánh giá khách hàng</h3>
                    <div class="text-end">
                        <h2 class="mb-0 fw-black text-primary">4.8</h2>
                        <div class="text-secondary small">
                            <i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-half"></i>
                        </div>
                    </div>
                </div>
                
                <div class="review-list">
                    <div class="review-item border-top py-4">
                        <div class="d-flex gap-3 mb-2">
                            <div class="rounded-circle bg-soft-primary d-flex align-items-center justify-content-center fw-bold" style="width: 40px; height: 40px;">T</div>
                            <div>
                                <h6 class="mb-0 small fw-bold">Trần Minh Quân</h6>
                                <span class="x-small text-muted">2 ngày trước • Đã xác thực check-in</span>
                            </div>
                        </div>
                        <p class="small text-muted mb-0">Không gian cực kỳ yên tĩnh và trong lành. Rất thích hợp để nạp lại năng lượng sau một tuần làm việc căng thẳng tại trung tâm.</p>
                    </div>
                    <div class="review-item border-top py-4">
                        <div class="d-flex gap-3 mb-2">
                            <div class="rounded-circle bg-soft-secondary d-flex align-items-center justify-content-center fw-bold" style="width: 40px; height: 40px;">H</div>
                            <div>
                                <h6 class="mb-0 small fw-bold">Lê Thu Hà</h6>
                                <span class="x-small text-muted">1 tuần trước • Đã xác thực check-in</span>
                            </div>
                        </div>
                        <p class="small text-muted mb-0">Cảnh quan đẹp, mọi người ở đây rất thân thiện. Tôi sẽ quay lại cùng gia đình vào dịp tới.</p>
                    </div>
                </div>
                
                <div class="d-grid mt-4">
                    <button class="btn btn-outline-bl rounded-pill py-2 small">Xem tất cả đánh giá</button>
                </div>
            </div>
        </div>

        <!-- Sidebar: Actions -->
        <div class="col-lg-4">
            <div class="sticky-top" style="top: 100px;">
                <div class="card-bl p-4 p-md-5 mb-4 shadow-xl border-0 bg-white">
                    <div class="text-center mb-4">
                        <div class="points-badge bg-secondary text-dark d-inline-block px-4 py-2 rounded-pill fw-black mb-3">
                            +<?= $dest['points'] ?> POINTS
                        </div>
                        <h5 class="fw-bold">Xác thực trải nghiệm</h5>
                        <p class="small text-muted">Check-in để lưu lại hành trình cá nhân và mở khóa huy hiệu đặc biệt.</p>
                    </div>
                    
                    <div class="d-grid gap-3">
                        <a href="<?= $APP_URL ?>/checkin?slug=<?= $dest['slug'] ?>" class="btn btn-primary-bl btn-lg shadow-sm">
                            <i class="bi bi-qr-code-scan me-2"></i> Quét QR Tại Điểm
                        </a>
                        <a href="https://www.google.com/maps/dir/?api=1&destination=<?= $dest['lat'] ?>,<?= $dest['lng'] ?>" target="_blank" class="btn btn-outline-bl btn-lg">
                            <i class="bi bi-map-fill me-2"></i> Chỉ đường (Maps)
                        </a>
                        <div class="d-flex gap-2">
                            <button class="btn btn-light border flex-grow-1" onclick="alert('Đã lưu vào hành trình!')">
                                <i class="bi bi-bookmark-plus"></i> Lưu
                            </button>
                            <button class="btn btn-light border flex-grow-1" onclick="alert('Link đã được sao chép!')">
                                <i class="bi bi-share"></i> Chia sẻ
                            </button>
                        </div>
                    </div>
                    
                    <hr class="my-5 opacity-10">
                    
                    <h6 class="fw-bold mb-3 small text-uppercase letter-spacing-sm">Quy tắc ứng xử</h6>
                    <ul class="list-unstyled small text-muted mb-0" style="line-height: 2.2;">
                        <li><i class="bi bi-check2-circle text-primary me-2"></i> Tôn trọng không gian tâm linh</li>
                        <li><i class="bi bi-check2-circle text-primary me-2"></i> Không xả rác bừa bãi</li>
                        <li><i class="bi bi-check2-circle text-primary me-2"></i> Hỗ trợ cộng đồng bản địa</li>
                    </ul>
                </div>

                <!-- Related/Next Recommendation -->
                <?php if (!empty($related)): ?>
                <div class="card-bl p-4 border-0 shadow-sm mb-4" style="background: var(--color-bg);">
                    <h6 class="fw-bold mb-3">Điểm đến liên quan</h6>
                    <div class="d-flex flex-column gap-3">
                        <?php foreach ($related as $rel): ?>
                        <div class="d-flex align-items-center gap-3">
                            <div class="rounded-3 overflow-hidden" style="width: 50px; height: 50px; flex-shrink: 0;">
                                <img src="<?= $BASE_URL ?>/<?= $rel['cover_image'] ?: 'public/images/hero-2.png' ?>" class="w-100 h-100 object-fit-cover" alt="<?= $rel['name'] ?>">
                            </div>
                            <div class="flex-grow-1">
                                <h6 class="mb-0 small fw-bold text-truncate" style="max-width: 150px;"><?= $rel['name'] ?></h6>
                                <p class="x-small text-muted mb-0"><?= ucfirst($rel['type']) ?></p>
                            </div>
                            <a href="<?= $APP_URL ?>/explore/<?= $rel['slug'] ?>" class="text-primary"><i class="bi bi-chevron-right small"></i></a>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>
                <?php endif; ?>

                <!-- Recently Viewed Placeholder -->
                <div class="card-bl p-4 border-0 shadow-sm" style="background: #fff; border: 1px dashed #ddd !important;">
                    <h6 class="fw-bold mb-2 small"><i class="bi bi-clock-history me-2"></i>Xem gần đây</h6>
                    <p class="x-small text-muted mb-0">Hệ thống đang ghi nhớ các điểm bạn vừa xem để gợi ý tốt hơn.</p>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
.explore-hero-premium {
    height: 70vh;
    display: flex;
    align-items: center;
    padding-top: 100px;
}
.hero-bg {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    z-index: 1;
}
.hero-overlay-dark {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7));
    z-index: 2;
}
.hero-content {
    position: relative;
    z-index: 5;
}
.fw-black { font-weight: 900; }
.mt-n5 { margin-top: -80px; }
.letter-spacing-sm { letter-spacing: 2px; }
.zen-section {
    background: url('<?= $BASE_URL ?>/public/images/hero-1.png');
    background-size: cover;
    background-position: center;
}
.zen-overlay {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(92, 138, 94, 0.85);
    z-index: 1;
}
.zen-icon { font-size: 5rem; }
.audio-player-mockup { min-width: 300px; }
.x-small { font-size: 11px; }

@media (max-width: 992px) {
    .mt-n5 { margin-top: 0; padding-top: 30px; }
    .explore-hero-premium { height: 50vh; }
}
</style>

<script>
function startStorytelling() {
    alert('Khởi động Audio Storytelling: Chào mừng bạn đến với <?= $dest['name'] ?>. Hãy đeo tai nghe để trải nghiệm tốt nhất!');
}
</script>
