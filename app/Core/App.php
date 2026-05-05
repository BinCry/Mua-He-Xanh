<?php
namespace App\Core;

/**
 * App — Router + Dispatcher
 * Parse URL → xác định Controller + Action → dispatch
 */
class App
{
    private string $controller = 'Home';
    private string $action = 'index';
    private array $params = [];

    /**
     * Route map: URL prefix → [Controller class, action method]
     * Thứ tự quan trọng: route dài hơn phải đặt trước
     */
    private array $routes = [
        // API routes (JSON)
        'api/destinations' => ['Api', 'destinations'],
        'api/journey'      => ['Api', 'journey'],
        'api/checkin'      => ['Api', 'checkin'],
        'api/session'      => ['Api', 'session'],
        'api/badges'       => ['Api', 'badges'],

        // Page routes (HTML)
        'onboarding'  => ['Onboarding', 'index'],
        'journey'     => ['Journey', 'index'],
        'map'         => ['Map', 'index'],
        'explore'     => ['Explore', 'show'],     // explore/{slug}
        'checkin'     => ['Checkin', 'index'],
        'summary'     => ['Summary', 'index'],
        'destinations'=> ['Explore', 'list'],
    ];

    private array $config;

    public function __construct()
    {
        $this->config = require dirname(__DIR__) . '/config.php';
        $url = $this->parseUrl();
        $this->resolve($url);
    }

    /** Parse URL từ query string */
    private function parseUrl(): array
    {
        $url = $_GET['url'] ?? '';
        
        // Nếu $_GET['url'] trống, thử lấy từ REQUEST_URI (phòng trường hợp .htaccess khác)
        if ($url === '' || $url === 'index.php') {
            $requestUri = $_SERVER['REQUEST_URI'] ?? '';
            $scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
            
            // Loại bỏ base path (ví dụ: /binh-loi-healing)
            $basePath = str_replace('/index.php', '', $scriptName);
            $url = str_replace($basePath, '', $requestUri);
            
            // Loại bỏ query string if any
            if ($pos = strpos($url, '?')) {
                $url = substr($url, 0, $pos);
            }
        }

        $url = trim($url, '/');
        if ($url === '' || $url === 'index.php') return [];
        return explode('/', filter_var($url, FILTER_SANITIZE_URL));
    }

    /** Resolve URL → Controller + Action + Params */
    private function resolve(array $urlParts): void
    {
        if (empty($urlParts)) {
            // Root → HomeController::index
            $this->controller = 'Home';
            $this->action = 'index';
            return;
        }

        $fullUrl = implode('/', $urlParts);

        // Tìm route phù hợp (longest match first)
        foreach ($this->routes as $pattern => $target) {
            if ($fullUrl === $pattern || strpos($fullUrl, $pattern . '/') === 0) {
                $this->controller = $target[0];
                $this->action = $target[1];

                // Phần còn lại sau pattern → params
                $remaining = substr($fullUrl, strlen($pattern));
                $remaining = trim($remaining, '/');
                if ($remaining !== '' && $remaining !== false) {
                    $this->params = explode('/', $remaining);
                }
                return;
            }
        }

        // Fallback: URL segment đầu tiên = controller
        $this->controller = ucfirst($urlParts[0]);
        $this->action = $urlParts[1] ?? 'index';
        $this->params = array_slice($urlParts, 2);
    }

    /** Dispatch — khởi tạo Controller và gọi Action */
    public function dispatch(): void
    {
        $className = "App\\Controllers\\{$this->controller}Controller";

        if (!class_exists($className)) {
            http_response_code(404);
            echo "<div style='text-align:center; padding: 100px 20px; font-family: sans-serif;'>";
            echo "<h1 style='font-size: 80px; color: #5c8a5e; margin-bottom: 20px;'>404</h1>";
            echo "<h2>Oops! Không tìm thấy trang này.</h2>";
            echo "<p style='color: #666;'>Có vẻ như đường dẫn bạn truy cập không tồn tại hoặc đã bị thay đổi.</p>";
            echo "<a href='" . $this->config['base_url'] . "/' style='display:inline-block; margin-top:30px; padding: 12px 30px; background:#5c8a5e; color:white; text-decoration:none; border-radius:30px;'>← Về trang chủ</a>";
            echo "</div>";
            return;
        }

        $controllerObj = new $className();

        if (!method_exists($controllerObj, $this->action)) {
            http_response_code(404);
            echo "<h1>404 — Action không tồn tại</h1>";
            return;
        }

        // Gọi action với params
        call_user_func_array([$controllerObj, $this->action], $this->params);
    }
}
