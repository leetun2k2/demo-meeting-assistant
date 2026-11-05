# Requirement Findings — v3

Ngày: 2026-11-06. Nguồn: [PRD](PRD.md), source hiện tại và metadata file chuẩn. Kết luận: yêu cầu đủ rõ để thiết kế/triển khai demo; năng lực live còn cần kiểm chứng.

## Các vấn đề và hướng giải quyết

1. **File nặng không đồng nghĩa nhiều byte.** File chuẩn 16.398.909 byte dài ~32 phút, dưới giới hạn 20 MiB hiện tại. Vì vậy tăng byte đơn thuần không đủ. PRD yêu cầu bao phủ toàn thời lượng, timeout có giới hạn và bảo toàn transcript. Chưa có bằng chứng một lỗi live cụ thể đã được tái hiện.
2. **Một request dài làm kết quả trung gian không tới browser.** `process-meeting/route.ts` hiện chạy summary sau STT mới trả kết quả. PRD FR-05 yêu cầu browser giữ transcript trước summary. Thiết kế cần thay ranh giới request, không chỉ tăng timeout.
3. **Cache không phải điều kiện để xem kết quả.** `MeetingWorkspace.tsx` ghi localStorage rồi điều hướng; helper ghi có thể thất bại. FR-06 yêu cầu handoff trong bộ nhớ để kết quả mới không bị mất hoặc bị thay bằng cache cũ.
4. **Giới hạn dài cần minh bạch.** Chọn 100 MiB, mục tiêu 60 phút và 200.000 ký tự transcript serialized cho summary/Ask AI; vượt giới hạn text vẫn cho xem/export transcript. Không thêm chunking/map-reduce trong demo. Đây là quyết định thiết kế theo quyền người dùng giao chọn phương án đơn giản, không phải giới hạn provider đã xác minh.
5. **Nội dung phân tích kế thừa policy hiện tại.** Giữ facts/identities/commitments có căn cứ; cho phép suy luận có nhãn cho insights. Không phục hồi policy cũ cấm mọi suy luận trong v2.

## Quyết định và rủi ro còn lại

Theo yêu cầu người dùng ngày 2026-11-06, tự chọn phương án đơn giản cho demo, không cần routine approval. Không còn câu hỏi sản phẩm chặn planning. Các mục tiêu byte/thời lượng/budget chưa có benchmark live; cần file audio hợp lệ >20 MiB và ~60 phút ngoài file chuẩn để nghiệm thu AC-02/03. Chỉ tăng dung lượng bằng padding hoặc đổi tên file không chứng minh hỗ trợ audio dài.

Không có yêu cầu triển khai code, commit hoặc deploy trong lượt này. Tài liệu bàn giao không tạo thêm quyền đó.
