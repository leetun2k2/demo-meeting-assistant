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

## Bổ sung notes — khảo sát HEAD 28a54c1a617d4e16227ca9298fe42f76172a3b96

Yêu cầu user ngày 2026-11-06: notes trước xử lý và sau khi xem kết quả, kết hợp extracted data để brief và sửa tên, tạo lại summary khi chưa đúng. Đủ rõ để planning, không có câu hỏi sản phẩm chặn công việc.

- Baseline hiện tại đã có helper `speakerNames.ts`, `cacheCompat.ts`, inline assignee và luồng retry. Các phát hiện ở trên là khảo sát revision cũ, không phải danh sách code chắc chắn còn thiếu. `Verification-Results.md` là evidence lịch sử NOT_READY, vẫn còn prerequisite/defect cần đối chiếu khi triển khai, không được ghi thành đã đạt.
- `MeetingResult` chưa có notes; workspace gửi chỉ transcript/key; summary route chưa nhận notes; Results handler hiện thay summary kể cả khi retry lỗi. Không thể chỉ thêm textarea: cần truyền, persist, validation, prompt và semantics giữ kết quả cũ.
- Yêu cầu mới thay giới hạn transcript-only và loại trừ nhập tên trước của PRD cũ. Notes có thể cung cấp danh tính nhưng chỉ danh sách tên không xác định được raw speaker. Đính chính rõ ưu tiên hơn suy luận; notes tự mâu thuẫn giữ null.
- Đề xuất một notes được chỉnh ở hai vị trí, không tạo preNotes/postNotes riêng. “Chat” hiểu là transcript; Ask AI vẫn ngoài phạm vi. Notes-only context phải phân biệt với quyết định thực trong cuộc họp.
- Regenerate thay toàn summary sẽ mất sửa task thủ công; đề xuất nêu rõ ngay cạnh nút thay vì thêm cơ chế merge không được yêu cầu. Kết quả cũ phải sống sót nếu regenerate lỗi.
- Planning không chạy kiểm thử hoặc AI; điều kiện live acceptance và các ca chưa xác minh trước đây vẫn giữ nguyên.
