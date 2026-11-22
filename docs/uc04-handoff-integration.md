# UC-04: Xem trước và gửi ngữ cảnh sang live chat

## Phạm vi

Khách chọn Chat nhân viên từ câu trả lời AI, xem summary do server tạo, bổ sung lời nhắn rồi xác nhận gửi. Summary được lưu thành tin nhắn trong hệ thống live chat hiện có để admin/manager tiếp nhận mà không cần màn hình riêng.

## Kế hoạch và nghiệm thu

- [x] Agent cung cấp packet qua endpoint có kiểm tra principal/conversation, expiry và redaction (31 test pause/resume và API pass).
- [x] Web lấy packet server-to-server, tạo summary và chống gửi trùng bằng ID tin nhắn ổn định.
- [x] Hai giao diện chat hiển thị bản xem trước chỉ đọc và lời nhắn bổ sung; không gửi khi mới chuyển tab.
- [x] Test web xác nhận gửi, lỗi, phân quyền, expiry, chống gửi trùng và compile EJS (25 test pass; chưa kiểm thử live browser/database end-to-end).

## Các giới hạn cần phân biệt

Đợt này nối luồng xem trước/gửi summary theo yêu cầu. Presence nhân viên, dashboard tiếp nhận riêng, nút resolve/resume và retention toàn bộ transcript cần triển khai tiếp; không được xem luồng này là nghiệm thu toàn bộ UC-04.

## Quyết định kỹ thuật

Dùng bảng messages hiện hữu để nhân viên nhận summary như một tin nhắn văn bản. Không để browser tự cung cấp verified facts, conversation owner hay checkpoint. Không sửa các thay đổi có sẵn trong workspace.

PR được tách trên origin/main, giữ nguyên luồng review/resume UC-03 và dùng session_uuid giống chat chính. Kiểm tra trong worktree độc lập: npm test 180/180 pass; chưa chạy browser/database end-to-end. Agent cần cung cấp GET /api/v1/handoffs/{pause_id}?conversationId=... trước khi triển khai web.
