<?php
namespace App\Core;

/**
 * Base Controller — Abstract
 * Cung cấp helper methods cho tất cả Controller
 */
abstract class Controller
{
    protected array $config;

    public function __construct()
    {
        $this->config = require dirname(__DIR__) . '/config.php';
    }

    // ─── VIEW RENDERING ────────────────────────────────────────────────

    /**
     * Render view với layout
     * @param string $view  Đường dẫn view (vd: 'home/index')
     * @param array  $data  Dữ liệu truyền vào view
     * @param string $layout Layout sử dụng (default: 'main')
     */
    protected function render(string $view, array $data = [], string $layout = 'main'): void
    {
        // Biến dùng chung cho mọi view
        $data['APP_URL']  = $this->config['app_url'];
        $data['APP_NAME'] = $this->config['app_name'];
        $data['BASE_URL'] = $this->config['base_url'];

        // Extract data thành biến cho view
        extract($data);

        // Capture nội dung view
        $viewPath = dirname(__DIR__) . "/Views/{$view}.php";
        if (!file_exists($viewPath)) {
            http_response_code(404);
            echo "<h1>View not found: {$view}</h1>";
            return;
        }
        ob_start();
        require $viewPath;
        $content = ob_get_clean();

        // Render trong layout
        $layoutPath = dirname(__DIR__) . "/Views/layouts/{$layout}.php";
        if (file_exists($layoutPath)) {
            require $layoutPath;
        } else {
            echo $content;
        }
    }

    /**
     * Render view không có layout (cho partial/AJAX)
     */
    protected function renderPartial(string $view, array $data = []): void
    {
        $data['APP_URL']  = $this->config['app_url'];
        $data['APP_NAME'] = $this->config['app_name'];
        $data['BASE_URL'] = $this->config['base_url'];
        extract($data);

        $viewPath = dirname(__DIR__) . "/Views/{$view}.php";
        if (file_exists($viewPath)) {
            require $viewPath;
        }
    }

    // ─── JSON RESPONSE ─────────────────────────────────────────────────

    /** Trả về JSON thành công */
    protected function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    /** Trả về JSON lỗi */
    protected function jsonError(string $message, int $status = 400): void
    {
        $this->json(['success' => false, 'message' => $message], $status);
    }

    // ─── REQUEST HELPERS ───────────────────────────────────────────────

    /** Lấy body JSON từ POST request */
    protected function getJsonBody(): array
    {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }

    /** Redirect */
    protected function redirect(string $path): void
    {
        header("Location: {$this->config['base_url']}/{$path}");
        exit;
    }

    /** Lấy session UUID từ cookie */
    protected function getSessionUuid(): ?string
    {
        return $_COOKIE[$this->config['cookie_name']] ?? null;
    }

    /** Set session UUID cookie */
    protected function setSessionCookie(string $uuid): void
    {
        setcookie(
            $this->config['cookie_name'],
            $uuid,
            time() + $this->config['session_lifetime'],
            $this->config['app_url'] . '/',
            '',
            false,
            true
        );
        $_COOKIE[$this->config['cookie_name']] = $uuid;
    }
}
