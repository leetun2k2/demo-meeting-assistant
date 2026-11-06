# Development Handoff — v4

Ngày cập nhật: 2026-11-06. **Planning ready cho phần notes; chưa triển khai, chưa nghiệm thu.** Design là đề xuất kỹ thuật, không phải phê duyệt riêng hoặc quyền tự triển khai.

## Phạm vi và nguồn

User gọi `2-development-plan` để bổ sung PRD v4: ghi notes trước xử lý, kết hợp extracted data + notes để brief và fill tên đúng, sửa notes sau kết quả rồi tạo lại summary. Chỉ planning; không sửa code, chạy tests, commit hoặc deploy.

Repository `demo-meeting-assistant`, branch `main`, HEAD khảo sát `28a54c1a617d4e16227ca9298fe42f76172a3b96`, Darwin/macOS. Working tree sạch trước lượt này. Baseline tên đã có implementation; các tài liệu khảo sát revision `5660e5f` là lịch sử. Không coi T1–T3 cũ là toàn bộ công việc chưa làm.

## Canonical artifacts

- [PRD](PRD.md): FR-01–07, AC-01–16; §9 bổ sung notes và thay hạn chế transcript-only.
- [Requirement Findings](Requirement-Findings.md): phần bổ sung phân biệt yêu cầu mới với quan sát revision hiện tại.
- [Technical Design](Technical-Design.md): §4 contract notes, persistence và regenerate failure semantics.
- [Implementation Plan](Implementation-Plan.md): N1 → N2 → N3 cho phần chưa triển khai; không lặp lại baseline.
- [Test Specification](Test-Specification.md): TC-009–013 cho notes, TC-001–008 vẫn là regression/acceptance baseline.
- [Verification Results](Verification-Results.md): evidence lịch sử NOT_READY; chưa có kết quả notes, không được suy ra đã pass. Đối chiếu các findings và prerequisite còn tồn tại khi triển khai, không tự đánh dấu đã sửa.

## Yêu cầu, đề xuất và giả định

Yêu cầu xác nhận từ user: notes ở đầu và sau kết quả; summary/name resolution dùng extracted transcript + notes; cho tạo lại khi chưa đúng. Giữ giới hạn baseline: raw transcript/timestamp không bị sửa, không phiên âm lại khi regenerate, không thêm provider/model/pipeline.

Đề xuất triển khai: một notes chung ở hai màn hình; API thêm optional meetingNotes; result thêm optional meetingNotes và summaryNotes trong schema 3. Đính chính danh tính rõ ưu tiên hơn suy luận; notes-only context phải phân biệt nguồn; danh sách tên mơ hồ không đủ gán speaker. Regenerate giữ summary cũ nếu lỗi, thay nguyên tử summary/map nếu thành công.

Các mặc định đề xuất: tối đa 10.000 ký tự notes; khóa chỉnh/sửa xung đột khi pending; regenerate thay toàn tasks kể cả sửa thủ công và thông báo trước. “Đoạn chat” được hiểu là transcript và summary, Ask AI không mở rộng. Nếu user muốn cập nhật cả Ask AI hoặc giữ/merge task thủ công thì cần điều chỉnh scope/design. Không có quyết định đang chặn lập kế hoạch phần được yêu cầu.

## Bước tiếp theo

Khi được yêu cầu triển khai, đọc guide Next.js local liên quan theo AGENTS, bắt đầu N1, N2, N3. Không tạo unit tests mới theo mặc định. Checks hiện có dự kiến: `bunx tsc --noEmit`, `bun run lint`, `bun run build`; sau đó thực thi test spec trong môi trường được phép và lưu evidence/revision thực vào Verification Results, phân biệt với lần review lịch sử. Cần key/quota live và audio/ground truth cho các ca semantic acceptance còn thiếu. Planning lần này chỉ khảo sát và kiểm tra tài liệu đã lưu; không chạy checks, functional tests hoặc AI requests và không tự chuyển sang review phase.
