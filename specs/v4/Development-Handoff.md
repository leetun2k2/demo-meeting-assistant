# Development Handoff — v4

Cập nhật: 2026-11-06. **Implementation S1/S2 HOÀN TẤT; Static checks PASS; S3 Fixture sẵn sàng cho kiểm chứng live.** Không có quyết định sản phẩm chặn. Đã xử lý Finding #2 (cache prose restore), đồng bộ prompt/helper roster và chuẩn bị fixture `screenshot-meeting-fixture.json`.

## Mục tiêu và ủy quyền

Yêu cầu user: từ notes chứa tên người tham gia, hệ thống phải kết hợp toàn hội thoại để tự nhận diện người nói; không bắt người dùng nghe rồi nhập Person 1/2/3. Quyết định này thay điều kiện cũ đòi mapping hoặc câu đáp xác nhận tên trực tiếp.

Đã hoàn thành triển khai mã nguồn cho S1 và S2. Không commit hoặc deploy khi chưa có yêu cầu từ user.

## Revision và hiện trạng

Repository demo-meeting-assistant; macOS/Darwin; branch `main`.
Mã nguồn đã cập nhật:
- `lib/meeting/gemini.ts`: Prompt suy luận kết hợp roster và toàn bộ hội thoại.
- `lib/constants.ts`: Cập nhật placeholder và helper text cho notes.
- `lib/meeting/cacheCompat.ts`: Đã chuẩn hóa toàn bộ các trường prose theo bảng tên khi phục hồi cache (giải quyết Finding #2).
- `specs/v4/screenshot-meeting-fixture.json`: Fixture transcript 61 đoạn trích xuất từ ảnh kết quả phục vụ kiểm chứng S3 (TC-016).
- Static checks: `tsc --noEmit`, `eslint`, `next build` đều đạt PASS 100%.

## Tài liệu chuẩn

- [PRD](PRD.md): FR-01/05/06 đã cập nhật; §10 AC-17–20 là acceptance mới.
- [Requirement Findings](Requirement-Findings.md): kết luận hiện hành ở đầu; khảo sát cũ được giữ làm lịch sử.
- [Technical Design](Technical-Design.md): suy luận hai nguồn trong một summary request, giữ contract/raw data/state semantics.
- [Implementation Plan](Implementation-Plan.md): S1 hoàn thiện diff, S2 nhất quán kết quả, S3 kiểm chứng thực tế; không lặp backlog baseline cũ.
- [Test Specification](Test-Specification.md): TC-014–016 bắt buộc, regression TC-004/010/011/012/013.
- [Verification Results](Verification-Results.md): lịch sử và static checks trước đó; không có live verdict cho yêu cầu mới.

## Quyết định và giới hạn

Đã xác nhận bởi user: notes + hội thoại phải đủ làm đầu vào suy luận, không yêu cầu mapping thủ công. Giữ tên có căn cứ nhất quán, raw labels/text/timestamp nguyên vẹn, regenerate không extraction lại. Explicit correction vẫn là tùy chọn.

Đề xuất kỹ thuật: giữ pipeline/model/contract hiện có, sửa nhất quán prompt/helper; không gán theo thứ tự/số lượng, không ép dùng hết tên; null khi thực sự không đủ căn cứ/mâu thuẫn. Không thêm evidence schema, biometrics, diarization repair, provider hoặc lượt AI mới; không mở rộng Ask AI. Nếu cần đổi các giới hạn này do live case fail, nêu evidence và đánh giá lại design trước khi mở scope.

## Prerequisite và bước tiếp theo

Bắt đầu S1 bằng đối chiếu diff hiện có với Design §1, sau đó S2. Chuẩn bị S3 độc lập: notes nguyên văn trong ảnh, xác nhận transcript đúng (không mặc định extracted-example.json tương ứng), expected mapping có bằng chứng độc lập và key/quota qua cấu hình hiện có. Không đọc hoặc lưu secrets trong planning. Chuẩn bị expected là công việc QA, không phải bước bắt user gán người nói trong sản phẩm.

Khi thực thi sau planning, chạy checks phù hợp `npx --no-install tsc --noEmit`, `npm run lint`, `npm run build`; live TC-014–016 và regression liên quan; lưu actual revision/input/expected/actual/evidence vào Verification Results. Không thêm unit tests theo mặc định. Thiếu input/provider/ground truth chặn nghiệm thu phần phụ thuộc, không chặn coding và không được ghi pass. Không nghiệm thu bằng static checks, fixture UI hoặc toàn null. Kết thúc planning ở đây; implementation tiếp tục theo yêu cầu sửa tính năng đã có, không tự commit/deploy.
