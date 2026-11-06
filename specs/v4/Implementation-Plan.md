# Implementation Plan — v4

Cập nhật 2026-11-06. Planning ready; chất lượng live chưa xác nhận. Nguồn: [PRD §10](PRD.md), [Technical Design](Technical-Design.md). Baseline notes/regenerate đã có ở HEAD `3959b413d02d9fcc364cfcc02a4f304bb345c7fe`; không triển khai lại T1–T3/N1–N3 của kế hoạch cũ.

## S1 — Hoàn thiện suy luận tự động từ roster và hội thoại

Tiếp nhận diff đang có trong `lib/meeting/gemini.ts` và `lib/constants.ts`, không coi là bản đã nghiệm thu. Rà soát cả speakerNames instruction, notes instruction và helper/placeholder để không còn yêu cầu user tự gán Person/Speaker N hoặc bắt buộc câu đáp xác nhận tên trực tiếp.

Giữ một summary request. Khuyến khích suy luận qua gọi–đáp tự nhiên, tiếp tục demo, vai trò và bằng chứng muộn, kể cả tên chỉ có trong notes. Không gán theo thứ tự, số lượng, nhắc tên người thứ ba hoặc ép mọi label có tên. Hỗ trợ đính chính rõ và null khi mâu thuẫn. Không hardcode tên/đáp án mẫu, không thay raw transcript, response schema, model hay key handling.

Hoàn tất khi đường Process lần đầu và Regenerate dùng cùng quy tắc; ca dương TC-014/015 nhận đúng tên, ca âm TC-012/015 không ép tên. Prompt diff đã tồn tại, phần còn lại là đối chiếu và hoàn thiện dựa trên evidence; không tạo implementation mới chỉ để khớp kế hoạch.

## S2 — Xác nhận tên được áp dụng trên kết quả hiện có

Phụ thuộc contract mapping không đổi của S1. Đối chiếu UI/copy/export và luồng snapshot/regenerate/cache theo Design §2–3; chỉ sửa gap thực sự ảnh hưởng yêu cầu mới. Tên mới thay đồng bộ summary/map, raw text/timestamp giữ nguyên. Regenerate lỗi giữ bản thành công trước. Load cache không tự gọi AI; kết quả cũ cần regenerate chủ động để áp dụng prompt mới.

Đối chiếu finding lịch sử cache prose restore và custom assignee với code hiện hành trước khi coi còn thiếu hoặc đã sửa; chỉ nhận phần liên quan tính nhất quán, không mở refactor. Hoàn tất qua TC-004/010/011 và assertion reload/export của TC-016, không chỉ đọc helper.

## S3 — Kiểm chứng ca thực tế và bàn giao kết quả

Phụ thuộc S1/S2; có thể chuẩn bị input/evidence trước. Chép nguyên notes trong ảnh vào fixture dữ liệu không chứa key; xác nhận transcript tương ứng ảnh có phải extracted-example.json không. Không đoán tên từ chữ đọc không rõ. Lập expected mapping/bằng chứng độc lập trước gọi AI; đây là công việc kiểm chứng, không yêu cầu nhập mapping trong sản phẩm.

Chạy live TC-014–016 và regression bị ảnh hưởng; ghi từng request/run, revision, notes/input reference, expected/actual từng label, nguồn và timestamp hỗ trợ, lỗi/provider limitation. Nếu chưa có căn cứ cho một label trong mẫu thực, ghi chính xác gap; không đánh cả case pass bằng toàn null. Ca dương tổng hợp không thay TC-016. Provider lỗi là chưa xác nhận chất lượng, không sửa output trước nghiệm thu.

Checks hiện có sau code change: `npx --no-install tsc --noEmit`, `npm run lint`, `npm run build`. Không thêm unit tests theo mặc định. Lưu kết quả mới vào [Verification Results](Verification-Results.md), phân biệt lịch sử; không tự đổi verdict cũ thành pass. Nếu inference không đạt, phân loại nguyên nhân rồi điều chỉnh trong scope hoặc đề xuất design mới nếu cần thay kiến trúc.

## Trình tự và ranh giới

S1 → S2 → live verification S3; chuẩn bị evidence S3 độc lập. Không có blocker coding; nghiệm thu S3 phụ thuộc notes/transcript chính xác, provider live và đáp án độc lập. Lượt gọi skill hiện tại chỉ lập kế hoạch, không code/test/commit/deploy. Yêu cầu sửa tính năng ở lượt trước được giữ làm bối cảnh ủy quyền; hoàn tất planning không tự chuyển sang implementation/review hoặc cấp quyền deploy.
