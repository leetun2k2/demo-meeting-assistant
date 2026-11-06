# Development Handoff — v4

Ngày: 2026-11-06. **Planning ready; live acceptance chưa xác nhận.** Design/tasks là đề xuất để triển khai khi người dùng yêu cầu, không phải phê duyệt hoặc kết quả hoàn thành.

## Mục tiêu và phạm vi được giao

Người dùng yêu cầu PRD v4 rõ scope demo, sau đó gọi `2-development-plan`. Mục tiêu: nhận tên có căn cứ từ hội thoại, dùng nhất quán, giữ Person N khi không rõ. Lượt này chỉ planning: không sửa ứng dụng, chạy functional tests, commit hoặc deploy; chưa có yêu cầu triển khai tiếp.

Repository `demo-meeting-assistant`, branch `main`, HEAD khảo sát `5660e5f6636bdba0c0790d9789be3008aae61f09`, môi trường Darwin/macOS. Trước planning `specs/v4/` đã untracked, chứa PRD và extracted-example.json; không coi toàn bộ folder là thay đổi do planning. Baseline v3 giữ nguyên.

## Tài liệu canonical

- [PRD](PRD.md): FR-01–04, AC-01–10 và giới hạn demo.
- [Requirement Findings](Requirement-Findings.md): khoảng trống đã quan sát và điều kiện kiểm chứng.
- [Technical Design](Technical-Design.md): prompt + bảng tên hiện có, hiển thị chung, restore schema 3, retry.
- [Implementation Plan](Implementation-Plan.md): T1 → T2 → T3 và verification sau triển khai.
- [Test Specification](Test-Specification.md): TC-001–008, dữ liệu/ground truth, chains và cleanup.

## Quyết định và trạng thái

Yêu cầu từ PRD: ưu tiên tên có bằng chứng, không nhận diện sinh trắc học/sửa diarization, không thêm pipeline/model/provider, giữ raw transcript và summary retry hiện có. Đây là scope người dùng giao làm rõ, không phải cam kết đã đạt.

Đề xuất kỹ thuật: cải thiện prompt, null khi thiếu/mâu thuẫn; helper chung cho UI/prose/export; phân biệt tên trùng bằng số speaker; tương thích hẹp cache schema 3 thiếu map; control inline sửa assignee vì bảng hiện chưa có editor. Không thêm field schema, endpoint hoặc service. Không có quyết định sản phẩm/kiến trúc đang chặn bắt đầu triển khai; các đề xuất chưa được ghi nhận là đã duyệt riêng.

T1/T2/T3 đủ thiết kế để coding khi được giao; không chờ provider để làm logic deterministic. Nghiệm thu phụ thuộc key/quota, bản ghi hai người có đáp án rõ và đánh giá danh tính mẫu thực. Mẫu hiện có summary_failed do 503, chưa chứng minh lỗi tên. Validator không xác minh được tính đúng ngữ nghĩa của tên.

## Bước tiếp theo

Khi có yêu cầu triển khai: đọc guide Next.js local liên quan trong `node_modules/next/dist/docs/` theo AGENTS, bắt đầu T1 rồi T2/T3. Sau code, chạy checks hiện có `bunx tsc --noEmit`, `bun run lint`, `bun run build`; thực thi test spec trong môi trường được phép và ghi `Verification-Results.md` với revision thật, evidence, pass/fail/not-run và giới hạn. Không thêm unit tests theo mặc định. Planning chưa chạy checks hay AI requests; không tự chuyển sang review phase.
