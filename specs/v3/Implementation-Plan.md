# Implementation Plan — v3

Ngày: 2026-11-06. Nguồn: [PRD](PRD.md), [Technical Design](Technical-Design.md). Chỉ planning; chưa sửa application code.

## T1 — Tách pipeline và thống nhất contract/budget

Sửa constants/validation/types, process route, STT helpers và summary route để upload tối đa 100 MiB, giữ byte/time recording cũ, thêm `transcribed`, bỏ summary khỏi process route. Đưa summary sang call nối tiếp từ browser. Giữ model/request provider hiện có; không thêm endpoint hoặc queue.

Đặt budget theo design: request đầu 12 phút, summary 2 phút, tổng client 15 phút và cleanup 10s; truyền abort/deadline nhất quán, không chỉ đổi một hằng số. Thêm shared text guard serialized 200.000 ký tự vào summary và giữ Ask AI cùng semantics. Trả lỗi validation/timeout theo contract, phân biệt no_speech và output STT lỗi/truncated. Giữ warnings cleanup trên mọi nhánh có thể trả được.

Hoàn tất khi contract client/server khớp, summary failure không đòi STT lại, các helper không còn timeout cũ vô tình cắt pipeline, recording không tăng limit. Kiểm tra server cũng từ chối >100 MiB khi bỏ qua browser. Không thêm unit test.

## T2 — Giữ transcript và điều khiển phiên xử lý

Phụ thuộc T1. Trong MeetingWorkspace/Results, quản lý attemptId xuyên cả hai call, elapsed/stage/deadline, chặn double submit và late response. Giữ transcript vào memory trước summary; tạo handoff latest result theo mẫu audioSession. Cache chỉ best effort; xử lý failed write và stale cache như design. Cập nhật storedResult validator cho `transcribed`, Results cho transcript chưa summary, summary retry cho trạng thái lỗi và chưa chạy; merge summary không làm mất metadata/user state.

UI hiển thị file byte/duration và cảnh báo >60 phút; metadata load có timeout/fallback, không decode waveform toàn file. Summary text vượt cap có thông báo không hỗ trợ, transcript/export còn dùng được. Không bắt buộc hủy chủ động; unmount/reload không hứa remote cancellation hoặc recovery. No speech bỏ qua summary.

Hoàn tất khi có thể quan sát checkpoint transcript trước summary, cache lỗi vẫn mở Results đúng, reload checkpoint không tự phát sinh AI call và retry summary không upload/STT. Coverage: AC-04–08, AC-10.

## T3 — Dùng kết quả dài và giữ hành vi hiện có

Phụ thuộc T2 cho result handoff. Phân trang transcript 100 đoạn, search/filter toàn dữ liệu, jump mở trang chứa đích và xử lý filter che đích. Giữ audio playback khi Blob còn, graceful fallback sau reload. Export Markdown/JSON toàn dữ liệu khi summary null hoặc failed; lazy Raw JSON tránh serialize lặp toàn transcript. Giữ task edits/copy/Ask AI hiện có, lỗi giới hạn text phải trung thực.

Hoàn tất khi tìm được câu ở cuối dù đang trang đầu, jump tới đúng đoạn, export đầy đủ, input nhỏ không regress. Không thêm UI library hoặc thay layout kết quả ngoài nhu cầu này. Coverage: AC-07–09, AC-11.

## T4 — Xác minh demo và ghi kết quả thực

Phụ thuộc T1–T3. Chạy [Test Specification](Test-Specification.md) bằng các chức năng thực và fault injection cục bộ khi cần. Chạy `bunx tsc --noEmit`, `bun run lint`, `bun run build` theo scripts hiện có, hoặc package runner tương đương được cài; trước khi code đọc lại docs Next.js đúng version như AGENTS yêu cầu. Không coi check static là bằng chứng AI hoạt động.

Đo stage/total, input bytes/duration, transcript segment/character count; log chỉ metadata, không key/audio/full transcript. Tạo `Verification-Results.md` tại lúc execution với revision đã thực hiện, ca pass/fail/unrun, evidence đã ẩn dữ liệu nhạy cảm và giới hạn. Không tạo kết quả pass trước khi chạy. Coverage: toàn bộ AC, đặc biệt file chuẩn và ~60 phút.

## Thứ tự và điều kiện triển khai

T1 → T2 → T3 → T4 là đường ngắn nhất; không cần tách nhiều PR hoặc triển khai song song. Mọi task đủ thiết kế để bắt đầu dưới phạm vi đã chọn; provider capacity và latency là rủi ro nghiệm thu, chưa có benchmark. Nếu không có key/quota/file ~60 phút, có thể hoàn tất code và static checks nhưng phải đánh dấu live acceptance chưa xác nhận. Không commit/deploy theo kế hoạch này.
