# Test Specification — v3

Ngày: 2026-11-06. Trạng thái: thiết kế kiểm thử, chưa thực thi. Tham chiếu [PRD](PRD.md), [contract đề xuất](Technical-Design.md).

## 1. Phạm vi và chuẩn bị

Demo local, một tab, ứng dụng đã triển khai T1–T3. Cần key/quota hợp lệ qua cơ chế cấu hình hiện có; không đưa key vào tài liệu hoặc evidence. Chuẩn bị file chuẩn `meeting-2026-11-06.m4a`, audio giải mã được >20 MiB, audio hợp lệ đúng 100 MiB nếu có thể tạo phù hợp container, file quá 100 MiB, file rỗng/hỏng, audio silence, input ngắn và audio thực khoảng 60 phút. Các fixture chưa có ngoài file chuẩn là prerequisites chưa được đáp ứng.

Ca boundary chỉ kiểm tra validator không thay thế khả năng decode: có thể dùng payload synthetic để kiểm tra request có qua size gate không, nhưng không kỳ vọng STT thành công với dữ liệu giả. Để xác nhận đúng 100 MiB xử lý thực cần fixture audio hợp lệ đúng byte đó; không dùng padding không được container hỗ trợ.

Dùng browser Network và fault injection cục bộ để chứng minh số call/failure paths; không cần framework mới. Fault injection không được sửa production behavior hoặc lưu key. Xóa fixtures tạm và restore network/storage overrides sau mỗi ca; cleanup provider resource đã biết, không xóa tài nguyên không thuộc lượt test.

## 2. Danh sách ca

| ID | Ưu tiên | Kịch bản | AC |
|---|---|---|---|
| TC-001 | Critical | File chuẩn end-to-end và retry summary | 01,04,06,12 |
| TC-002 | Critical | File >20 MiB, giới hạn byte và audio ~60 phút | 02,03,05 |
| TC-003 | High | Timeout/provider lỗi/late response | 04,05,06,10,12 |
| TC-004 | High | Storage đầy, checkpoint và reload | 06,08 |
| TC-005 | High | Text cap, transcript dài và export | 07,09 |
| TC-006 | High | Silence, file hỏng, input nhỏ và recording | 10,11 |

## 3. Ca chi tiết và API chains

### TC-001 — File chuẩn

Precondition: file chuẩn, key/quota hợp lệ, không có fault injection ở lượt happy path.

Chain: upload file → Process → `POST /api/process-meeting` multipart hiện có → capture transcript/result `transcribed` → `POST /api/summarize-meeting` → Results → export.

Assertions: stage/elapsed phản ánh hai bước; nhấn Process lặp không tạo thêm request. Transcript có mặt trước summary; mỗi bước gọi đúng một lần. Kết thúc trong deadline PRD hoặc báo fail/timeouts trung thực. Nghe đối chiếu các đoạn speech đầu/giữa/cuối, chuyển chủ đề và ít nhất một quyết định/task nếu có; ghi timestamp và nhận xét, không chỉ kiểm tra segment cuối. Core summary phản ánh cả phần cuối, không dùng dữ liệu mẫu. Timestamp/speaker nhất quán, không yêu cầu AI trả chuỗi chính xác cố định.

Lượt failure riêng: chặn summary sau STT → giữ/export transcript → bỏ chặn → Retry Summary. Đếm chỉ tăng summary call, không tăng STT/upload. Theo dõi cleanup resource sau STT; injection cleanup failure chỉ tạo cảnh báo, vẫn có transcript. Không ghi transcript nhạy cảm vào report.

### TC-002 — Byte và duration targets

Chain: chọn rỗng/quá ngưỡng → xác nhận browser chặn; gửi trực tiếp multipart quá 104.857.600 byte → HTTP 413, không gọi provider. Kiểm tra gate đúng ngưỡng được qua; nếu payload giả thì tách kết quả validation khỏi decode. Upload audio hợp lệ >20 MiB → process/summary; chạy audio thực ~60 phút tương tự TC-001.

Assertions: UI/server dùng cùng MiB; đúng ngưỡng không bị báo quá dung lượng; file >20 MiB không vướng limit cũ; ~60 phút hoàn thành và nội dung được đối chiếu đầu/giữa/cuối. Ghi size/duration/format/stage timings và số ký tự serialized. >60 phút có warning khi metadata khả dụng; metadata không đọc được có fallback và vẫn thao tác được. Nếu text >cap thì transcript vẫn thành công nhưng mục tiêu end-to-end summary của fixture chưa đạt, ghi rõ.

### TC-003 — Failure và deadline

Precondition: dùng input ngắn để giảm chi phí; fault injection trì hoãn/lỗi response trong môi trường local.

Chain: lỗi upload/STT (network, key/quota hoặc provider 5xx); noncompleted/truncated/malformed STT; trì hoãn request đầu quá budget; riêng summary quá budget sau khi nhận transcript. Sau lỗi, bắt đầu attempt mới rồi cho response attempt cũ tới.

Assertions: lỗi phân loại đúng bước, no_speech không được dùng cho lỗi; spinner kết thúc, retry được. Browser budget đầu 12 phút, summary tối đa 2 phút, tổng 15 phút; có thể dùng clock/budget override chỉ trong harness local và ghi rõ, không coi đó là benchmark live. Abort không hứa provider đã ngừng. Lượt cũ không sửa memory/cache/navigate của lượt mới. Server cleanup được thử nếu có ID, lỗi cleanup có warning khi response còn gửi được. Response non-JSON có thông báo dễ hiểu, không crash. Không in key trong thông điệp/log/export.

### TC-004 — Không mất kết quả vì cache

Precondition: có kết quả cũ A trong cache. Dùng storage override/quota thật để làm write kết quả B thất bại.

Chain: xử lý B → nhận transcript → summary → điều hướng Results → export; kiểm tra không hiện A. Restore storage, chạy lại một input → reload sau `transcribed` (giữ summary chưa hoàn tất bằng fault injection); reload lần khác sau completed.

Assertions: B trong memory là nguồn ưu tiên; warning cache failure và export dùng B; xử lý stale cache theo design. Cache thành công phục hồi checkpoint/terminal đúng; checkpoint cho phép tạo summary thủ công, không tự gửi AI lại. Audio sau reload không khả dụng nhưng transcript vẫn đọc/search/export. Không yêu cầu phục hồi lượt STT bị reload trước khi nhận transcript.

### TC-005 — Transcript lớn

Precondition: fixture synthetic đúng schema có đoạn/câu duy nhất gần cuối; JSON serialized tại 200000 và 200001 ký tự. Đây là fixture để kiểm tra UI/contracts, không xác nhận chất lượng AI.

Chain: mở dữ liệu trong phiên → search/filter → jump từ insight đến đoạn ngoài trang → export JSON/Markdown; gửi summary và Ask AI với input trên text cap.

Assertions: search toàn dữ liệu, 100 đoạn/trang, jump mở đúng đích kể cả filter đang che; export có câu ở đầu/cuối, đầy đủ segment count, giữ summary null/failure hợp lệ. Đúng 200000 qua text gate, 200001 bị từ chối trước gọi model với HTTP 400 rõ ràng; không cắt text. UI giữ transcript, chặn retry vô ích khi input không đổi. Với input hợp lệ trong cap, summary lỗi context/output từ provider vẫn giữ transcript và thông báo. Raw JSON không render nguyên khối mặc định.

### TC-006 — Regression và empty state

Chain: file hỏng/sai định dạng → báo lỗi; audio silence hợp lệ → no_speech; audio ngắn có lời → hai bước và Results; ghi âm ngắn → Process; đối chiếu code/UI vẫn giới hạn recording 5 phút và byte cũ.

Assertions: silence không gọi summary, không sinh insight mẫu. File hỏng khác silence. Kết quả ngắn có task edit/complete, copy/export, Ask AI trên dữ liệu thật. Audio jump khi còn Blob, graceful fallback khi không còn. Không tuyên bố chất lượng nhận diện dựa trên fixture giả.

## 4. Evidence và khoảng trống

Ghi mỗi TC pass/fail/unrun, fixture metadata, revision, môi trường, stage/total time, segment/serialized-character count, quan sát cleanup và đường retry; không lưu key hoặc toàn bộ payload nhạy cảm. Static checks chạy sau implementation không thay thế các ca live. Provider capacity, omission trong STT và chất lượng summary chỉ xác nhận qua audio thật; file chuẩn một mình không chứng minh cả 100 MiB và 60 phút. Không có kết quả kiểm thử trong tài liệu này.
