# Implementation Plan — v4

Ngày: 2026-11-06. Trạng thái: Có thể bắt đầu khi người dùng giao triển khai; design là đề xuất, chưa có code/test v4.
Nguồn: [Technical Design](Technical-Design.md), [PRD](PRD.md).

## T1 — Nhận diện có căn cứ và bảng tên an toàn

Mục đích: nhận tên từ toàn hội thoại mà không ép tên cho người chưa rõ (FR-01, FR-03).

- Cải thiện `buildSpeakerNamesInstruction` và hướng dẫn prose/task trong `lib/meeting/gemini.ts` theo ca tiếng Việt của design; giữ request/schema/model/budget.
- Chuẩn hóa bảng đủ raw keys, null fallback, placeholder, whitespace và duplicate conflict. Có thể dùng chung logic thuần với cache; không đưa server module gọi Gemini vào browser bundle.
- Giữ task tự nhận bằng raw key, tên người ngoài bằng text, owner chưa rõ bằng Unknown. Không tự suy luận ownership từ người đang nói.
- Xong khi contract không đổi, map chỉ chứa keys thật và bảo toàn transcript; live behavior kiểm tra theo TC-001–003/007. Thiếu tên không làm summary fail.

## T2 — Tên nhất quán trên kết quả và thao tác task

Phụ thuộc quy tắc bảng tên của T1; có thể chuẩn bị helper trước khi prompt hoàn tất.

- Cập nhật `lib/meeting/display.ts`: tên trùng có số phân biệt; normalize Speaker N/Person N tham chiếu cùng raw key, không đổi lời thoại và không thay lặp.
- Áp dụng ở OutputPage, export/copy, avatar và modal thêm task. Filter/select lưu raw values, chỉ đổi label; summary null cũng export Person N.
- Thêm control inline tối thiểu sửa assignee trong bảng action items vì hiện không có editor; hỗ trợ speaker raw key, tên tự do và Unknown, tái dùng callback hiện có. Không thêm màn hình hoặc chỉnh danh tính toàn cục.
- Giữ normalization server và boundary load nhất quán; JSON giữ raw IDs. Không chỉnh các chức năng Ask AI ngoài tác động dùng helper chung.
- Xong khi TC-004/005/008 quan sát tên nhất quán, phân biệt tên trùng, thao tác task chỉ đổi task; search/filter/jump không bị đổi định danh.

## T3 — Khôi phục dữ liệu cũ và retry đồng bộ

Phụ thuộc contract T1/T2.

- Thêm boundary parse/normalize cache schema 3 dùng chung cho `app/results/page.tsx` và `components/MeetingWorkspace.tsx`; thiếu speakerNames/entry hợp lệ → null. Field sai kiểu và cache version khác tiếp tục bị từ chối.
- Giữ `isStoredMeetingResult` là kiểm tra chặt sau normalization. Không chỉ biến field thành optional trong types để che dữ liệu chưa chuẩn hóa.
- Chuẩn hóa prose lúc restore theo bảng hợp lệ; giữ transcript, key storage và ưu tiên memory. Retry replace toàn summary bằng persist hiện có; không merge bảng cũ vào kết quả mới.
- Xong khi TC-006/008 chứng minh cache/reload/failure giữ đúng dữ liệu, không thêm AI request khi restore và không phiên âm khi retry.

## Verification sau triển khai

Thực hiện [Test Specification](Test-Specification.md) và lưu `Verification-Results.md` với revision thực tế, thay đổi, checks, từng ca pass/fail/not-run và evidence. Không thêm unit tests theo mặc định. Commands sẵn có: `bunx tsc --noEmit`, `bun run lint`, `bun run build` (scripts trong package.json). Đây là kế hoạch, chưa chạy commands.

Thứ tự: T1 → T2 → T3 → verification. Có thể kiểm chứng AI của T1 trước khi T2/T3 hoàn tất để phát hiện sớm vấn đề chất lượng. Không chờ live provider để làm các thay đổi deterministic. Chưa có quyền triển khai, commit, deploy hoặc chạy functional tests trong lượt planning này.

## Bổ sung N1–N3 — notes và regenerate (chưa triển khai)

Baseline T1–T3 đã có code ở HEAD `28a54c1`; không triển khai lại máy móc. Đối chiếu defects/prerequisites trong Verification Results lịch sử khi chạm bề mặt liên quan; chưa coi baseline đã nghiệm thu.

### N1 — Nhận notes và tạo summary có căn cứ

Mở rộng types/summary route/Gemini theo Technical Design §4: optional meetingNotes, validation 10.000 ký tự, prompt hai nguồn có phân biệt, explicit correction precedence, map chỉ raw labels thật. Giữ omitted/empty backward compatible và summary response hiện có. Giữ transcript budget, timeout, key handling, no_speech. Hoàn tất khi request hợp lệ đưa đủ hai nguồn vào một inference, input sai trả 400 trước provider; TC-009/012/013 là verification dự kiến.

### N2 — Notes xuyên suốt workspace/results và cache

Theo contract N1; có thể chuẩn bị UI song song về mặt trình tự công việc. Thêm textarea trước Process và đầu Results, truyền cùng checkpoint/session/result, persist notes đang chỉnh và summaryNotes đã áp dụng. Cập nhật validator/cache boundary cho field optional; JSON giữ snapshot và notes. Kết quả cũ dùng rỗng, cache lỗi giữ memory, cuộc họp mới rỗng. Hoàn tất khi notes đi từ pre-input tới lần summary đầu, reload và export, hiện trạng chưa áp dụng khi sửa; TC-009/013.

### N3 — Tạo lại summary thành công/lỗi an toàn

Phụ thuộc N1/N2. Mở Generate/Retry hiện có cho completed thành Regenerate; đưa notes snapshot vào mọi summary request. Results owner áp dụng functional update nguyên tử, giữ kết quả cũ nếu lỗi. Disable thao tác xung đột lúc pending, cleanup/ignore stale completion; nêu rõ thay tasks/sửa thủ công. Không gọi extraction và không tạo lại chỉ từ notes khi no_speech. Hoàn tất khi TC-010/011 quan sát được cả success/failure/retry và tên đồng bộ mọi bề mặt.

Sau N1 → N2 → N3, chạy checks sẵn có và test spec liên quan; ghi evidence mới, không ghi đè kết quả lịch sử như thể cùng revision. Không thêm unit tests, không triển khai code/chạy functional tests trong lượt planning này.
