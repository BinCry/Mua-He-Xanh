# UC-04: Xem trước và gửi ngữ cảnh sang live chat

## Phạm vi

Khách chọn Chat nhân viên từ câu trả lời AI, xem summary do server tạo, bổ sung lời nhắn rồi xác nhận gửi. Summary được lưu thành tin nhắn trong hệ thống live chat hiện có để admin/manager tiếp nhận mà không cần màn hình riêng. Bảng xem trước không tự chuyển sang chế độ nhân viên: khách đóng bảng thì tiếp tục trò chuyện với AI, chỉ chuyển khi live chat đã ghi tin nhắn thành công.

## Kế hoạch và nghiệm thu

- [x] Agent cung cấp packet qua endpoint có kiểm tra principal/conversation, expiry và redaction (31 test pause/resume và API pass).
- [x] Agent trả bản tóm tắt dạng `clarification_required` (missing field `handoff_confirmation`) kèm `previewId` và `summary` trước khi tạo pause; web hiển thị nguyên văn summary và nhãn xác nhận do agent quy định. Câu hỏi giao diện ("Bạn có muốn gửi cho nhân viên không?") được tách khỏi summary.
- [x] Agent lưu bản summary cuối cùng (đã lọc dữ liệu nhạy cảm) gắn với `preview_id` trong checkpoint và trong pause packet (`customer_preview`), kèm thời hạn. Web chỉ gửi `previewId` và lời nhắn bổ sung; backend kiểm tra quyền sở hữu hội thoại và hạn dùng rồi ghi đúng summary đã lưu, nguyên văn, vào live chat. Lời nhắn bổ sung và mã bàn giao được nối riêng thành các dòng sau summary.
- [x] Nếu nội dung sự việc thay đổi, lượt chat mang `handoffPreviewId` không khớp preview đã xem (hoặc preview hết hạn) sẽ không tạo pause mà trả preview mới để khách xem lại.
- [x] Web dùng ID tin nhắn tất định suy ra từ `previewId` + principal, chèn bằng `ON CONFLICT (id) DO NOTHING` nên bấm lại không tạo tin thứ hai; agent xác nhận giao nhận qua `POST /api/v1/handoffs/{pause_id}/delivery` (idempotent).
- [x] Khôi phục sau timeout/đóng bảng: `GET /api/v1/handoffs/pending?conversationId=...` trả bàn giao đang mở của đúng principal/hội thoại; web tái dựng trạng thái từ packet `customer_preview` và liveness của tin nhắn đã ghi. Chỉ xem trước rồi đóng → không có tin nào cho nhân viên. Đã bấm gửi nhưng chưa ghi tin → "Thử lại" ghi bằng cùng ID. Đã ghi tin nhưng mất phản hồi → dùng lại ID và hoàn tất xác nhận, nhân viên chỉ nhận một tin. Đã gửi thành công → hiển thị "Đã gửi" và cho vào chat nhân viên.
- [x] Hai giao diện chat hiển thị bản xem trước chỉ đọc và lời nhắn bổ sung; không gửi khi mới chuyển tab.
- [x] Test web xác nhận gửi, đóng bảng giữ chế độ AI, lỗi, phân quyền, expiry, chống gửi trùng và cả bốn nhánh khôi phục; test agent xác nhận exact-preview, expired-preview và pending recovery. Chưa kiểm thử live browser/database end-to-end.

## Các giới hạn cần phân biệt

Đợt này nối luồng xem trước/gửi summary theo yêu cầu. Presence nhân viên, dashboard tiếp nhận riêng, nút resolve/resume và retention toàn bộ transcript cần triển khai tiếp; không được xem luồng này là nghiệm thu toàn bộ UC-04.

## Quyết định kỹ thuật

- **Nguồn chân lý cho nội dung gửi** là `customer_preview.summary` do agent sinh và lưu cùng `preview_id`; web không dựng lại, không chuẩn hoá lại summary. Vì vậy phần mô tả sự việc nhân viên nhận khớp nguyên văn phần khách đã thấy.
- **Định danh tin nhắn** = `sha256("handoff:<principalId>:<previewId>")` định dạng UUID; khoá gửi gắn với `previewId` thay vì sống trong panel, nên đóng/mở lại hay timeout vẫn tiếp tục đúng lần bàn giao cũ.
- **Trạng thái gửi lưu phía server** (`customer_preview.delivery` + sự tồn tại của tin nhắn live chat) là thứ web đọc lại khi mở panel; khoá chỉ ở browser không xử lý được trường hợp backend đã ghi tin mà browser không biết kết quả.
- Dùng bảng messages hiện hữu để nhân viên nhận summary như một tin nhắn văn bản. Không để browser tự cung cấp verified facts, conversation owner hay checkpoint. Không sửa các thay đổi có sẵn trong workspace.

PR được tách trên origin/main, giữ nguyên luồng review/resume UC-03 và dùng session_uuid giống chat chính. Kiểm tra trong worktree độc lập: npm test 192/192 pass; agent 1649 pass, 16 skip; ruff và mypy sạch. **Chưa chạy** browser/Postgres end-to-end trên môi trường thật — câu SQL `ON CONFLICT` và hành vi trình duyệt chỉ được mô phỏng trong test.
