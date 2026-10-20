# Danh mục Use Case và công việc chi tiết — AI Helpdesk Agent

> Trạng thái: bản đặc tả đề xuất để nhóm rà soát trước khi triển khai.
> Phạm vi: bổ sung AI agent vào web Bình Lợi hiện có; giữ chat và dịch vụ nền hiện tại, chỉ mở rộng phần cần thiết.
> “CV” trong tài liệu này được hiểu là **công việc**.

## 1. Mục tiêu và ranh giới

Agent giúp du khách tìm thông tin, kiểm tra dữ liệu đặt chỗ của chính họ và chuyển các yêu cầu cần xử lý cho nhân viên. Mọi câu trả lời về nghiệp vụ phải dựa trên dữ liệu được phép truy cập. Agent không tự sửa đặt chỗ, phát hành hoàn tiền, thanh toán hoặc tạo yêu cầu ghi dữ liệu khi chưa qua bước xác nhận và phê duyệt của con người.

Các use case bám theo những khả năng đang có của web Bình Lợi: thông tin điểm đến, workshop, chat hỗ trợ trực tiếp và lịch sử đặt workshop của người dùng. Ticket có phê duyệt và luồng agent nhiều bước là năng lực cần xây thêm; tài liệu không giả định các API đó đã tồn tại.

## 2. Tác nhân và quy tắc chung

- **Du khách chưa đăng nhập:** hỏi thông tin công khai về điểm đến, trải nghiệm và dịch vụ.
- **Khách hàng đã đăng nhập:** tra cứu thông tin đặt workshop của chính tài khoản.
- **Nhân viên hỗ trợ / quản lý:** nhận bàn giao, xử lý yêu cầu hoặc duyệt hành động ghi dữ liệu theo quyền.
- **AI agent:** phân loại, truy xuất, gọi công cụ theo quyền, nêu nguồn, tạm dừng hoặc bàn giao khi không đủ căn cứ.

Quy tắc áp dụng cho tất cả UC:

1. Danh tính và quyền được lấy từ phiên xác thực phía máy chủ; không tin `user_id`, vai trò hoặc quyền do prompt/model tự cung cấp.
2. Công cụ chỉ trả dữ liệu tối thiểu trong allowlist; câu trả lời có dữ kiện phải truy ngược được đến nguồn.
3. Công cụ đọc không tạo side effect. Công cụ ghi phải có bước xác nhận, phê duyệt, kiểm tra quyền và chống tạo trùng.
4. Khi thiếu dữ liệu, lỗi công cụ, nguồn mâu thuẫn hoặc yêu cầu vượt phạm vi, agent phải hỏi lại, từ chối có giải thích hoặc bàn giao; không tự suy đoán.
5. Không ghi API key/token/PII vào mã nguồn, prompt, trace, log, fixture, ảnh chụp màn hình hoặc video demo. Dùng dữ liệu tổng hợp cho eval.

## 3. Use Case chi tiết

### UC-01 — Trả lời câu hỏi về điểm đến và dịch vụ có nguồn dẫn

**Ưu tiên / phase:** P0 — vertical slice Phase 1; hoàn thiện RAG ở Phase 2.
**Tác nhân chính:** du khách; agent.
**Mục tiêu:** trả lời câu hỏi công khai về điểm đến, workshop, trải nghiệm và dịch vụ Bình Lợi với nguồn có thể kiểm tra.

**Điều kiện trước:** dữ liệu công khai đã được xác định là nguồn hợp lệ; endpoint chat hiện có hoạt động.
**Kích hoạt:** người dùng hỏi điều gì đó như “Ở Bình Lợi có trải nghiệm nào cho gia đình?”

**Luồng chính:**

1. Agent nhận câu hỏi và xác định đây là yêu cầu thông tin công khai.
2. Nếu thiếu thuộc tính ảnh hưởng kết quả (ví dụ mùa, loại trải nghiệm hoặc nhóm khách), agent hỏi tối đa một câu làm rõ cần thiết.
3. Agent gọi công cụ tra cứu điểm đến/dịch vụ; ở Phase 2, truy xuất thêm tài liệu tri thức đã lập chỉ mục.
4. Agent tổng hợp câu trả lời ngắn, tách dữ kiện khỏi gợi ý và đính kèm tiêu đề/liên kết hoặc định danh nguồn phù hợp.
5. Người dùng có thể hỏi tiếp; agent chỉ dùng lại ngữ cảnh cần thiết và gọi lại công cụ khi cần dữ liệu mới.

**Luồng thay thế / lỗi:**

- Không có kết quả hoặc điểm tin cậy thấp: nêu rõ chưa tìm thấy căn cứ, hỏi lại hoặc mời gặp nhân viên.
- Nguồn mâu thuẫn/lỗi thời: không tự chọn một nguồn; nêu giới hạn và bàn giao.
- Câu hỏi ngoài phạm vi hoặc có prompt injection: từ chối phần không phù hợp, không tiết lộ system prompt hay dữ liệu nội bộ.
- Công cụ lỗi/timeout: thông báo không thể xác minh ở thời điểm này; không dựng câu trả lời từ kiến thức phỏng đoán.

**Công việc chi tiết:**

- Chốt phạm vi agent, nguồn được phép và chính sách abstain — [#4](https://github.com/BinCry/Mua-He-Xanh/issues/4).
- Định nghĩa/triển khai hai công cụ đọc có schema ổn định, xác thực input, giới hạn kết quả và chuẩn hóa lỗi — [#5](https://github.com/BinCry/Mua-He-Xanh/issues/5).
- Xây skill và vòng gọi công cụ có giới hạn; ghi trace từng bước, correlation ID và redaction — [#6](https://github.com/BinCry/Mua-He-Xanh/issues/6).
- Nối agent vào `/chat`, giữ UI tối thiểu và có đường fallback — [#7](https://github.com/BinCry/Mua-He-Xanh/issues/7).
- Tạo tối thiểu 10 eval case cho thành công, mơ hồ, không kết quả, lỗi công cụ, ngoài phạm vi và injection; đưa smoke vào CI — [#8](https://github.com/BinCry/Mua-He-Xanh/issues/8).
- Phase 2: nạp tài liệu có metadata, hybrid retrieval, citation kiểm chứng và golden set — [#10](https://github.com/BinCry/Mua-He-Xanh/issues/10), [#11](https://github.com/BinCry/Mua-He-Xanh/issues/11), [#14](https://github.com/BinCry/Mua-He-Xanh/issues/14).

**Tiêu chí nghiệm thu:** một yêu cầu đi được từ chat → agent → ít nhất hai công cụ; citation trỏ tới nguồn có thật; câu hỏi không có căn cứ dẫn đến abstain/fallback; có trace an toàn và eval tái chạy được.

### UC-02 — Tra cứu đặt chỗ workshop của chính khách hàng

**Ưu tiên / phase:** P1 — Phase 2.
**Tác nhân chính:** khách hàng đã đăng nhập; agent; hệ thống đặt workshop.
**Mục tiêu:** giúp khách xem trạng thái/lịch của đặt chỗ workshop mà không lộ dữ liệu người khác.

**Điều kiện trước:** khách đã xác thực; dữ liệu đặt workshop có sẵn qua dịch vụ hiện hữu. Danh tính người dùng phải lấy từ phiên phía máy chủ.
**Kích hoạt:** “Đặt chỗ workshop cuối tuần của tôi đã được xác nhận chưa?”

**Luồng chính:**

1. Agent nhận ra đây là câu hỏi về dữ liệu cá nhân và yêu cầu đăng nhập nếu phiên chưa xác thực.
2. Backend lấy định danh từ phiên đăng nhập; model không được truyền hoặc thay thế định danh này.
3. Công cụ đọc chỉ tra đặt chỗ thuộc về người dùng hiện tại; nếu có nhiều kết quả, agent hỏi người dùng chọn bằng thông tin không nhạy cảm.
4. Agent chỉ trả các trường được duyệt (ví dụ tên workshop/buổi, ngày và trạng thái); không suy diễn trạng thái hoặc thông tin thanh toán.
5. Nếu cần đổi/hủy, agent không tự ghi dữ liệu mà chuyển sang UC-03 hoặc UC-04.

**Luồng thay thế / lỗi:**

- Chưa đăng nhập: hướng dẫn đăng nhập, không truy vấn bằng thông tin do người dùng tự khai.
- Không có đặt chỗ: nói rõ không tìm thấy bản ghi thuộc tài khoản hiện tại.
- Mã đặt chỗ thuộc người khác: không tiết lộ bản ghi có tồn tại hay không.
- Dịch vụ lỗi: không suy đoán trạng thái; đề nghị thử lại hoặc bàn giao.

**Công việc chi tiết:**

- Đối chiếu endpoint/model đặt workshop hiện có và lập allowlist trường trả về.
- Định nghĩa read-only tool nhận trusted auth context phía máy chủ; tuyệt đối không dùng `user_id` do LLM tạo.
- Kiểm tra quyền sở hữu ở tầng backend, phân trang/giới hạn kết quả và che dữ liệu không cần thiết.
- Tạo test cho chưa đăng nhập, tài khoản không sở hữu, không có kết quả, nhiều kết quả và lỗi dịch vụ.
- Nối end-to-end và lưu evidence — [#14](https://github.com/BinCry/Mua-He-Xanh/issues/14); kiểm tra ranh giới quyền và trace — [#18](https://github.com/BinCry/Mua-He-Xanh/issues/18).

**Tiêu chí nghiệm thu:** dữ liệu luôn được lọc theo danh tính từ phiên máy chủ; không thể tra cứu đặt chỗ của tài khoản khác; công cụ không có quyền sửa/hủy; trường trả về khớp allowlist; các ca quyền truy cập có test tự động.

### UC-03 — Tạo yêu cầu hỗ trợ có xác nhận và phê duyệt của con người

**Ưu tiên / phase:** P1 — Phase 2.
**Tác nhân chính:** khách hàng; agent; nhân viên duyệt.
**Mục tiêu:** chuyển vấn đề cần xử lý thành yêu cầu hỗ trợ mà agent không thể tự ý ghi dữ liệu.

**Điều kiện trước:** có quy trình/endpoint tạo yêu cầu hỗ trợ được nhóm thống nhất; quyền của người duyệt đã xác định. Nếu backend chưa có ticket service, đây là phần cần thiết kế, không dùng nhầm API đặt chỗ.

**Luồng chính:**

1. Agent làm rõ loại vấn đề, nội dung cần hỗ trợ và mã đặt chỗ nếu có.
2. Agent tạo bản tóm tắt cùng các trường sẽ gửi; người dùng xem và xác nhận nội dung.
3. Workflow lưu checkpoint ở trạng thái `pending_approval`; chưa gọi công cụ ghi.
4. Nhân viên có quyền xem bản tóm tắt và chọn duyệt hoặc từ chối.
5. Chỉ sau khi được duyệt, công cụ tạo yêu cầu hỗ trợ với idempotency key; agent trả mã tham chiếu nếu thao tác thành công.
6. Hệ thống ghi audit tối thiểu: ai duyệt, thời điểm, kết quả; không ghi secret/PII thừa.

**Luồng thay thế / lỗi:**

- Người dùng không xác nhận nội dung: không gửi yêu cầu.
- Nhân viên từ chối, approval hết hạn hoặc workflow bị hủy: không tạo ticket; thông báo bước tiếp theo.
- Retry sau timeout: dùng idempotency để không tạo ticket trùng.
- Agent không đủ dữ liệu hoặc phát hiện yêu cầu không phù hợp: hỏi lại hoặc bàn giao trực tiếp.

**Công việc chi tiết:**

- Chốt ticket schema, quyền người duyệt và trạng thái pending/approved/rejected/expired.
- Xây workflow phân loại → thu thập dữ liệu → approval checkpoint → resume → create; giới hạn retry và timeout.
- Tách công cụ đọc và công cụ ghi; khóa mọi side effect trước approval; thêm idempotency và xử lý lỗi nhất quán.
- Tạo test cho approve, reject, cancel, timeout, retry, thiếu quyền và truy cập trái phép.
- Thêm audit/trace có redaction; chạy E2E và lưu evidence — [#13](https://github.com/BinCry/Mua-He-Xanh/issues/13), [#14](https://github.com/BinCry/Mua-He-Xanh/issues/14), [#18](https://github.com/BinCry/Mua-He-Xanh/issues/18).

**Tiêu chí nghiệm thu:** không có ticket trước approval; một lần duyệt chỉ tạo tối đa một ticket; người không có quyền không thể duyệt; từ chối/hết hạn không có side effect; audit truy vết được nhưng không lộ dữ liệu nhạy cảm.

### UC-04 — Bàn giao sang nhân viên và tiếp tục hội thoại

**Ưu tiên / phase:** P1 — fallback ở Phase 1; state pause/resume ở Phase 2; hoàn thiện Phase 3.
**Tác nhân chính:** khách hàng; agent; nhân viên hỗ trợ.
**Mục tiêu:** chuyển đúng lúc sang live support mà không làm mất ngữ cảnh hoặc khiến agent lặp thao tác.

**Điều kiện kích hoạt:** người dùng yêu cầu gặp nhân viên; agent không đủ căn cứ; tool lỗi lặp lại; vấn đề nhạy cảm/khiếu nại; hoặc yêu cầu cần quyền con người.

**Luồng chính:**

1. Agent giải thích lý do bàn giao và tạo bản tóm tắt gồm câu hỏi, dữ kiện đã xác minh, citation và các bước đã thử.
2. Agent loại bỏ token/secret và chỉ đưa dữ liệu cá nhân cần thiết cho nhân viên.
3. Workflow lưu checkpoint, đánh dấu hội thoại đang chờ nhân viên và chuyển qua chat/live support hiện hữu.
4. Nhân viên tiếp nhận, hỏi thêm hoặc phản hồi.
5. Khi tiếp tục, agent đọc checkpoint đúng conversation, tóm tắt phần đã xử lý và chỉ gọi lại công cụ khi cần dữ liệu mới.
6. Khi kết thúc hoặc quá hạn lưu trữ, state được xóa theo chính sách retention.

**Luồng thay thế / lỗi:**

- Nhân viên chưa trực tuyến: đưa lựa chọn chờ, để lại thông tin liên hệ theo chính sách hiện hữu hoặc quay lại sau; không hứa SLA chưa có.
- State không khôi phục được: báo rõ giới hạn và yêu cầu người dùng xác nhận lại dữ kiện cần thiết.
- Checkpoint hết hạn: không tự hồi sinh dữ liệu cũ; tạo phiên mới.

**Công việc chi tiết:**

- Chốt tiêu chí handoff và schema bản tóm tắt; tích hợp với chat/live support hiện hữu — [#7](https://github.com/BinCry/Mua-He-Xanh/issues/7).
- Thiết kế state tối thiểu cho conversation, tool result, approval và checkpoint; pause/resume, compression, retention/clear — [#12](https://github.com/BinCry/Mua-He-Xanh/issues/12).
- Kiểm tra authorization, redaction và trace xuyên suốt; không khôi phục chéo hội thoại — [#18](https://github.com/BinCry/Mua-He-Xanh/issues/18).
- Bổ sung UC-04 vào ma trận use case, eval và demo — [#16](https://github.com/BinCry/Mua-He-Xanh/issues/16), [#19](https://github.com/BinCry/Mua-He-Xanh/issues/19), [#20](https://github.com/BinCry/Mua-He-Xanh/issues/20).

**Tiêu chí nghiệm thu:** nhân viên nhận đủ ngữ cảnh cần thiết; state đúng người/đúng hội thoại; không lộ secret; resume không tạo lại side effect; có test handoff thành công, nhân viên offline, state hết hạn và state không hợp lệ.

### UC-05 — Xử lý yêu cầu hỗ trợ nhiều bước về đặt workshop

**Ưu tiên / phase:** P2 — vertical slice nâng cao Phase 3.
**Tác nhân chính:** khách hàng đã đăng nhập; agent; nhân viên hỗ trợ.
**Mục tiêu:** kết hợp dữ liệu đặt chỗ của khách và chính sách dịch vụ để hướng dẫn bước tiếp theo; không tự sửa đặt chỗ.

**Tình huống mẫu:** “Tôi muốn đổi buổi workshop; đặt chỗ của tôi đang ở trạng thái nào và chính sách đổi lịch ra sao?”

**Điều kiện trước:** UC-01 có nguồn/chính sách có citation; UC-02 có công cụ tra cứu quyền sở hữu; nếu cần hành động thì UC-03/UC-04 đã xác định đường duyệt/bàn giao.

**Luồng chính:**

1. Agent nhận diện ý định và hỏi rõ buổi đặt chỗ nếu người dùng có nhiều bản ghi.
2. Agent tra cứu trạng thái đặt chỗ bằng UC-02, theo danh tính phiên máy chủ.
3. Agent truy xuất chính sách đổi lịch từ nguồn hợp lệ theo UC-01 và xác minh citation.
4. Agent trình bày riêng phần “trạng thái đặt chỗ” và “chính sách”, nêu nguồn và các bước có thể thực hiện.
5. Nếu người dùng muốn thay đổi đặt chỗ, agent không tự sửa; tạo yêu cầu UC-03 sau xác nhận/phê duyệt hoặc bàn giao UC-04.

**Luồng thay thế / lỗi:**

- Không xác thực/không sở hữu bản ghi: dừng tra cứu, không tiết lộ dữ liệu.
- Không tìm được chính sách hoặc nguồn mâu thuẫn: không kết luận quyền lợi; bàn giao.
- Một công cụ lỗi: dừng luồng tại bước phụ thuộc, giữ rõ dữ liệu nào đã xác minh và không giả lập kết quả.
- Agent lặp tool hoặc vượt số bước: dừng theo giới hạn và chuyển sang nhân viên.

**Công việc chi tiết:**

- Viết kế hoạch/route có giới hạn cho chuỗi lookup đặt chỗ → retrieval chính sách → trả lời/handoff.
- Chọn **một** hướng nâng cao (MCP hoặc multi-agent) bằng ADR; chỉ mở rộng quyền tối thiểu và giữ timeout/failure handling — [#17](https://github.com/BinCry/Mua-He-Xanh/issues/17).
- Bảo toàn state/citation qua checkpoint và approval; kết nối UC-02/03/04 — [#12](https://github.com/BinCry/Mua-He-Xanh/issues/12), [#13](https://github.com/BinCry/Mua-He-Xanh/issues/13), [#14](https://github.com/BinCry/Mua-He-Xanh/issues/14).
- Tạo eval end-to-end cho thành công, thiếu xác thực, policy không có nguồn, tool timeout, approval bị từ chối và handoff — [#16](https://github.com/BinCry/Mua-He-Xanh/issues/16), [#18](https://github.com/BinCry/Mua-He-Xanh/issues/18), [#19](https://github.com/BinCry/Mua-He-Xanh/issues/19).
- Ghi lại trace có thể giải thích, video dùng tài khoản/dữ liệu tổng hợp và phần trình bày của owner — [#20](https://github.com/BinCry/Mua-He-Xanh/issues/20).

**Tiêu chí nghiệm thu:** ba bước tra cứu–retrieval–hướng dẫn chạy được có trace; booking không bị thay đổi trực tiếp bởi agent; dữ liệu riêng tư được lọc theo quyền; mọi chính sách có citation; tool lỗi/thiếu quyền dẫn đến dừng hoặc bàn giao có kiểm soát.

## 4. Công việc theo phase và liên kết issue hiện có

Không tạo thêm backlog trùng lặp; dùng 18 issue hiện tại làm work package và gate:

| Phase | Công việc chính | Issue hiện có | Gate |
|---|---|---|---|
| **1 — Bootstrap** | UC-01 vertical slice: boundary/security; hai công cụ đọc; agent loop/skill/trace; nối `/chat`; ≥10 eval case và smoke CI | [#4](https://github.com/BinCry/Mua-He-Xanh/issues/4)–[#8](https://github.com/BinCry/Mua-He-Xanh/issues/8) | [#9](https://github.com/BinCry/Mua-He-Xanh/issues/9) |
| **2 — Mở rộng năng lực** | UC-01 RAG/citation; UC-02 tra cứu booking theo quyền; UC-03 ticket có approval; state pause/resume; ≥3 UC E2E | [#10](https://github.com/BinCry/Mua-He-Xanh/issues/10)–[#14](https://github.com/BinCry/Mua-He-Xanh/issues/14) | [#15](https://github.com/BinCry/Mua-He-Xanh/issues/15) |
| **3 — Hoàn thiện và nộp** | Eval ≥5 UC; chọn MCP hoặc multi-agent; safety/trace; UC-04/05; ma trận K1–K8; báo cáo/demo | [#16](https://github.com/BinCry/Mua-He-Xanh/issues/16)–[#20](https://github.com/BinCry/Mua-He-Xanh/issues/20) | [#21](https://github.com/BinCry/Mua-He-Xanh/issues/21) |

### Phân công hiện có

Giữ phân bổ một work package chính cho mỗi thành viên trong từng phase; không đổi assignee trong tài liệu này:

| Thành viên | Phase 1 | Phase 2 | Phase 3 |
|---|---:|---:|---:|
| Đỗ Lê Tuấn Kiệt (`ken1301`) | #4 | #12 | #18 |
| Phạm Minh Quân (`BinCry`) | #5 | #10 | #19 |
| Phan Nguyễn Anh Kiệt (`kietphan24tg-bit`) | #6 | #11 | #17 |
| Trần Thị Thanh Thảo (`thanhtharo`) | #7 | #13 | #20 |
| Hồ Thị Phương Thùy (`phthuyy`) | #8 | #14 | #16 |

Nhóm review chính theo quyết định hiện tại: Tuấn Kiệt, Minh Quân và Anh Kiệt. Mỗi issue/PR vẫn cần reviewer chéo phù hợp; gate phase cần evidence và xác nhận của cả nhóm.

## 5. Ma trận kiểm thử tối thiểu

| UC | Thành công | Biên/lỗi | An toàn/quyền |
|---|---|---|---|
| UC-01 | Có kết quả và citation hợp lệ | Không kết quả, nguồn mâu thuẫn, timeout | Injection, yêu cầu ngoài phạm vi, câu trả lời không có căn cứ |
| UC-02 | Đọc đúng booking của người dùng | Không booking, nhiều kết quả, service lỗi | Chưa đăng nhập, booking thuộc tài khoản khác, giả mạo `user_id` trong prompt |
| UC-03 | Ticket được tạo sau approval | Reject, cancel, timeout, retry | Không tạo trước approval, người duyệt không đủ quyền, không tạo trùng |
| UC-04 | Nhân viên nhận tóm tắt và agent resume | Nhân viên offline, checkpoint lỗi/hết hạn | Không khôi phục chéo hội thoại, redaction, retention/clear |
| UC-05 | Lookup + retrieval + hướng dẫn có trace | Thiếu một nguồn/tool timeout | Không đổi booking, quyền tối thiểu, citation bắt buộc, dừng khi vượt giới hạn |

## 6. Definition of Done cho từng UC

- Có owner, reviewer, dependency và evidence được gắn trong issue/PR.
- Có sơ đồ hoặc trace từ giao diện → agent/workflow → tool → phản hồi.
- Có test thành công, biên/lỗi và an toàn; fixture dùng dữ liệu tổng hợp.
- Có tiêu chí pass/fail rõ, chạy lại được; citation/quyền/approval được kiểm tra tự động khi áp dụng.
- Không có secret/PII trong source, trace, log, issue, PR hoặc demo.
- Chỉ hoàn tất khi đã review qua PR; không commit trực tiếp lên `main`.

> Các hạn nội bộ vẫn lấy theo issue/milestone hiện có. Đây là kế hoạch phân rã công việc, không tự đặt lại deadline hay xác nhận thay nhóm rằng estimate đã thành baseline.
