# Requirement Findings — v4

Ngày: 2026-11-06. Nguồn: [PRD](PRD.md), khảo sát code tại revision `5660e5f6636bdba0c0790d9789be3008aae61f09`. Chưa chạy kiểm thử.

## Kết luận

Yêu cầu đủ rõ để thiết kế và chia task trong phạm vi demo. Không có quyết định sản phẩm đang chặn planning. Thiết kế dưới đây là đề xuất, chưa phải quyết định đã được duyệt hay kết quả đã kiểm chứng.

## Các phát hiện có tác động

1. **Đã có phần lớn luồng nhận diện, chưa có bằng chứng chất lượng v4.** `lib/meeting/gemini.ts` có `buildSpeakerNamesInstruction`, gửi toàn transcript và chuẩn hóa summary; `lib/meeting/display.ts` có fallback Person N. Cần cải thiện và kiểm chứng các ca cụ thể thay vì xây lại. Mẫu `extracted-example.json` là summary_failed/503, không chứng minh lỗi nhận diện.
2. **Fallback và hiển thị chưa bao phủ mọi bề mặt.** `lib/meeting/export.ts:toMarkdown` trả raw label khi không có summary; `components/OutputPage.tsx` dùng raw label trong lựa chọn assignee của modal thêm task, avatar dùng phần cuối raw assignee. `displaySpeaker` chưa phân biệt tên trùng; `normalizeSpeakerMentions` chỉ xử lý Speaker N, không xử lý Person N do model viết. Đây là các khoảng trống với FR-02/AC-05, không chỉ vấn đề prompt.
3. **Dữ liệu cũ cần chuẩn hóa trước kiểm tra.** `lib/meeting/storedResult.ts:isStoredMeetingResult` bắt buộc speakerNames; cả `/results` và workspace dùng validator này. Đề xuất hỗ trợ cache schemaVersion 3 có summary hợp lệ nhưng thiếu bảng/entry tên; giữ nguyên chủ đích loại cache trước schema 3 của v3. Không mở migration toàn bộ phiên bản cũ. Không có căn cứ để khôi phục danh tính đã mất.
4. **Tên trùng cần phân biệt cả filter và task gắn speaker.** Dùng tên kèm số speaker khi hai ánh xạ hợp lệ cùng tên; không tự gộp hoặc tự loại một người. Đây là yêu cầu đã có trong FR-01, không phải bằng chứng rằng model đã nhận diện đúng hai người cùng tên.
5. **Chỉnh assignee có khoảng trống UI.** OutputPage có callback thay action items và modal thêm task, nhưng bảng hiện chỉ có checkbox trạng thái, không có control sửa assignee. FR-03/AC-10 yêu cầu sửa assignee không đổi danh tính. Đề xuất control inline tối thiểu trên bảng task; không thêm màn hình quản lý người tham gia, không mở rộng chỉnh task/deadline khác.

## Điều kiện nghiệm thu, không chặn triển khai

- Cần bản ghi ngắn hai người có tự giới thiệu/gọi–đáp rõ và đáp án độc lập; mẫu dài chưa có ground truth danh tính.
- Cần key/quota hợp lệ để chạy AI thật. Không cần đọc hoặc lưu key trong planning.
- Việc phát hiện speaker bị trộn dựa trên mâu thuẫn trong nội dung, không cam kết phát hiện mọi lỗi diarization.
- Chưa có số đo độ chính xác; không hứa rằng prompt/validator xác minh được mọi tên đúng về ngữ nghĩa.
