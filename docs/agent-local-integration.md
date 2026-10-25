# Nối chat Bình Lợi với AI Helpdesk Agent tại local

Web gọi agent qua endpoint nội bộ từ backend Express. Trình duyệt không nhận URL bí mật, service token hay API key của model. Chế độ chat với nhân viên hiện tại vẫn hoạt động riêng.

## Cấu hình an toàn

Khi web và agent chạy trên cùng VPS, cấu hình môi trường web:

- `AI_SERVICE_CHAT_URL=http://127.0.0.1:8100/api/v1/chat` (đổi `8100` nếu agent dùng cổng khác).
- `AI_SERVICE_AUTH_TOKEN` bằng cùng secret có trong môi trường agent; tối thiểu 32 ký tự.

Để agent chỉ nhận kết nối nội bộ, bind agent vào `127.0.0.1:8100` và không mở cổng này trên firewall công khai. HTTP chỉ được dùng cho loopback; nếu web và agent ở hai máy khác nhau, dùng endpoint `https://` và lưu token bằng secret manager của hai service.

Agent cũng cần `DESTINATION_API_BASE_URL` trỏ tới web API. Nếu web lắng nghe nội bộ ở cổng `3000`, dùng `http://127.0.0.1:3000`; nếu đi qua domain, dùng HTTPS. Mỗi service giữ cấu hình database riêng: web dùng `DATABASE_URL`, agent dùng `AGENT_DATABASE_URL`.

PEM chỉ dùng để đăng nhập SSH hoặc mở SSH tunnel tới VPS; ứng dụng không đọc PEM. Không đưa token hoặc API key vào `.env.example`, mã trình duyệt, log, ảnh chụp hay video demo. Không cấu hình API key của model trong repo web.

## Chạy thử UC-01

1. Trên VPS, bảo đảm PostgreSQL agent đã sẵn sàng và schema được thiết lập theo `agent/README.md` trong repo `nhom-43`.
2. Cấu hình secret provider, `AGENT_DATABASE_URL` và `AI_SERVICE_AUTH_TOKEN` cho agent; bind agent tại `127.0.0.1:8100`.
3. Cấu hình web với `DATABASE_URL`, `AI_SERVICE_CHAT_URL` và cùng `AI_SERVICE_AUTH_TOKEN`; cấu hình `DESTINATION_API_BASE_URL` cho agent trỏ tới web.
4. Chạy/restart hai service, rồi đăng nhập web, mở `/chat`, chọn **Hỏi trợ lý AI** và hỏi về một điểm đến công khai, ví dụ “Bình Lợi có gì?”.
5. Kiểm tra câu trả lời cùng nguồn tham khảo `/explore/...`. Chọn hành động bàn giao để chuyển về **Chat nhân viên**.

Endpoint `/api/agent/chat` chỉ nhận câu hỏi văn bản tối đa 2.000 ký tự. Web tự gắn principal đã xác thực, role và conversation ID từ server-side session. Chế độ AI không ghi tin nhắn vào hộp thư nhân viên và không nhận ảnh, GIF hoặc âm thanh.

Nếu agent chưa cấu hình hoặc không phản hồi, web chỉ hiện thông báo lỗi chung; chi tiết HTTP, token và nội dung header không được trả về trình duyệt.
