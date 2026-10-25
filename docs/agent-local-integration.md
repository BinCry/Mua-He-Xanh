# Nối chat Bình Lợi với AI Helpdesk Agent tại local

Web gọi agent qua endpoint nội bộ từ backend Express. Trình duyệt không nhận URL bí mật, service token hay API key của model. Chế độ chat với nhân viên hiện tại vẫn hoạt động riêng.

## Cấu hình an toàn

Trong môi trường server của web, cấu hình:

- `AI_SERVICE_CHAT_URL=http://127.0.0.1:8100/api/v1/chat` khi cả hai service chạy trên cùng máy local.
- `AI_SERVICE_AUTH_TOKEN` bằng cùng secret có trong môi trường agent; tối thiểu 32 ký tự.

Khi deploy tách máy, dùng URL `https://` cho agent và đặt cùng token bằng secret manager của hai service. Không đưa token vào `.env.example`, mã trình duyệt, log, ảnh chụp hay video demo. Không cấu hình API key của model trong repo web.

## Chạy thử UC-01

1. Khởi chạy PostgreSQL agent chuyên dụng và thiết lập schema theo `agent/README.md` trong repo `nhom-43`.
2. Chạy agent ở port `8100` với các secret provider và database được nạp từ secret manager/local environment.
3. Khởi chạy web bằng `npm run dev` sau khi cấu hình database hiện có của web.
4. Đăng nhập, mở `/chat`, chọn **Hỏi trợ lý AI**, rồi hỏi về một điểm đến công khai, ví dụ “Bình Lợi có gì?”.
5. Kiểm tra câu trả lời cùng nguồn tham khảo `/explore/...`. Chuyển về **Chat nhân viên** để dùng lại luồng hỗ trợ trực tiếp.

Endpoint `/api/agent/chat` chỉ nhận câu hỏi văn bản tối đa 2.000 ký tự. Web tự gắn principal đã xác thực, role và conversation ID từ server-side session. Chế độ AI không ghi tin nhắn vào hộp thư nhân viên và không nhận ảnh, GIF hoặc âm thanh.

Nếu agent chưa cấu hình hoặc không phản hồi, web chỉ hiện thông báo lỗi chung; chi tiết HTTP, token và nội dung header không được trả về trình duyệt.
