<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= isset($title) ? $title . " | " . $APP_NAME : $APP_NAME ?></title>
    
    <!-- Bootstrap 5 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <!-- Google Fonts: Montserrat (Headings), Overpass (Body), Inter (UI) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Overpass:wght@300;400;600&family=Inter:wght@400;500&family=Caveat:wght@700&display=swap" rel="stylesheet">
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <!-- Animate.css -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
    <!-- Custom CSS -->
    <link rel="stylesheet" href="<?= $BASE_URL ?>/public/css/style.css">
</head>
<body>

    <!-- Page Loader -->
    <div id="page-loader">
        <div class="loader-spinner"></div>
    </div>

    <!-- Navbar -->
    <?php $this->renderPartial('partials/navbar', $data); ?>

    <!-- Main Content -->
    <main class="animate__animated animate__fadeIn">
        <?= $content ?>
    </main>

    <!-- Footer -->
    <?php $this->renderPartial('partials/footer', $data); ?>

    <!-- Back to Top -->
    <div id="back-to-top">
        <i class="bi bi-arrow-up"></i>
    </div>

    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="https://unpkg.com/html5-qrcode"></script>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>
    
    <script>
        // Global App Config
        window.APP_CONFIG = {
            baseUrl: '<?= $BASE_URL ?>',
            apiUrl: '<?= $APP_URL ?>/api'
        };

        // Page Loader & Back to Top Logic
        const hideLoader = () => {
            const loader = document.getElementById('page-loader');
            if (loader && loader.style.visibility !== 'hidden') {
                loader.style.opacity = '0';
                setTimeout(() => { 
                    loader.style.visibility = 'hidden'; 
                    loader.style.display = 'none';
                }, 500);
            }
        };

        window.addEventListener('load', hideLoader);
        // Failsafe: Hide loader after 3 seconds anyway
        setTimeout(hideLoader, 3000);

        const btt = document.getElementById('back-to-top');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                btt.classList.add('show');
            } else {
                btt.classList.remove('show');
            }
        });
        btt.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    </script>
    <script src="<?= $BASE_URL ?>/public/js/app.js"></script>
    
    <?php if (isset($scripts)) echo $scripts; ?>

</body>
</html>
