# Báo cáo audit production readiness — Bình Lợi

**Ngày:** 10/10/2026 (Asia/Saigon)
**Repo:** `BinCry/Mua-He-Xanh` · branch `main` · commit `699334c`
**Mục tiêu:** rà FE, BE, luồng nghiệp vụ, dữ liệu giả và cache cho hệ thống có người dùng thật.

> Findings và số liệu audit bên dưới mô tả baseline tại commit trên. Phần “Cập nhật triển khai” ở cuối ghi trạng thái của working tree sau khi thực hiện roadmap; thay đổi chưa được deploy hoặc xác minh bằng database staging.

## Codebase và nghiệp vụ hiện tại

### Sản phẩm đang được code mô tả

Theo cấu trúc trang và dữ liệu trong repo, đây là web trải nghiệm/du lịch Bình Lợi: khách tìm địa điểm, khám phá bản đồ, tạo lịch trình, ghi nhận check-in để nhận điểm/huy hiệu, rồi dùng các trang Passport, review, sự kiện và workshop/shop. Bên vận hành có màn quản lý nội dung và xử lý booking. Phần dưới mô tả **hành vi thấy được trong code**, không coi tên nút hay thông điệp quảng bá là bằng chứng một tích hợp đã hoạt động.

### Bản đồ kiến trúc

```text
Trình duyệt (EJS render + JS/CSS trong public/ + service worker)
                │ HTML và JSON API cùng ứng dụng Express
                ▼
src/server.js → src/routes/index.js → middleware xác thực/phân quyền
                                      → src/controllers/*
                                      → src/models/* → src/core/database.js → PostgreSQL
```

- Đây là **một ứng dụng Node.js/Express 5 dạng MVC server-rendered**, dùng EJS cho giao diện và các endpoint JSON trên cùng server. Không thấy một frontend SPA/build riêng; `public/` chứa JS, CSS, ảnh và `sw.js`.
- `src/routes/index.js` là bản đồ URL và ghép middleware; `src/controllers/` xử lý yêu cầu/nghiệp vụ; `src/models/` truy vấn dữ liệu; `src/views/` là template. `src/core/Model.js` cung cấp CRUD PostgreSQL cơ bản; một số nghiệp vụ có query/transaction riêng thay vì đi qua CRUD chung.
- Các bảng/ngữ nghĩa chính thấy trong code gồm `users`, `user_sessions`, `destinations`, `journeys`, `journey_stops`, `check_ins`, `badges`/`user_badges`, `reviews`, `workshops`, `workshop_bookings`, `festivals`/`festival_bookings` và dữ liệu chat/analytics. Khách chưa đăng nhập chủ yếu được nhận diện qua `session_uuid`; khi đăng nhập, session có thể được liên kết với `user_id`.
- Ba nhóm quyền chính là khách/tourist, `manager` và `admin`. Manager gắn với một địa điểm được quản lý; admin vận hành người dùng, địa điểm, nội dung, sự kiện, workshop và cấu hình.

### Bản đồ nghiệp vụ theo luồng

| Luồng | Dữ liệu và chuyển trạng thái theo code | Mức độ thực chất hiện tại |
|---|---|---|
| Khám phá địa điểm | Trang home/explore/map đọc destinations; người dùng có thể lưu/thích địa điểm và mở nội dung chi tiết | Trang đọc dữ liệu và tương tác API; session API đang lệch giữa FE/BE nên trạng thái khách cần được sửa/kiểm chứng |
| Cá nhân hóa lịch trình | Onboarding lưu mood, số người, ngân sách, thời lượng vào `user_sessions`; gợi ý tạo `journeys` và `journey_stops`; người dùng có thể chỉnh/xác nhận lịch trình | Có luồng dữ liệu và lịch trình lưu DB. “AI” hiện chủ yếu là lọc/sắp xếp heuristic theo dữ liệu địa điểm; một số khoảng cách là đường chim bay, không phải tối ưu đường đi thực tế |
| Check-in, điểm, huy hiệu, Passport | QR/GPS gửi slug địa điểm và tọa độ; server ghi check-in, cộng điểm; Passport tổng hợp lịch sử và huy hiệu | Có ghi dữ liệu và khóa chống lặp; bằng chứng vị trí/QR chưa đáng tin vì slug/tọa độ có thể do client tự gửi. QR Passport cũng chưa đồng nghĩa với token check-in |
| Shop/workshop | Khách tạo `workshop_bookings`; manager đổi trạng thái pending → confirmed/completed hoặc cancelled; có cộng/trừ điểm và đánh giá | Là booking nghiệp vụ nội bộ; repo không thấy cổng thanh toán. QR ticket đang là chuỗi, chưa xác minh được luồng quét/đổi vé end-to-end |
| Lễ hội | Endpoint công khai tạo `festival_bookings` và trả xác nhận | Đang là bản ghi đăng ký với status confirmed; chưa thấy mã vé được phát/gắn vào Passport hay tích hợp gửi vé. Cách đọc số lượng khách có lỗi với lựa chọn gia đình/đoàn |
| Review và cộng đồng | Tạo/xóa review, like, comment; chat đọc/gửi qua API | Có route và lưu trữ phía server; chat cập nhật bằng polling, không phải WebSocket. Voice note có nhánh giả lập gửi text khi không có quyền microphone |
| Quản trị vận hành | Admin quản lý người dùng/nội dung; manager quản lý địa điểm/workshop và xử lý booking | Có giao diện và route phân quyền; độ an toàn mỗi thao tác còn phụ thuộc việc kiểm tra quyền, transaction và xác thực dữ liệu tại từng controller |

### Các ranh giới cần giữ rõ khi đọc kết quả audit

- **Đã có trong code** không đồng nghĩa **đã chứng minh chạy tốt với user thật**: local checkout không có cấu hình database staging nên audit chưa thực hiện ghi booking/check-in hoặc xác nhận vai trò bằng dữ liệu thử.
- **Có giao diện** không đồng nghĩa **đã có dịch vụ phía sau**: trong repo không thấy cổng thanh toán; một số thông báo vé, AI và voice mô tả khả năng vượt quá backend hiện có.
- **Cache hiện tại** có hai lớp khác mục đích: cache truy vấn trong RAM của một Node process và header cache HTTP/static. RAM cache không tự chia sẻ/đồng bộ giữa nhiều instance; các trang HTML đã đo được trả `private, max-age=0, must-revalidate`, trong khi static assets được cache immutable một năm và phụ thuộc version asset để cập nhật. Cấu hình API production hiện gọi domain apex từ trang `www`, nên thực tế có phát sinh cross-origin.
- Vì vậy, phần “luồng ảo” trong findings chỉ gọi là ảo khi UI/API báo hoàn tất nhưng không có bản ghi/artefact tương ứng (ví dụ vé); các luồng heuristic hoặc chưa chạy staging được ghi đúng là mô phỏng/giới hạn/chưa xác minh, không kết luận rằng dữ liệu production đã bị sai.

## Kết luận điều hành

Trang công khai và database production đang trả lời bình thường, nhưng chưa đủ bằng chứng để xác nhận các luồng tạo giao dịch, tích điểm và phát vé an toàn cho người dùng thật. Mức cần xử lý trước là lỗi đồng bộ session/CORS, xác thực check-in, xác nhận vé sự kiện “ảo”, khả năng tạo booking trùng và script có thể ghi đè dữ liệu analytics bằng dữ liệu giả.

Mình chỉ thực hiện GET trên production và chạy E2E đang cấu hình trỏ tới domain live; không gửi booking, check-in, đăng nhập hay cập nhật dữ liệu trên production. Local không có `.env`/`DATABASE_URL`, nên các luồng ghi DB chưa thể chạy end-to-end bằng một database staging.

## Phạm vi và kết quả chạy

- Clone repo, `npm ci` hoàn tất. Runtime hiện có Node `v25.6.1`; README yêu cầu Node `>=20`.
- `npm test`: **47/47 pass**.
- `npm run test:e2e`: **7/15 pass, 8 fail**. 5 accessibility checks và 2 legal-page checks pass. Cả 8 bài responsive đều đi qua kiểm tra scroll ngang/ảnh, nhưng fail ở assertion cuối vì lỗi CORS khi session sync gọi sang domain apex.
- Production GET `/api/health` và `/api/ready`: **200**, `Cache-Control: no-store`.
- Production GET `/`, `/explore`, `/shops`, `/map`: **200**, nhưng HTML có `Cache-Control: private, max-age=0, must-revalidate`. `/sw.js` là `no-store`; assets CSS/JS đang trả `public, max-age=31536000, immutable`; manifest cache 1 giờ.
- `npm audit`: **5 findings** tổng cộng (3 high trong dependency dev, 2 moderate trong dependency production). `npm audit --omit=dev`: 2 moderate (`exceljs`, `uuid`).
- E2E hiện chỉ kiểm tra trang công khai, accessibility, responsive và legal pages; không có E2E cho đăng nhập, đặt vé, booking, check-in, tích điểm, hủy đơn hay manager approval.

## Luồng đã rà

| Luồng | Kết quả | Bằng chứng / giới hạn |
|---|---|---|
| Trang công khai, bản đồ, khám phá, login | Trang tải được; axe không phát hiện lỗi critical/serious ở 5 trang | E2E chạy production; session/API console error vẫn tồn tại |
| Layout responsive | Không phát hiện tràn ngang hoặc ảnh hỏng trong 11 route × 8 viewport đã kiểm tra | Suite vẫn fail do lỗi session sync, không phải do phép đo viewport |
| Session và API client | **Fail** | Production HTML đặt API ở domain apex; trình duyệt đang ở `www` và bị CORS chặn |
| Tạo hành trình | Rà mã nguồn; chưa chạy DB flow | Gợi ý gắn nhãn AI nhưng đang là heuristic và có số km dự phòng cố định |
| Check-in/điểm | **Rủi ro gian lận cao** | Server nhận slug và tọa độ do client gửi; không xác thực token QR |
| Workshop/festival booking | Rà mã nguồn; không ghi dữ liệu live | Có khóa sức chứa ở workshop; festival trả thông báo phát vé nhưng chưa tạo/gửi vé |
| Chat/voice note | Rà mã nguồn; không gửi tin nhắn live | Nếu không có microphone, FE tự gửi tin nhắn text giả như voice note thành công |
| Cache | Đã đo header production và rà RAM cache | HTML không được shared-cache; session cache có Map không eviction |

## Findings theo priority

### P1 — Sửa trước khi coi các luồng tương tác là đáng tin cậy

#### P1.1 — API origin và session ID FE/BE không khớp

Production HTML hiện khai báo `apiUrl: 'https://dulichbinhloi.com/api'` trong khi người dùng mở `https://www.dulichbinhloi.com`. CORS của server mặc định tắt nếu không có `CORS_ORIGIN`. E2E ghi nhận preflight tới `/api/session` bị chặn vì thiếu `Access-Control-Allow-Origin`; cùng cấu hình `APP_CONFIG.apiUrl` được dùng cho chat và các API tương tác khác.

Ngay cả khi đổi sang cùng origin, session vẫn lệch: `public/js/app.js` tạo cookie `bl_session_uuid` và POST `{ uuid }`, còn `ApiController.session` chỉ đọc cookie `session_uuid` hoặc UUID trên path; body `uuid` không được dùng. Server có thể tạo một session khác với session mà FE đang giữ.

**Ảnh hưởng:** session khách, tuỳ chọn hành trình và các luồng dùng `APP_CONFIG.apiUrl` có thể không được lưu/đọc trong cùng session; browser console báo lỗi trên các trang công khai.

**Hướng xử lý:** chuyển API sang đường dẫn cùng origin (`/api`); thống nhất một UUID/session do server cấp và dùng chung tên/cơ chế giữa FE, cookie và API. Chỉ mở CORS cụ thể nếu thật sự cần gọi cross-origin. Bổ sung integration test cho browser ở `www` qua POST session rồi GET lại cùng UUID.

**Vị trí:** `src/views/layouts/main.ejs:89-92`, `public/js/app.js:17-27`, `src/server.js:105-106`, `src/controllers/ApiController.js:15-30`.

#### P1.2 — Check-in QR có thể giả bằng slug và tọa độ client

Trang quét QR gửi `slug`, `method`, `lat`, `lng` lên `/api/checkin`. Backend tự tính khoảng cách Haversine trong bán kính 2 km, nhưng toàn bộ tọa độ đến từ client; nội dung QR chỉ cần đại diện slug điểm đến. Không thấy token QR ký số, challenge ngắn hạn hay mã một lần được kiểm tra ở server.

**Ảnh hưởng:** người dùng có thể gửi request trực tiếp hoặc sửa tọa độ từ DevTools để nhận điểm/huy hiệu mà không có bằng chứng đã ở địa điểm. Khóa chống check-in lặp 24 giờ trong `CheckIn.claimForUser` là bảo vệ hữu ích, nhưng không xác minh vị trí thật.

**Hướng xử lý:** mã QR nên chứa token ký số, có hạn dùng và ràng buộc destination; server xác minh/đánh dấu token đã dùng và áp dụng rate limit. GPS client chỉ nên là tín hiệu bổ sung/risk check, không phải bằng chứng duy nhất. Duy trì unique/transaction guard cho mỗi user/điểm/ngày.

**Vị trí:** `src/views/checkin/index.ejs:350-411`, `src/controllers/ApiController.js:132-183`, `src/models/CheckIn.js:46-80`, `src/views/manager/destination.ejs:135-145`.

#### P1.3 — Đăng ký lễ hội báo “đã gửi vé” dù chỉ ghi một dòng booking

API `/api/festival/book` nhận request công khai, không kiểm tra festival tồn tại, phone/ticket count hợp lệ hay giới hạn sức chứa. Nó ghi một dòng với `status: 'confirmed'`, rồi trả “Vé điện tử đã được gửi vào Passport”; model chỉ tạo bảng `festival_bookings` và INSERT, không tạo ticket code, không gửi SMS/Zalo/email và không liên kết booking đó vào Passport.

FE lấy số vé bằng `parseInt(select.value)`: option “Gia đình (4 người)” và “Đoàn đông (>5 người)” không bắt đầu bằng số nên thành `NaN`, sau đó bị fallback thành **1 vé**.

**Ảnh hưởng:** số người đăng ký sai và người dùng nhận xác nhận/vé không tồn tại; không thể đối soát sức chứa từ dữ liệu booking này.

**Hướng xử lý:** gửi `tickets` dạng số từ `<option value="4">`, validate và giới hạn lại ở backend; xác nhận festival tồn tại/sức chứa, có idempotency key; chỉ trả “confirmed/e-ticket sent” sau khi ticket được tạo và lưu vào Passport/gửi qua kênh đã cấu hình. Nếu hiện chỉ là yêu cầu đăng ký, đổi status và nội dung UI thành “đã nhận yêu cầu”.

**Vị trí:** `src/views/festivals/index.ejs:101-158`, `src/controllers/FestivalController.js:23-43`, `src/models/Festival.js:19-35`.

#### P1.4 — Workshop booking có thể tạo đơn trùng sau timeout và hủy có race condition

Workshop có điểm tốt: server khóa hàng workshop (`FOR UPDATE`) trước khi tính sức chứa, nên các booking đồng thời được tuần tự hóa. Điểm thưởng +50 được cộng ngay lúc tạo booking, trước khi manager xác nhận. Sau `COMMIT`, server mới tạo notification; notification helper nuốt lỗi và chỉ ghi log, nên booking vẫn có thể báo thành công dù khách/manager không nhận được thông báo. Nếu response bị đứt sau commit, client retry sẽ tạo booking mới vì endpoint không có idempotency key. Hủy đơn đọc booking, cập nhật `cancelled`, rồi trừ điểm bằng hai query ngoài transaction; hai request song song có thể cùng đọc trạng thái cũ và trừ điểm nhiều lần.

**Ảnh hưởng:** booking/điểm thưởng có thể lệch khi client retry hoặc hủy nhanh nhiều lần.

**Hướng xử lý:** yêu cầu idempotency key duy nhất theo user + thao tác; trả kết quả theo booking đã commit; dùng outbox/retry cho notification; hủy bằng `UPDATE ... WHERE status IN (...) RETURNING` cùng cập nhật điểm trong một transaction/ledger. Chỉ cấp điểm theo trạng thái nghiệp vụ đã chốt.

**Vị trí:** `src/controllers/ShopController.js:188-260`, `src/controllers/ShopController.js:269-323`.

#### P1.5 — Script analytics ghi dữ liệu giả vào lịch sử thật

`scripts/normalize_historical_analytics.js` sinh IP Việt Nam, User-Agent, URL trang và phân bổ ngẫu nhiên cho từng `session_start`, sau đó UPDATE hàng loạt bảng `analytics` và `user_sessions`. Script không có `--dry-run`, không phân biệt production và có log gọi dữ liệu sinh ra là thiết bị/khách “thật”. Nó còn import database module từ đường dẫn tuyệt đối trên máy developer.

**Ảnh hưởng:** nếu script từng chạy với DB production, analytics lịch sử và dữ liệu IP/User-Agent không còn là bằng chứng lưu lượng thật; số liệu dashboard/báo cáo không thể tin cậy.

**Hướng xử lý:** không chạy script với production. Xác minh lịch sử deploy/runbook và đối chiếu bản backup/raw access logs trước khi dùng analytics. Đưa script ra khỏi công cụ production hoặc buộc dry-run, database allowlist chỉ dev/staging và tạo snapshot/backup trước mọi thao tác. Repo/live check không cho biết script đã từng được chạy hay chưa.

**Vị trí:** `scripts/normalize_historical_analytics.js:1-2, 87-142, 150-190, 204-206`.

#### P1.6 — Error handler có thể trả stack trace cho client

Global error handler trả `err.message` và `err.stack` trong JSON 500. Một số controller cũng trả thẳng `error.message` cho client.

**Ảnh hưởng:** lộ đường dẫn file, cấu trúc code và chi tiết lỗi nội bộ/DB khi xảy ra lỗi chưa bắt.

**Hướng xử lý:** client chỉ nhận thông báo chung cùng request ID; log stack ở server có kiểm soát quyền truy cập. Chuẩn hóa các controller catch để không trả raw exception trong production.

**Vị trí:** `src/server.js:494-502`; ví dụ `src/controllers/JourneyController.js:351-354`.

### P2 — Cải thiện để tăng độ tin cậy và khả năng chịu tải

#### P2.1 — Cache HTML chưa tận dụng được CDN; session Map tăng theo thời gian

Quan sát production: HTML các trang công khai trả `private, max-age=0, must-revalidate`, nên không được shared-cache ở edge; trong code `PUBLIC_CACHEABLE_PATHS`/`isPublicCacheablePath` được khai báo nhưng không được dùng. Dữ liệu explore/shop/map lại cache bằng `Map` trong RAM từng process, nên invalidation không đồng bộ giữa các worker. Static assets được cache 1 năm `immutable`; `assetV` hiện là chuỗi cố định `114.0.0`, nên phải nhớ đổi version mỗi lần phát hành asset.

`src/models/UserSession.js` giữ mọi UUID trong `sessionCache` Map với TTL 5 phút nhưng không có cleanup/eviction; entry hết hạn chỉ bị thay khi chính UUID đó được đọc lại. Session mới có thể làm Map tăng mãi trong tuổi thọ process.

**Hướng xử lý:** đặt chính sách riêng cho anonymous public HTML và authenticated HTML (`no-store`); chỉ bật edge cache sau khi loại bỏ nội dung cá nhân khỏi response/cache key. Dùng content-hash cho assets. Thêm giới hạn/eviction cho mọi Map; với nhiều worker, dùng cache phân tán hoặc chấp nhận TTL rõ ràng và invalidation có chia sẻ. Chuẩn hóa giới hạn kích thước/query cache keys.

**Vị trí:** `src/server.js:133-135, 188-212, 396`; `src/core/cache.js:1-83`; `src/models/UserSession.js:2-34`; cache usage tại `src/controllers/ExploreController.js:12-52`, `src/controllers/ShopController.js:13-115`.

#### P2.2 — Một số trải nghiệm gắn nhãn AI/QR/voice nhưng backend chưa thực hiện điều được hứa

- Hành trình “AI tối ưu tuyến ngắn nhất” đang lấy một số điểm theo thứ tự danh sách và tính khoảng cách đường chim bay; fallback có giá trị cố định 4.2 km/180 phút. Không thấy gọi AI provider trong luồng này.
- Khi không cấp quyền microphone, manager/admin chat tự gửi text `[Ghi âm thoại: 0:12]` và toast thành công. Đây không phải file audio.
- Booking workshop hiển thị “Vé QR” nhưng `my-bookings.ejs` chỉ in chuỗi `qr_ticket`; chuỗi được tạo bằng `Math.random`, chưa thấy luồng quét/đổi vé tương ứng. Passport QR lại mã hóa `session.uuid`, trong khi check-in điểm đến đang nhận slug.

**Hướng xử lý:** đổi nhãn sang “gợi ý theo bộ lọc”/“ước tính”, hoặc tích hợp route distance thật và ghi rõ fallback; voice note lỗi thì báo chưa gửi, không tạo message giả; chuẩn hóa loại ticket, QR token ngẫu nhiên có unique constraint và endpoint redeem server-side.

**Vị trí:** `src/controllers/JourneyController.js:140-153, 266-281`; `src/models/Journey.js:39-75`; `src/views/manager/chat.ejs:649-650`; `src/views/admin/chat.ejs:664-665`; `src/views/shop/my-bookings.ejs:45`; `src/controllers/ShopController.js:215-223`; `src/views/summary/index.ejs:126-130`.

#### P2.3 — Cấu hình `.env.example` không chạy được với database layer hiện tại

README và `.env.example` hướng dẫn `DB_HOST/DB_USER/DB_PASSWORD` (mẫu còn ghi cổng 3306), trong khi config/database chỉ đọc `DATABASE_URL` PostgreSQL. Clone hiện không có `.env`; khởi động local báo thiếu `DATABASE_URL`, vì vậy không thể chạy flow DB bằng cấu hình đã hướng dẫn.

**Hướng xử lý:** đồng bộ `.env.example`, README và `config/env.js` vào PostgreSQL `DATABASE_URL`; giữ secrets ngoài repo; thêm startup/preflight kiểm tra env để báo lỗi một lần, rõ ràng.

**Vị trí:** `.env.example:1-12`, `README.md:168-184`, `src/config/env.js:12-16`, `src/core/database.js:10-18`.

#### P2.4 — Nút QR cố định che nội dung trên mobile thấp

Ảnh E2E ở viewport 320×568 cho thấy nút QR cố định giữa đáy màn hình phủ lên tiêu đề “Gửi email cho chúng tôi” của trang liên hệ. Layout không tràn ngang, nhưng nút che nội dung/điểm tương tác khi cuộn đến vùng cuối.

**Hướng xử lý:** dành bottom padding theo kích thước nút + safe-area, hoặc ẩn/di chuyển floating control ở trang có nội dung sát đáy; kiểm tra lại tại chiều cao 568 và 667 px.

**Vị trí:** `src/views/layouts/main.ejs:121-126, 208-222`; ảnh: `test-results/responsive-public-pages-fit-mobile-320/test-failed-1.png`.

#### P2.5 — Dependency audit

`npm audit` báo 3 high ở chuỗi dev (`nodemon`/`chokidar`/`braces`) và 2 moderate ở production (`exceljs`, `uuid`). Cần đánh giá đường gọi thực tế và nâng phiên bản có kiểm thử tương thích; không dùng `npm audit fix --force` mù vì có đề xuất major downgrade/upgrade.

## Lộ trình xử lý

Lộ trình dưới đây ưu tiên khôi phục độ tin cậy của session trước, rồi mới sửa các giao dịch/điểm/vé phụ thuộc session và cuối cùng tối ưu cache. Đây là thứ tự đề xuất theo findings; thời lượng cụ thể cần chốt sau khi biết nhân lực, hệ thống đang triển khai và bên gửi vé/thanh toán.

### Phase 0 — Chặn rủi ro dữ liệu và chốt quy tắc nghiệp vụ

- Tạm ngăn `scripts/normalize_historical_analytics.js` chạy trên production; kiểm tra lịch sử job/deploy/database audit log để xác minh script đã chạy chưa. Nếu có khả năng đã chạy, lưu snapshot và đối chiếu raw logs/backup trước khi sửa hoặc diễn giải analytics.
- Tạo/kiểm tra staging PostgreSQL, tài khoản và dữ liệu thử tách biệt; sửa env/setup để đội có thể khởi động đúng cấu hình PostgreSQL trước khi kiểm chứng các thao tác ghi.
- Product chốt một bảng quy tắc cho festival (số vé, sức chứa, lúc xác nhận, kênh gửi), workshop (có cần thanh toán không, lúc nào giữ chỗ/hoàn điểm), check-in (điều kiện nhận điểm), và ý nghĩa các trạng thái booking. Nếu chưa có dịch vụ gửi vé hoặc thu tiền thì giao diện phải mô tả đúng quy trình hiện có.

**Đầu ra / cổng qua phase:** script analytics được cô lập khỏi production; có staging không dùng dữ liệu khách thật; có quyết định nghiệp vụ cho trạng thái/điểm/vé/thanh toán. Không chạy sửa dữ liệu lịch sử khi chưa có bản sao và nguồn đối chiếu.

### Phase 1 — Sửa đường đi API/session và lỗi production lộ thông tin

Áp dụng P1.1, P1.6 và P2.3. Đưa API về cùng origin với trang web hoặc cấu hình CORS allowlist rõ ràng; chọn một định danh session chuẩn giữa FE, cookie và API; đảm bảo session khách sau đăng nhập được liên kết với user thay vì tạo nhánh session khác. Chuẩn hóa response lỗi để client chỉ nhận thông báo an toàn, còn stack/request ID được ghi ở server. Đồng bộ `.env.example`, README và PostgreSQL `DATABASE_URL`.

**Đầu ra / cổng qua phase:** từ `www`, tạo session rồi tải lại vẫn nhận đúng cùng session; các API chính không bị CORS chặn; response 500 không có stack/đường dẫn nội bộ; staging khởi động bằng hướng dẫn trong repo.

### Phase 2 — Làm tin cậy check-in, booking, điểm và vé

Áp dụng P1.2–P1.4. Tách thành ba nhánh nghiệp vụ nhưng dùng chung nguyên tắc: backend quyết định trạng thái cuối, request retry không tạo giao dịch thứ hai, và thay đổi trạng thái/điểm/sức chứa được commit nhất quán.

- **Check-in:** phát QR có token ký số, hạn dùng và ràng buộc địa điểm; server xác minh và tiêu thụ token một lần. Giữ khóa chống lặp; coi GPS phía client là tín hiệu bổ trợ.
- **Workshop:** thêm idempotency cho tạo booking; hủy và điều chỉnh điểm trong cùng transaction với điều kiện trạng thái; chốt quy tắc thời điểm cộng/thu hồi điểm; dùng outbox/retry để booking đã commit không phụ thuộc việc notification gửi tức thì.
- **Festival:** gửi số lượng vé dạng số; kiểm tra festival, số lượng và sức chứa ở backend; chống submit lặp; chỉ xác nhận khi có record/ticket thật. Nếu chưa tích hợp được kênh phát vé thì dùng trạng thái “đã nhận yêu cầu”, không báo vé đã gửi.
- **Vé:** thống nhất mã vé/QR và endpoint xác nhận đổi vé, có unique constraint và ghi nhận người/thời điểm redeem; không dùng QR Passport/session UUID thay cho ticket/check-in token.

**Đầu ra / cổng qua phase:** retry cùng thao tác không sinh booking/điểm trùng; booking đồng thời không vượt sức chứa; hủy song song chỉ đảo điểm một lần; QR check-in sai/hết hạn/đã dùng bị từ chối; festival 1/2/4/>5 người lưu đúng số và chỉ nhận thông báo đúng với trạng thái thật.

### Phase 3 — Đồng bộ trải nghiệm với khả năng backend và thêm khả năng truy vết

Áp dụng P2.2 và hoàn thiện thông điệp cho các luồng P1.3/P1.4. Đổi nhãn “AI tối ưu” thành gợi ý heuristic/ước tính cho tới khi có routing/AI thật; voice note không có audio thì báo lỗi hoặc chưa gửi, không tạo message giả; chỉ hiển thị “vé QR” khi có quy trình phát và redeem thực sự. Gắn request ID, log chuyển trạng thái booking/check-in, lỗi gửi thông báo và phát vé để đội vận hành tra được một giao dịch từ lúc nhận request đến kết quả.

**Đầu ra / cổng qua phase:** nội dung UI phản ánh đúng dữ liệu/artefact đã tạo; hỗ trợ có thể tra theo mã giao dịch/request ID; lỗi tích hợp không bị biến thành toast thành công.

### Phase 4 — Ổn định cache, session memory và cập nhật asset

Áp dụng P2.1. Đặt giới hạn/eviction cho `sessionCache` và các `Map` cache; xác định cache nào là nguồn tạm, TTL và cách invalidation. Nếu chạy nhiều process/replica, không dựa vào RAM từng process cho trạng thái cần nhất quán: dùng shared store phù hợp hoặc đọc lại DB. Chỉ bật shared/edge cache cho route công khai sau khi xác minh response không chứa dữ liệu cá nhân; trang cần session phải giữ chính sách private/no-store phù hợp. Chuyển static assets sang content-hash hoặc version tự sinh để tránh giữ JS/CSS cũ.

**Đầu ra / cổng qua phase:** cache có giới hạn bộ nhớ; cập nhật/xóa địa điểm hoặc workshop không để dữ liệu cũ kéo dài ngoài TTL đã định; người dùng khác nhau không nhận chéo dữ liệu; asset sau deploy được browser tải đúng phiên bản. Chỉ benchmark CDN sau khi các điều kiện này đạt.

### Phase 5 — Kiểm chứng staging và phát hành có kiểm soát

Áp dụng P2.4/P2.5 và đóng các gate nghiệp vụ trước khi đưa thay đổi ra production. Chạy luồng trên staging có DB và tài khoản test: session restore/OAuth; tạo, sửa, xác nhận hành trình; check-in hợp lệ, sai vị trí, hết hạn và dùng lại; đăng ký festival theo mọi số lượng; booking workshop đồng thời, retry, cancel, complete và review; manager approval; chat/upload/voice fallback; cache sau khi cập nhật dữ liệu. Kiểm tra responsive tại mobile thấp 320×568; nâng dependency theo từng nhóm, đọc breaking changes và xác nhận package tree thay vì chạy `npm audit fix --force` mù.

Phát hành theo canary/nhóm nhỏ nếu hạ tầng hỗ trợ, theo dõi tỷ lệ lỗi API, booking trùng, over-capacity, sai lệch điểm, ticket delivery, notification và cache hit/stale; chuẩn bị rollback ứng dụng và migration tương thích ngược. Không dùng production có user thật để tạo booking/check-in thử. Khi không có canary, chỉ phát hành sau khi staging gate đạt và có cửa sổ giám sát/rollback rõ ràng.

**Điều kiện kết thúc lộ trình:** P1 đóng; dữ liệu booking/điểm/vé có thể đối soát; staging chứng minh luồng end-to-end; không còn thông báo thành công giả; chính sách cache không lộ dữ liệu cá nhân; có monitoring và phương án rollback. Sau đó mới đánh giá lại tuyên bố “sẵn sàng cho user thật”.

## Kết luận readiness tại baseline

**Chưa khuyến nghị xác nhận “sẵn sàng cho user thật” cho các luồng booking/điểm/vé** cho tới khi đóng P1. Public page/readiness đang hoạt động; những gì chưa được kiểm chứng là các thay đổi DB trên staging, OAuth callback thật, thanh toán (nếu nghiệp vụ cần), concurrency và delivery của vé/notification. Đây là giới hạn bằng chứng của lần audit này, không phải khẳng định các luồng ấy đã hỏng trên mọi request.

## Cập nhật triển khai — 11/10/2026

Đây là trạng thái code sau khi thực hiện các phần có thể làm an toàn trong checkout local. Các findings và số liệu production/E2E phía trên là snapshot baseline, không phải phép đo lại sau thay đổi.

### Đã sửa trong working tree

- **Session/API và lỗi server:** trang gọi API cùng origin `/api`, server cấp một `session_uuid` HttpOnly/SameSite cookie; bỏ UUID giả do FE tự tạo. Error response production được lọc stack/chi tiết nội bộ và gắn request ID. `/api/ready` kiểm tra schema booking cần thiết.
- **Check-in:** bỏ luồng check-in chỉ bằng slug/GPS; QR quản lý phát token HMAC luân phiên theo phút từ endpoint được phân quyền, không cache. Server kiểm tra token, vị trí đích và giới hạn bán kính; client không thể tự khai session UUID.
- **Workshop:** thêm idempotency và khóa sức chứa trong transaction; trạng thái booking, thông báo và điểm được cập nhật nhất quán. Điểm mới chỉ cộng khi manager hoàn tất booking; hủy/retry không cộng trừ lặp. Chuỗi booking hiển thị là mã đơn, chưa gọi là vé QR.
- **Festival:** số lượng người được gửi dạng số; backend kiểm tra sự kiện, giới hạn số lượng mỗi yêu cầu và chống submit lặp. Kết quả là yêu cầu `pending` có mã tham chiếu, chưa phải vé; admin có trang xử lý thủ công.
- **Nội dung mô phỏng:** hành trình hiện mô tả là gợi ý theo sở thích, bỏ số km/thời lượng giả mặc định và không tự tạo hành trình 3 điểm khi khách chưa chọn. Khoảng cách được ghi rõ là ước tính đường chim bay. Chat khách, widget nổi, admin và manager không còn gửi tin giả khi thiếu micro hoặc upload lỗi; các tin nhắn legacy không có audio được hiển thị là bản ghi không có tệp.
- **Cache/assets:** giới hạn số entry trong cache RAM, thêm eviction cho session Map và invalidation ở các cập nhật liên quan; rút TTL một số cache; asset version thay theo commit/hash; bump service worker cache.
- **Mobile P2.4:** tăng khoảng đệm cuối footer/content cho nút QR nổi và safe-area thêm 30 px để tiêu đề/liên kết cuối trang có thể cuộn khỏi vùng nút. Chưa chạy lại browser test ở viewport 320×568 trong checkout local.
- **Analytics/setup:** script normalize analytics giờ từ chối production và chỉ cho phép apply trên loopback khi bật cờ tường minh. README và `.env.example` thống nhất PostgreSQL `DATABASE_URL`; secret session không còn fallback cứng.

### Kiểm tra local sau thay đổi

- `npm test`: **47/47 pass**. Hai fixture check-in cũ được chuyển từ slug sang QR ký số hợp lệ; assertion radius vẫn kiểm tra request ngoài bán kính cấu hình.
- `node --check`: **26 file JavaScript pass**; EJS compile **13 view pass**; `git diff --check` pass.
- Không chạy E2E vì cấu hình test E2E đang nhắm domain production; không chạy migration hay ghi booking/check-in trên production.

### Cổng còn mở trước khi deploy

- **Chưa có staging DB/credentials trong checkout.** Migration [`20261011_booking_idempotency.sql`](/D:/Agentic_BL/scripts/migrations/20261011_booking_idempotency.sql) chưa được chạy; `/api/ready` sẽ báo `not_ready` cho tới khi schema có đủ cột. Cần backup staging, chạy migration ngoài transaction (có `CREATE INDEX CONCURRENTLY`), rồi kiểm thử toàn bộ booking/điểm trước deploy.
- **Chưa cấu hình `CHECKIN_QR_SECRET` trên môi trường deploy.** Production cần secret riêng tối thiểu 32 ký tự; app chủ động không khởi động nếu thiếu.
- **Check-in chưa chống được chia sẻ/replay trong cửa sổ token 60 giây; GPS của browser vẫn là bằng chứng do client cung cấp.** QR chỉ tăng chi phí gian lận và buộc manager mở dashboard tại địa điểm, không phải xác thực vị trí mạnh. Cần quyết định mức gian lận chấp nhận được hoặc bổ sung xác minh tại chỗ.
- **Festival chưa có SMS/email/payment/ticket redemption.** Admin xác nhận vẫn là thao tác nội bộ; phải tích hợp kênh liên hệ và phát vé nếu nghiệp vụ yêu cầu xác nhận tự động.
- **Workshop QR hiện chưa có endpoint redeem/quét vé**; code đổi nhãn thành mã đơn để không hứa sai. Nếu cần check-in workshop, phải thiết kế token vé và luồng redeem riêng.
- **P2.5 dependency upgrades** chưa xử lý. Audit baseline có 5 finding tổng thể (2 moderate khi bỏ dev dependencies); `npm install qrcode` không giải quyết các finding hiện có. Cần đọc breaking changes và nâng theo nhóm sau khi xác nhận tương thích.
- Chưa chạy kiểm thử staging, OAuth callback thật, tải đồng thời/overbooking, cũng chưa deploy/canary hoặc ghi production data.

### Readiness hiện tại

**Checkout đã giảm các lỗi nghiệp vụ P1 có thể sửa mà không đụng dữ liệu production, nhưng chưa đủ điều kiện tuyên bố sẵn sàng cho user thật.** Trạng thái phù hợp hiện tại là *chờ staging gate*: backup và chạy migration trên staging, cấu hình secret, kiểm tra luồng/đối soát điểm, xử lý các tích hợp vé cần thiết, rồi mới chốt rollout có rollback. Không có production write nào được thực hiện trong lượt này.
