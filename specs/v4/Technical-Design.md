# Technical Design — v4

Ngày: 2026-11-06. Trạng thái: Đề xuất sẵn sàng triển khai khi có yêu cầu; chưa được kiểm chứng runtime.
Nguồn: [PRD](PRD.md), [Requirement Findings](Requirement-Findings.md).

## Hướng giải pháp

Giữ hai bước hiện tại: `/api/process-meeting` tạo transcript, `/api/summarize-meeting` nhận `{ transcript, geminiApiKey }` và trả `{ status, summary, summaryError? }`. Baseline không thay endpoint/model/budget; phần notes bên dưới mở rộng request và giới hạn notes, không tăng lượt inference cho mỗi lần tạo summary. Tên được giải quyết trong summary; summary_failed/transcribed dùng fallback. Không thêm evidence schema hoặc lượt xác minh AI thứ hai.

Luồng: transcript gốc → summary AI với bảng tên → kiểm tra/chuẩn hóa bảng → chuẩn hóa lời tóm tắt → cập nhật một result → UI/copy/Markdown. JSON giữ transcript raw và bảng ánh xạ. Cache đã lưu → chuẩn hóa tương thích hẹp → validator hiện có → hiển thị, không gọi AI.

## Căn cứ hiện trạng

- `lib/types.ts`: raw speaker trên TranscriptSegment; bảng `{ speakerLabel, resolvedName: string | null }` thuộc MeetingSummary. Giữ schemaVersion 3; phần notes bổ sung field tùy chọn có fallback tương thích.
- `lib/meeting/gemini.ts`: `summarizeTranscript` đã gửi toàn transcript; `asSpeakerNames` bỏ nhãn lạ, bổ sung null nhưng entry trùng hiện ghi đè theo thứ tự. `applySpeakerNamesToSummary` chạy sau validation.
- `components/OutputPage.tsx`: filter dùng raw key, chart/transcript/task dùng displaySpeaker; retry gọi summary endpoint. `app/results/page.tsx:handleSummaryUpdate` thay summary/status trong một lần persist, giữ transcript.
- `app/results/page.tsx` và `components/MeetingWorkspace.tsx` đọc cache bằng `isStoredMeetingResult`. Memory result ưu tiên cache; cache là best effort.

## 1. Suy luận danh tính và giới hạn kiểm chứng

Bổ sung prompt hiện tại bằng ví dụ tiếng Việt: tự giới thiệu; gọi–đáp xác nhận duy nhất; gọi tên nhưng câu sau không liên quan; nhắc người thứ ba; mâu thuẫn/nhãn chứa nhiều người; tên xuất hiện muộn. Yêu cầu xét toàn cuộc họp, giữ dấu/tên nguyên gốc, không dùng đại từ hoặc chức vụ làm tên. Yêu cầu dùng raw Speaker N khi tham chiếu người nói trong các trường prose để server áp dụng bảng sau cùng; tên người thứ ba được giữ nguyên.

Không đổi nguyên tắc task: tự nhận việc dùng raw speaker key; giao đích danh dùng tên được nêu; không rõ dùng Unknown. Không dùng tên được nhắc trong task để đảo ngược thành speakerNames.

Chuẩn hóa bảng trên server: đúng một entry cho mỗi raw label trong transcript, theo thứ tự xuất hiện. Bỏ nhãn không tồn tại; thiếu/null/rỗng hoặc tên là placeholder Speaker N/Person N → null; trim khoảng trắng. Các entry cùng label có giá trị mâu thuẫn → null, không chọn entry cuối. Cùng label lặp lại cùng giá trị được hợp nhất. Hai label khác nhau cùng tên không tự gộp và không tự cho là sai.

Validator chỉ đảm bảo cấu trúc và quy tắc an toàn nêu trên. Tên thật nhưng gán nhầm vẫn có thể vượt validator; kiểm chứng ngữ nghĩa thuộc live acceptance với bằng chứng độc lập. Không dùng regex tìm tên trong transcript như bằng chứng nhận diện người nói.

## 2. Hiển thị thống nhất, giữ định danh

Dùng `lib/meeting/display.ts` làm nguồn chung: tên đã resolve; nếu trùng tên trong bảng thì `Alex (Person 1)`/`Alex (Person 2)`; unresolved → Person N. So sánh tên trùng sau trim, chuẩn hóa Unicode và bỏ khác biệt hoa/thường; không bỏ dấu hoặc suy đoán alias. Tên assignee tự do không được đổi thành speaker chỉ vì trùng tên.

Chuẩn hóa các tham chiếu Speaker N và Person N có raw key tương ứng trong prose về cùng tên hiển thị bằng một lượt thay thế; tránh thay một phần số hoặc chạy thay lặp trên chính chuỗi vừa tạo. Khi chuẩn hóa lại dữ liệu đã hiển thị, bảo vệ các chuỗi tên có hậu tố phân biệt hiện hành như `Alex (Person 1)` trước khi thay token rời, để không tạo hậu tố lồng nhau. Không thay từ riêng lẻ tên người thứ ba. Không sửa `TranscriptSegment.text`, `speaker`, startMs/endMs. Bản ghi cũ đã viết tên sai trong prose không tự chữa bằng thay chuỗi.

Áp dụng helper cho transcript, filter label (value vẫn raw key), speaking breakdown, option assignee, task label/avatar, copy và Markdown kể cả summary null. Không mở rộng các section Markdown chỉ để đồng bộ feature không liên quan. JSON/Copy JSON vẫn raw và có speakerNames khi summary tồn tại. Ask AI tiếp tục dùng normalizer hiện có; không mở API hay thêm danh tính vào request chat trong v4.

Sửa assignee inline trong bảng hiện có: lựa chọn raw speaker hoặc nhập tên tự do/Unknown; lưu qua callback action items hiện có. Chỉ cập nhật task được sửa, không cập nhật speakerNames. Không đổi tên toàn cuộc họp qua thao tác này.

## 3. Tương thích cache và trạng thái

Bổ sung bước parse/normalize dùng chung cho hai nơi đọc cache. Chỉ xét object schemaVersion 3; summary hợp lệ thiếu speakerNames được bổ sung đủ entry null dựa trên transcript. Bảng thiếu entry được điền null, nhãn dư bị loại, entry mâu thuẫn xử lý như server. Nếu field có kiểu sai hoặc các trường còn lại sai, vẫn từ chối; không nới validator thành chấp nhận object tùy ý. Chuẩn hóa xong mới trả MeetingResult đã validate. Không giả type guard chứng minh field đã tồn tại trước khi bổ sung.

Không cần rewrite cache ngay khi đọc, không tự AI migration và không phục hồi cache trước schema 3. Ánh xạ trong summary và prose đã có phải được dùng nhất quán tại boundary load; normalization phải idempotent. Mọi ghi tiếp theo dùng cơ chế persist hiện tại. Giữ nhánh memory khi cache ghi lỗi; không sửa lưu API key.

Retry trả summary cùng bảng tên trong một update; chính sách giữ summary cũ khi regenerate lỗi ở phần bổ sung bên dưới thay thế việc ghi đè bằng null. Transcript giữ nguyên; retry thất bại không sinh tên, không đổi no_speech thành có người nói. Không thêm trạng thái nghiệp vụ.

## Trade-off và điều kiện

Chọn cải thiện prompt + normalizer hiện có vì đáp ứng demo mà giữ contract. Prompt-only không giải quyết fallback/export/cache; pipeline nhận diện riêng tăng chi phí nhưng chưa có yêu cầu chứng minh cần thiết. Tên không có evidence được persist theo schema hiện tại; không có bảo đảm máy tự kiểm chứng đúng danh tính. Nếu live case không đạt, ghi rõ fail và điều chỉnh trong scope, không giảm AC hoặc thêm diarization âm thầm.

Không có quyết định kiến trúc còn chặn coding. Giới hạn tương thích schema 3 và UI inline là đề xuất được nêu rõ để review, không được ghi là quyết định người dùng đã duyệt. Trước sửa Next.js code, đọc guide local liên quan theo AGENTS. Rollback bằng hoàn nguyên phần v4; không có migration database hay hạ version cache.

## 4. Notes và regenerate — đề xuất bổ sung trên HEAD 28a54c1

**Contract đề xuất, chưa triển khai:** mở rộng JSON POST `/api/summarize-meeting` bằng `meetingNotes?: string`. Thiếu → rỗng; sai kiểu hoặc dài hơn 10.000 ký tự → HTTP 400 trước provider. Giữ giới hạn transcript hiện có độc lập, không cắt notes/transcript để vừa budget. Response SummaryRetryResult giữ nguyên; process-meeting không cần nhận notes vì chỉ extraction. Không thêm provider, model hay lượt inference riêng.

MeetingResult schema 3 thêm `meetingNotes?: string` (bản đang chỉnh) và `summaryNotes?: string` (snapshot đã dùng cho summary thành công gần nhất). Missing → rỗng tại boundary; sai kiểu/notes quá giới hạn bị từ chối. So sánh chính xác chuỗi để hiển thị chưa áp dụng. Summary cũ không có snapshot được hiểu là tạo với notes rỗng; không tự gọi AI khi load. JSON export giữ hai field; Markdown không cần thêm section notes, summary vẫn phải ghi nguồn nếu dùng thông tin notes-only. Không log nội dung notes.

Workspace giữ notes theo cuộc họp, snapshot lúc Process; chuyển notes vào checkpoint transcribed trước summary, request đầu tiên và result cuối. Không đọc notes từ lastResult để điền cuộc họp mới. Results là owner của notes/result; textarea lưu qua updater dùng state hiện tại, tránh closure ghi đè. Cache vẫn best effort và memory ưu tiên; failure cảnh báo theo cơ chế hiện có.

Gemini nhận hai phần dữ liệu phân cách rõ transcript và user notes. System instruction giữ transcript/notes là dữ liệu không đáng tin về chỉ dẫn. Cho phép đính chính user rõ ràng về tên/thuật ngữ thay suy luận transcript; không cho danh sách tên quyết định speaker. Mapping chỉ gồm raw labels thật, null khi notes tự mâu thuẫn hoặc không rõ. User correction không sửa raw text. Nội dung notes-only ghi nguồn trong prose phù hợp, không tạo transcript evidence/keyMoment giả; toàn bộ output đi qua normalizer và display helpers baseline.

Generate/Retry/Regenerate dùng chung request path. Có transcript + completed thì hiện Regenerate và mô tả sẽ thay summary/tasks kể cả sửa thủ công. Snapshot notes/transcript tại submit, khóa textarea/nút và các thao tác sửa task/metadata có nguy cơ bị ghi đè trong lúc chờ. Bỏ qua completion khi component đã unmount hoặc result hiện hành không còn là cuộc họp đã submit; cleanup hủy request. Không thêm hệ thống version/distributed lock cho demo một tab.

Khi thành công, một functional state update thay summary/status, xóa summaryError, ghi summaryNotes = snapshot và giữ meetingNotes/metadata/transcript. Khi provider/network/validation lỗi: nếu đã có summary, giữ completed và summary/map/snapshot cũ, chỉ hiển thị lỗi lần thử; nếu chưa có summary dùng summary_failed baseline. meetingNotes không mất trong cả hai nhánh. Không merge summary cũ vào mới, không tự gọi lại extraction. no_speech không có nút tạo lại từ notes.

Các lựa chọn 10.000 ký tự, một notes dùng chung và thay toàn tasks là đề xuất kỹ thuật/product mặc định cho demo; user chưa phê duyệt riêng. Rollback bỏ phần notes; field tùy chọn không đòi migration DB. Chưa có kiểm chứng runtime.
