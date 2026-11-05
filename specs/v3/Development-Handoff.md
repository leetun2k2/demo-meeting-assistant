# Development Handoff — v3

Ngày: 2026-11-06. Planning ready; live acceptance chưa xác nhận.

## Mục tiêu và quyền thực hiện

Viết lại PRD đầy đủ cho demo, tập trung file nặng, sau đó chạy `2-development-plan`. Người dùng giao tự chọn phương án đơn giản phù hợp demo khi có concern. Lượt này chỉ tạo tài liệu; chưa có yêu cầu sửa code, chạy functional test, commit hoặc deploy.

Repository: `demo-meeting-assistant`; branch `main`; revision khảo sát `22414eeb7aef4833204f334073ce08e7bd1d2b6d`. Working tree đã có `.gitignore` sửa và `specs/v3/` chưa tracked trước khi soạn; không thay đổi nội dung ngoài tài liệu v3.

## Tài liệu chuẩn

- [PRD](PRD.md): scope, mục tiêu, FR, AC và DoD.
- [Requirement Findings](Requirement-Findings.md): vấn đề thực tế, giới hạn bằng chứng và lựa chọn demo.
- [Technical Design](Technical-Design.md): ranh giới hai request, contract, budget, cache và transcript UI.
- [Implementation Plan](Implementation-Plan.md): T1 → T2 → T3 → T4.
- [Test Specification](Test-Specification.md): fixture, API chains, assertions và evidence cần thu.

V3 là tài liệu chuẩn cho thay đổi xử lý file dài; không sửa lại v1/v2. Các tính năng kết quả v2 hiện có giữ nguyên trừ thay đổi cần thiết được nêu trong v3.

## Quyết định cho implementation

Theo yêu cầu ưu tiên đơn giản: local foreground flow, một file/lượt/tab; upload 100 MiB, mục tiêu 60 phút; giữ recording 5 phút và byte cũ; hai request tận dụng summary endpoint hiện có; checkpoint `transcribed`; memory handoff và cache best effort; phân trang transcript 100 đoạn; text cap serialized 200.000 ký tự; không chunking, queue, database hoặc provider mới. Giai đoạn upload/phiên âm được gộp để không cần giả tiến độ/SSE. Budget 12 phút bước đầu, 2 phút summary, tổng 15 phút.

Không có câu hỏi sản phẩm còn chặn implementation planning. Ngưỡng/provider latency chưa được chứng minh; cần key/quota và fixture audio hợp lệ >20 MiB, ~60 phút để chốt acceptance. Giữ rủi ro RAM do multipart/arrayBuffer buffering. Nếu mục tiêu không đạt khi chạy thật, ghi fail/giới hạn cụ thể, không đổi tiêu chí hoặc thêm kiến trúc lớn âm thầm.

## Bước tiếp theo

Khi được yêu cầu triển khai, bắt đầu T1 theo Technical Design, cập nhật route/client/types/validator đồng bộ, rồi T2/T3. Đọc docs Next.js local theo AGENTS trước viết code; dùng checks hiện có `bunx tsc --noEmit`, `bun run lint`, `bun run build`. T4 thực thi test spec và lưu Verification-Results.md với evidence thật. Chưa có application changes hoặc test results từ planning.
