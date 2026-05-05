<?php 
/** Navbar partial */ 
$request_uri = $_SERVER['REQUEST_URI'] ?? '';
$script_name = $_SERVER['SCRIPT_NAME'] ?? '';
$base_path = str_replace('/index.php', '', $script_name);
$relative_path = trim(str_replace($base_path, '', $request_uri), '/');

$is_home = $relative_path === '' || $relative_path === 'index.php';
$is_dest = strpos($relative_path, 'destinations') === 0 || strpos($relative_path, 'explore') === 0;
$is_journey = strpos($relative_path, 'journey') === 0 || strpos($relative_path, 'onboarding') === 0;
$is_map = strpos($relative_path, 'map') === 0;
$is_checkin = strpos($relative_path, 'checkin') === 0;
$is_summary = strpos($relative_path, 'summary') === 0;
?>
<nav class="navbar navbar-expand-lg navbar-bl">
  <div class="container-site">
    <a class="navbar-brand" href="<?= $BASE_URL ?>/">
      <img src="<?= $BASE_URL ?>/public/images/logo.png" alt="Logo">
      Bình Lợi Healing
    </a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMain" style="border-color:rgba(255,255,255,0.2)">
      <span class="navbar-toggler-icon" style="filter:invert(1)"></span>
    </button>
    <div class="collapse navbar-collapse" id="navMain">
      <ul class="navbar-nav ms-auto align-items-center gap-1">
        <li class="nav-item"><a class="nav-link <?= $is_home ? 'active' : '' ?>" href="<?= $BASE_URL ?>/">Trang chủ</a></li>
        <li class="nav-item"><a class="nav-link <?= $is_dest ? 'active' : '' ?>" href="<?= $BASE_URL ?>/destinations">Điểm đến</a></li>
        <li class="nav-item"><a class="nav-link <?= $is_journey ? 'active' : '' ?>" href="<?= $BASE_URL ?>/journey">Hành trình</a></li>
        <li class="nav-item"><a class="nav-link <?= $is_map ? 'active' : '' ?>" href="<?= $BASE_URL ?>/map">Bản đồ</a></li>
        <li class="nav-item"><a class="nav-link <?= $is_checkin ? 'active' : '' ?>" href="<?= $BASE_URL ?>/checkin">Check-in</a></li>
        <li class="nav-item"><a class="nav-link <?= $is_summary ? 'active' : '' ?>" href="<?= $BASE_URL ?>/summary">Huy hiệu</a></li>
        <li class="nav-item ms-2">
          <a class="btn btn-nav-cta" href="<?= $APP_URL ?>/onboarding">Bắt đầu hành trình ✦</a>
        </li>
      </ul>
    </div>
  </div>
</nav>
