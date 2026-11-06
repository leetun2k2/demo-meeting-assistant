# Technical Design — v4

Cập nhật: 2026-11-06. Đề xuất kỹ thuật cho yêu cầu mới; chưa chứng minh chất lượng live. Nguồn: [PRD](PRD.md), [Findings](Requirement-Findings.md). Khảo sát HEAD `3959b413d02d9fcc364cfcc02a4f304bb345c7fe` + diff hiện có.

## Hướng giải pháp

Giữ pipeline extraction → summary. Trong một lượt summary AI, dùng toàn transcript và notes làm hai nguồn phân biệt để suy luận danh tính cùng lúc tạo summary. Không đòi user tự gán nhãn, không thêm lượt inference hoặc thay provider/model mặc định. Đây là hướng đề xuất để kiểm chứng, không phải bảo đảm prompt đủ cho mọi cuộc họp.

## Hiện trạng đã đọc

- `app/api/summarize-meeting/route.ts`: POST nhận transcript, geminiApiKey và optional meetingNotes; kiểm tra notes trước gọi provider. `lib/constants.ts` giữ giới hạn notes 10.000 ký tự và transcript 200.000 ký tự.
- `lib/meeting/gemini.ts`: gửi system instruction và toàn transcript + notes tới Gemini, nhận structured summary, chuẩn hóa qua `buildSpeakerNameTable` rồi `applySpeakerNamesToSummary`. Working diff từ lượt trước đã cho suy luận roster + hội thoại; chưa live acceptance.
- `components/MeetingWorkspace.tsx` giữ notes snapshot cho lần đầu; `components/OutputPage.tsx:handleGenerateSummary` gửi notes snapshot cho Generate/Retry/Regenerate. `app/results/page.tsx:handleSummaryUpdate` giữ summary cũ khi regenerate lỗi, cập nhật summary/map/snapshot cùng kết quả khi thành công.
- `lib/meeting/display.ts`, `speakerNames.ts`, `cacheCompat.ts`, `storedResult.ts` cung cấp mapping, fallback và cache schema 3. Cache compat hiện chỉ chuẩn hóa bảng tên; finding lịch sử về prose restore cần đối chiếu khi review, không coi đã sửa.

## 1. Suy luận danh tính bằng hai nguồn

Transcript là bằng chứng về lời nói/thời gian; notes cung cấp tên ứng viên, vai trò, mối quan hệ, bối cảnh và đính chính. Tên có thể chỉ xuất hiện trong notes. System instruction phải nhất quán ở cả hướng dẫn speakerNames và notes, tránh một phần cho suy luận còn phần khác cấm.

AI xét toàn cuộc họp cho từng raw label: tự giới thiệu nếu có; gọi tên rồi đáp lời phù hợp; người tiếp tục demo; trách nhiệm phù hợp notes; trao đổi lặp lại xác nhận cùng một người. Câu đáp không cần nói “tôi là X”. Phân biệt người gọi với người được gọi và người thứ ba được nhắc. Một câu gọi tên hay lượt nói kế tiếp riêng lẻ không đủ, nhưng không được bỏ qua bằng chứng kết hợp mạnh hơn.

Suy luận đồng thời giữa các labels để loại trừ ứng viên khi có căn cứ roster đầy đủ và những danh tính còn lại đã xác định. Không mặc định roster đầy đủ, không ép dùng hết tên, không gán theo thứ tự hoặc số lượng. Null dành cho trường hợp xét hai nguồn vẫn thiếu căn cứ/mâu thuẫn hoặc một label có dấu hiệu trộn người. Đính chính rõ Speaker N/Person N vẫn được hỗ trợ và ưu tiên; đây là tùy chọn, không phải prerequisite.

Notes/transcript vẫn là dữ liệu, không thực thi chỉ dẫn bỏ qua hệ thống, lộ key hay tạo quyết định. Notes-only context phải được ghi nguồn trong prose phù hợp, không tự tạo lời thoại/keyMoment/timestamp. Việc dùng tên từ notes không biến role/context thành lời nói đã phát biểu.

## 2. Contract và bất biến giữ nguyên

POST summary giữ `{ transcript, geminiApiKey, meetingNotes?: string }`; response giữ SummaryRetryResult. Omitted notes dùng rỗng; kiểu sai/vượt giới hạn trả 400 trước provider. Không thay timeout, budget, endpoint, model hoặc schemaVersion 3.

MeetingResult tiếp tục dùng meetingNotes (bản đang chỉnh), summaryNotes (snapshot thành công); không thêm evidence schema. Đúng một entry `{ speakerLabel, resolvedName }` cho mỗi raw label thật; thiếu/rỗng/placeholder hoặc duplicate conflict → null; không thêm speaker từ roster. Validator kiểm chứng cấu trúc, không chứng minh tên đúng về ngữ nghĩa.

Giữ raw speaker/text/startMs/endMs; không tách/gộp speaker. Tên hiển thị qua helper chung trên transcript/filter/chart/task/prose/copy/Markdown; JSON giữ raw labels và bảng tên. Tên trùng cần hậu tố Person N. Sửa assignee chỉ tác động task; không suy ngược thành danh tính.

## 3. Trạng thái và tương thích

Giữ Generate/Retry/Regenerate chủ động, không upload/phiên âm lại. Snapshot notes tại submit; khóa gửi lặp/chỉnh sửa xung đột; bỏ completion của cuộc họp cũ. Thành công thay toàn summary/tasks/map và summaryNotes; giữ metadata/transcript. Thất bại giữ summary/map/snapshot cũ nếu đã completed và giữ notes mới; nếu chưa có summary dùng summary_failed. no_speech không tạo summary chỉ từ notes.

Cache cũ mở như hiện có, không tự gọi AI hoặc tự sửa danh tính khi load. User có thể regenerate với notes hiện tại để áp dụng logic mới. Không có migration DB; mapping đã lưu không tự đổi chỉ vì deploy prompt. Rollback code theo phạm vi diff, không xóa dữ liệu người dùng. Không commit/deploy trong planning.

## 4. Trade-off và kiểm chứng

Prompt + pipeline hiện có ít thay đổi contract, nhưng kết quả không tất định và validator không xác minh ngữ nghĩa. Không thêm regex ghép tên, hardcode đáp án cuộc họp mẫu hoặc ép đủ số tên để làm mất Person N.

Đánh giá bằng ca dương roster + đáp lời/demo, vai trò/tên chỉ có trong notes, đổi thứ tự danh sách, ca âm/mâu thuẫn và chính cuộc họp user báo lỗi. Tất cả-null trên ca dương là fail. Kiểm chứng song song output tên và bảo toàn raw data, regenerate/reload/export. Static checks không thay live inference.

Chưa có blocker kiến trúc cho triển khai trong phạm vi này. Nghiệm thu thực tế phụ thuộc notes nguyên văn, transcript tương ứng, key/quota và đáp án độc lập. Nếu ca thực tế fail, phân loại do extraction/diarization, ngữ cảnh, prompt, phiên bản deploy hoặc UI/cache trước khi sửa tiếp; không đổi tiêu chí hoặc mở pipeline âm thầm. Ask AI giữ ngoài phạm vi mở rộng.
