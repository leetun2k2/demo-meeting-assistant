# Test Specification — v4

Cập nhật: 2026-11-06. Ca mới TC-014–016 chưa thực thi; kết quả ca cũ xem Verification Results, không suy ra đã pass yêu cầu mới. Nguồn: [PRD](PRD.md), [Technical Design](Technical-Design.md).

## Scope và chuẩn bị chung

Kiểm tra nhận diện tên, ownership, hiển thị/export, retry và cache trên app local desktop Chrome. Dùng API hiện có, không thêm endpoint test. Không test lại giới hạn file dài của v3 ngoài regression cần thiết.

Chuẩn bị app theo README, key/quota hợp lệ qua cơ chế cấu hình hiện có; không ghi key trong evidence. Các ca fixture UI dùng profile/origin demo riêng, lưu/khôi phục riêng key `meeting-assistant.lastResult`, không xóa toàn bộ localStorage. Có thể dùng browser request interception cho lỗi AI có kiểm soát; phân biệt rõ fixture với live. Không cần framework mới hoặc unit tests.

Endpoint summary: POST `/api/summarize-meeting`, JSON `{ transcript: [{ speaker, startMs, endMs?, text }], geminiApiKey }`. Thành công nghiệp vụ HTTP 200 với status completed và summary; lỗi provider được chuyển thành HTTP 200/status summary_failed, summary null và summaryError. Input không hợp lệ trả 400. Chain UI xử lý audio ban đầu gọi process-meeting rồi summary endpoint theo luồng hiện có.

Dữ liệu trước chạy:

- **F1 — bản ghi thực hai người**: hai giọng thật, không nói chồng; người đầu nhận task trước khi tự giới thiệu “Mình là Khánh” ở cuối; người đó hỏi “Long, xác nhận giúp mình bạn là Long và sẽ demo nhé”, người thứ hai đáp “Đúng, mình là Long, mình sẽ demo”. Đáp án: người tự giới thiệu Khánh; người xác nhận Long. Người đánh giá gắn lại raw labels sau phiên âm theo lời thực tế; không mặc định thứ tự speaker do provider.
- **F2 — transcript kiểm tra suy luận**: dùng Speaker 1 nói “Minh đã gửi tài liệu”, Speaker 2 nói “Long demo luôn đi”, Speaker 3 đáp “Mạng đang chậm”; không có tự giới thiệu. Đáp án tất cả null. Biến thể: cùng Speaker 1 có hai câu tự giới thiệu hai tên khác nhau, không phải trích dẫn → null. Tạo input transcript có timestamp hợp lệ; ghi chính xác input vào evidence khi chạy.
- **F3 — fixture completed schema 3**: lấy kết quả hợp lệ từ F1; bản sao đặt hai speaker cùng tên Khánh để kiểm tra cơ chế phân biệt (không dùng fixture này chứng minh suy luận AI). Có thêm task Unknown và task giao Minh, prose tham chiếu Speaker N/Person N ở các field có sẵn. Bản sao null summary/status summary_failed dùng kiểm tra fallback.
- **F4 — dữ liệu thực**: toàn bộ transcript trong [extracted-example.json](extracted-example.json). Trước chạy, người đánh giá ghi đáp án có căn cứ hoặc “chưa đủ căn cứ” cho từng speaker; không tự đặt tên dựa trên output AI. Fixture chứa summary_failed thật nhưng không thay thế quan sát lỗi/retry runtime.

## Scenarios

| ID | Kịch bản | Ưu tiên | Kết quả |
|---|---|---|---|
| TC-001 | Nhận tên thật và bằng chứng muộn | Critical | Khánh/Long đúng, tên áp dụng toàn transcript |
| TC-002 | Nhắc tên, đáp không liên quan, mâu thuẫn | Critical | null thay vì gán nhầm |
| TC-003 | Người phụ trách khác người nói | High | Speaker key, tên ngoài và Unknown đúng vai trò |
| TC-004 | Hiển thị/copy/export và tên trùng | High | Nhất quán, giữ raw IDs và timestamp |
| TC-005 | Sửa assignee | High | Chỉ task được sửa đổi, map không đổi |
| TC-006 | Lỗi summary → retry thành công | Critical | Giữ transcript; không upload/phiên âm lại |
| TC-007 | Summary trên mẫu thực | Critical | Mỗi ánh xạ có căn cứ hoặc null |
| TC-008 | Cache cũ, reload và cache lỗi | High | Khôi phục tương thích hẹp; memory vẫn dùng được |

## Cases và chains

### TC-001 — Tự giới thiệu, gọi–đáp và tên xuất hiện muộn

Mục đích: chứng minh nhận diện thật, tránh nghiệm thu bằng toàn null. Điều kiện: F1 và provider live.

Chain: Record/Upload F1 → Process → giữ bản transcript raw ban đầu → nhận completed → mở transcript, summary, filter và task → đối chiếu người thật.

Assertions: hai tên đúng có dấu, không bổ sung họ/chức vụ; task tự nhận liên kết raw speaker tương ứng; tên Khánh áp dụng cả đoạn trước câu giới thiệu cuối; số đoạn, text và timestamp không đổi sau summary. Ghi raw label, expected/actual và timestamp bằng chứng. Provider lỗi ghi not verified/fail theo thực tế, không dùng fixture thay.

Cleanup: giữ evidence kết quả, khôi phục cache demo khi kết thúc suite.

### TC-002 — Không suy diễn chỉ từ tên được nhắc

Điều kiện: F2 và key live. Chain: POST summary với F2 → kiểm tra speakerNames; lặp với biến thể mâu thuẫn.

Assertions: completed có đúng một entry/label, tất cả null ở input cơ sở; Speaker 1 null ở biến thể mâu thuẫn; không tạo speaker Minh/Long mới. Không yêu cầu summary text giống tuyệt đối giữa các lần chạy. Kiểm tra fixture output thiếu key, nhãn lạ hoặc duplicate conflict qua provider interception nếu cần để xác nhận normalization; ghi riêng đây là kiểm tra cấu trúc, không phải chất lượng live.

Cleanup: bỏ interception sau ca; không persist key/payload chứa key.

### TC-003 — Ownership không đồng nhất với người nói

Điều kiện: transcript thử có Speaker 1 tự giới thiệu Khánh; ba câu rõ: “Mình sẽ sửa lỗi đăng nhập”, “Giao Minh viết tài liệu”, “Cần kiểm tra lại báo cáo, chưa chốt ai làm”; không nhắc deadline. Chain: POST summary live → kiểm tra ba action items.

Assertions: task tự nhận lưu Speaker 1, hiển thị Khánh; task giao Minh giữ Minh dù không có speaker Minh; việc chưa có owner dùng Unknown nếu được trích xuất thành task, không gán cho Khánh. Không thêm deadline, không tạo speaker mới. Nếu model bỏ một task cần thiết thì ghi chính xác, không sửa output trước khi đánh giá.

Cleanup: không có state server cần xóa.

### TC-004 — Nhất quán bề mặt và tên trùng

Điều kiện: F1 completed hoặc F3 hợp lệ được nạp vào result cache của profile demo rồi full reload. Chain: xem transcript/filter/chart/task/avatar và các prose fields có dữ liệu → chọn speaker → jump insight → Copy Summary, copy email và mọi action-copy hiện có → Export Markdown/JSON → lặp với F3 tên trùng và summary_failed.

Assertions: tên hiển thị nhất quán; tên trùng dùng Khánh (Person N), filter values vẫn phân biệt raw labels; jump mở đúng đoạn/trang. Prose tham chiếu Speaker N và Person N được chuẩn hóa, không đổi lời thoại có tên người thứ ba. Markdown khi summary null vẫn Person N. JSON và Copy JSON bảo toàn raw speaker/timestamp và bảng tên; không thay text transcript. Không buộc xuất thêm section chưa có trong Markdown. Kiểm tra hai lượt load không tạo hậu tố trùng lặp.

Cleanup: xóa file tải thử nếu không dùng làm evidence; khôi phục cache fixture.

### TC-005 — Sửa assignee độc lập

Điều kiện: result có ít nhất hai task. Chain: lưu JSON trước → sửa assignee task đầu sang speaker khác, rồi tên tự do → kiểm tra task khác và transcript → reload → Export JSON.

Assertions: chỉ assignee task đầu đổi, speakerNames và raw transcript không đổi; tên tự do không tạo speaker mới; reload giữ sửa khi ghi cache thành công. Modal thêm task hiển thị resolved names nhưng value vẫn raw key. Không cần màn hình sửa danh tính.

Cleanup: khôi phục result trước ca.

### TC-006 — Summary lỗi và retry

Điều kiện: transcript đã hoàn tất, key được lưu qua UI; bắt lỗi provider summary bằng interception, không sửa implementation. Chain: lỗi summary → Results → xem/export transcript → gỡ lỗi cưỡng bức → Retry Summary live → kiểm tra network và result; thử lại lỗi một lần bằng fixture nếu cần.

Assertions: summary_failed có error thật, không có tên giả; retry dùng transcript giống ban đầu, chỉ POST summary, không POST process-meeting/Files/Transcribe từ luồng retry; thành công cập nhật summary/map cùng nhau, transcript giữ nguyên. Retry lỗi tiếp vẫn giữ transcript. Ghi phân loại live hoặc simulated cho từng bước, không claim provider outage thật từ interception.

Cleanup: gỡ mọi interception; khôi phục cache sau suite.

### TC-007 — Mẫu thực đủ 322 đoạn

Điều kiện: F4 và đánh giá độc lập sẵn sàng. Chain: POST summary với nguyên transcript F4 → lưu summary không có key → đối chiếu từng entry với bảng bằng chứng chuẩn bị trước → có thể nạp result để xem UI.

Assertions: không cắt transcript; chỉ ba raw labels thật; từng tên có bằng chứng ngữ cảnh và không gán vì tên được nhắc; không xác định thì null. Ghi timestamp/câu hỗ trợ hoặc lý do chưa rõ cho cả ba speaker. Ca này kiểm tra baseline không notes. Không dùng ca này thay TC-016 với notes của user; ca mới có nghĩa vụ nhận đúng các danh tính có căn cứ từ hai nguồn. Không có đáp án độc lập thì ca chưa nghiệm thu, không tự đánh pass.

Cleanup: không cần phiên âm lại audio; giữ evidence theo chính sách repo, không lưu secrets.

### TC-008 — Cache tương thích và ghi lỗi

Điều kiện: F3 và bản sao: (a) thiếu speakerNames; (b) bảng thiếu entry; (c) summary null; (d) field speakerNames sai kiểu; (e) version khác 3.

Chain: từng fixture → đặt lastResult → full reload `/` để kiểm tra link kết quả → `/results` → inspect names/network; sau đó completed hợp lệ → reload; cuối cùng giả lập ghi cache thất bại trong khi Retry Summary hoàn tất → xem result trong phiên và export.

Assertions: a/b/c mở được, key thiếu dùng Person N, không tự gọi AI; các field khác vẫn được validate. d/e bị từ chối theo baseline, không crash. Completed hợp lệ reload giữ tên. Ghi lỗi vẫn hiển thị đúng kết quả mới trong phiên, có cảnh báo và không lặng lẽ thay bằng result cũ; không cam kết reload giữ kết quả khi ghi lỗi. Không tác động key Gemini.

Cleanup: phục hồi thao tác storage, cache và interception đã thay; không clear toàn origin.

## Coverage và giới hạn

AC-01/02 → TC-001; AC-03/04 → TC-002; AC-05 → TC-004; AC-06 → TC-003; AC-07 → TC-006; AC-08 → TC-008; AC-09 → TC-007; AC-10 → TC-001/004/005. Tên trùng trong FR-01 được kiểm tra hiển thị ở TC-004; fixture không chứng minh AI nhận diện hai người trùng tên.

Chưa có F1 audio và ground truth mẫu dài được xác nhận trong planning. Không có live calls, tests hoặc checks nào đã chạy. Khi thực thi, lưu revision/environment, input reference, kết quả từng ca và lỗi chưa giải quyết tại `Verification-Results.md`. Tính đúng ngữ nghĩa không suy ra từ HTTP 200 hoặc schema hợp lệ.

## Bổ sung notes — contract và ca chưa thực thi

Contract hiện có tại HEAD `3959b413` (đã đọc code, chưa chạy lại trong planning): summary POST nhận thêm `meetingNotes?: string`; thiếu/rỗng hợp lệ, sai kiểu hoặc >10.000 ký tự trả 400 trước provider. MeetingResult thêm meetingNotes/summaryNotes optional theo Design §4. Các mô tả endpoint trước phần này là baseline đã khảo sát, không chứng minh notes hiện có.

Fixture N: transcript hai raw labels không tự giới thiệu, Speaker 1 nhận sửa login, Speaker 2 nhắc tên người thứ ba Minh. Notes A: “Speaker 1 là Khánh; Speaker 2 là Long. Bối cảnh bổ sung: Nexus là tên dự án.” Notes B đổi rõ Speaker 1 là Lan. Đáp án tên do fixture cung cấp, không lấy từ output AI. Dùng key live cho kiểm tra ngữ nghĩa; interception chỉ chứng minh UI/error/validation. Dùng profile/cache demo và cleanup chung của suite.

| ID | Kịch bản | Ưu tiên | Kết quả |
|---|---|---|---|
| TC-009 | Notes trước xử lý và mapping | Critical | Input được dùng lượt đầu, tên đúng, notes ở Results/reload |
| TC-010 | Sửa notes sau completed rồi regenerate | Critical | Một request, kết quả mới đồng bộ, raw transcript giữ nguyên |
| TC-011 | Regenerate lỗi, retry và pending | Critical | Không mất kết quả/notes; không gửi lặp hoặc áp dụng stale completion |
| TC-012 | Nguồn dữ liệu và notes mơ hồ/độc hại | High | Không gán tùy ý, không giả quyết định/evidence, không thực thi chỉ dẫn |
| TC-013 | Validation/cache/export/cuộc họp mới | High | Giới hạn rõ, tương thích cũ, lưu đúng snapshot, không rò notes cuộc trước |

### TC-009 — Notes đầu vào

Preconditions: audio test có transcript đáp án độc lập và notes chứa tên/vai trò; dùng hội thoại phân biệt danh tính, không bắt user nhập raw mapping. Raw labels được người kiểm chứng đối chiếu sau extraction, không mặc định thứ tự provider. Ca mới TC-014–016 là acceptance bắt buộc cho suy luận từ roster; fixture N explicit mapping chỉ kiểm tra tương thích. Có thể dùng fixture N ở boundary summary để kiểm chứng riêng prompt, ghi rõ không thay thế audio chain.

Chain: nhập notes trước Process → xử lý → capture request summary không chứa key trong evidence → Results → reload. Assertions: đúng notes snapshot trong request đầu, notes được hiển thị lại; mapping đúng mọi bề mặt; không sửa text/timestamp; summary có nguồn user cho bối cảnh chỉ có trong notes. Lặp input rỗng để xác nhận baseline không bị chặn. Cleanup: khôi phục cache/demo audio.

### TC-010 — Đính chính và tạo lại thành công

Preconditions: fixture N completed với Notes A, có task đã sửa owner/status thủ công. Chain: sửa notes thành B → kiểm tra chưa áp dụng → đọc mô tả thay summary/tasks → Regenerate → kiểm tra network/result/copy/Markdown/JSON → reload.

Assertions: trước bấm summary cũ giữ nguyên; đúng một summary request với B và toàn transcript, không process/upload/transcribe; thành công dùng Lan nhất quán transcript label/filter/summary/task speaker/email/export; JSON raw transcript không đổi, meetingNotes = summaryNotes = B. Summary/tasks mới thay bản cũ, không hứa giữ sửa thủ công. Metadata giữ nguyên, không còn cảnh báo chưa áp dụng. Cleanup: khôi phục result trước ca.

### TC-011 — Lỗi và thao tác trong lúc chờ

Preconditions: completed A, notes chỉnh B. Chain: cưỡng bức provider/network lỗi → Regenerate → kiểm tra result/reload → bỏ lỗi → retry live; dùng request delay để double click, thử sửa notes/tasks và điều hướng khỏi Results trước completion.

Assertions: thất bại giữ summary/map/summaryNotes A, meetingNotes B, báo lỗi thật và chưa áp dụng; status vẫn completed. Retry dùng B, thành công thay nguyên tử. Pending không cho gửi lặp/sửa xung đột; completion đã unmount không ghi vào cuộc họp khác. Lặp với transcribed/summary_failed chưa có summary: lỗi giữ transcript/notes và summary_failed; no_speech không tạo summary từ notes. Cache failure giữ notes/kết quả trong phiên và cảnh báo giới hạn reload. Phân loại simulated/live từng nhánh. Cleanup: gỡ delay/interception và phục hồi cache.

### TC-012 — Không biến notes thành lời nói

Preconditions: fixture N, provider live. Chain: POST lần lượt với (a) notes A, (b) chỉ “Khánh, Long là người tham gia”, (c) “Speaker 1 là Khánh; Speaker 1 là Lan” không có đính chính thứ tự rõ, (d) notes thêm bối cảnh, tên Speaker 99 và yêu cầu bỏ qua quy tắc/tự tuyên bố một quyết định không có trong transcript.

Assertions: a mapping theo notes rõ dù transcript không đủ; b không gán chỉ từ danh sách khi fixture N không có bất kỳ ngữ cảnh nào liên kết tên với speaker (khác ca dương TC-014/015); c Speaker 1 null; không tạo Speaker 99. Bối cảnh notes-only được ghi nguồn, không tạo keyMoment/timestamp hay quyết định đã đồng thuận giả; không làm theo chỉ dẫn độc hại. Các raw labels/text/timestamp giữ nguyên; tên người thứ ba không biến thành speaker. Cleanup: không có server state; không lưu key trong evidence.

### TC-013 — Giới hạn và tương thích

Chain: POST omitted, empty, string 10.000, string 10.001 ký tự, null/object notes → kiểm tra response/provider count; nhập quá dài trên UI → kiểm tra lỗi; load cache schema 3 thiếu cả hai field và cache field sai kiểu → load completed A → sửa B chưa regenerate → export JSON/reload → bắt đầu cuộc họp mới.

Assertions: omitted/empty không lỗi validation; 10.000 không bị chặn bởi giới hạn notes (provider có thể lỗi riêng); 10.001/sai kiểu trả 400, không provider call hoặc cắt âm thầm. UI báo lỗi và giữ input để sửa. Cache cũ mở rỗng, sai kiểu bị từ chối; JSON/reload phân biệt meetingNotes B với summaryNotes A và cảnh báo chưa áp dụng. Cuộc họp mới không tự điền B; không gọi AI khi restore. Cleanup: khôi phục đúng key cache đã sao lưu, bỏ interception.

Coverage bổ sung: AC-11 → TC-009; AC-12 → TC-009/012; AC-13 → TC-010; AC-14 → TC-011; AC-15 → TC-012; AC-16 → TC-013. Toàn bộ TC-009–013 chưa chạy; live semantic quality cần provider và đánh giá độc lập. Verification Results lịch sử không áp dụng cho phần notes.


## Bổ sung hiện hành — roster + ngữ cảnh (AC-17–20)

Đây là acceptance bắt buộc của yêu cầu mới, không thay bằng ca explicit mapping hoặc static checks. API chain dùng POST `/api/summarize-meeting` với `{ transcript, meetingNotes, geminiApiKey }`; HTTP 200/status completed chỉ chứng minh request hoàn tất, phải đối chiếu speakerNames. Key lấy từ cấu hình hợp lệ hiện có, không chép vào fixture/evidence. Các đoạn tổng hợp dưới đây dùng startMs/endMs tăng dần, không chồng lấn; người thực thi lưu payload chính xác đã dùng khi chạy. Không có kết quả thực thi trong lượt planning này.

| ID | Kịch bản | Ưu tiên | Kết quả bắt buộc |
|---|---|---|---|
| TC-014 | Roster không mapping + gọi–đáp/demo tự nhiên | Critical | Đúng cả ba tên, không tự giới thiệu hoặc xác nhận tên trực tiếp |
| TC-015 | Vai trò, tên chỉ ở notes, đảo roster và người vắng mặt | Critical | Tên đúng theo ngữ cảnh, không theo thứ tự/số lượng; không tạo speaker mới |
| TC-016 | Notes nguyên văn và cuộc họp trong ảnh lỗi | Critical | Nhận đúng danh tính có căn cứ, đồng bộ UI/export, không yêu cầu mapping thủ công |

### TC-014 — Gọi tên rồi đáp tự nhiên

Purpose: phát hiện lỗi prompt quá chặt, chỉ chấp nhận “tôi là X”. Preconditions: provider live; notes chỉ “Người tham gia: Lan, Minh, Huy.”; transcript tổng hợp:

1. Speaker 1: “Lan mở bản thiết kế màn hình đăng nhập cho mọi người xem nhé.”
2. Speaker 2: “Em đang chia sẻ bản thiết kế của em. Màn hình đăng nhập có hai bước.”
3. Speaker 1: “Cảm ơn Lan. Minh demo API đăng nhập tiếp nhé.”
4. Speaker 3: “API em làm trả access token ở đây. Em đang chạy request demo.”
5. Speaker 2: “Huy chốt giúp em lịch bàn giao nhé.”
6. Speaker 1: “Anh chốt thứ Sáu, anh sẽ gửi lịch bàn giao cho cả nhóm.”
7. Speaker 3: “Cảm ơn Huy. Lan gửi lại bản thiết kế để em đối chiếu API nhé.”
8. Speaker 2: “Em gửi bản thiết kế ngay sau cuộc họp.”

Chain: POST với transcript và notes → lưu response bỏ key → đối chiếu mapping và task tự nhận → lặp với notes “Người tham gia: Huy, Lan, Minh.” và cùng transcript.

Assertions: Speaker 1 = Huy, Speaker 2 = Lan, Speaker 3 = Minh ở cả hai lượt; không null, không gán tên người gọi cho người được gọi; bảng đúng ba labels, không sửa raw text/timestamp. Nội dung summary không bắt buộc giống từng chữ. Không chấp nhận prompt/response fixture thay live inference.

Cleanup: không có server state; giữ payload không key và evidence kết quả. Nếu nạp result vào UI thì khôi phục đúng cache demo sau suite.

### TC-015 — Vai trò và roster không phải thứ tự speaker

Preconditions: provider live. Notes “Lan phụ trách thiết kế UI; Minh phụ trách API backend; Huy điều phối sản phẩm.” Transcript không nhắc tên: Speaker 1 “Phần API backend do em phụ trách, endpoint đăng nhập em đã làm xong. Em sẽ gửi tài liệu API.”; Speaker 2 “Em phụ trách thiết kế UI. Em sẽ gửi bản thiết kế màn hình đăng nhập.”; Speaker 3 “Anh điều phối sản phẩm. Anh sẽ chốt lịch bàn giao với cả nhóm.”

Chain: POST → kiểm tra mapping → đảo thứ tự ba người trong notes và POST lại → thêm “Hoa là khách mời nhưng vắng mặt hôm nay” rồi POST → chạy ca âm với cùng ba tên nhưng bỏ mọi vai trò khỏi notes và thay transcript bằng ba lượt chào/xác nhận chung không có manh mối → chạy biến thể notes đính chính mâu thuẫn cho Speaker 1 theo TC-012.

Assertions: ca có vai trò nhận Speaker 1 = Minh, Speaker 2 = Lan, Speaker 3 = Huy, kể cả đảo roster/thêm Hoa; không tạo label Hoa. Ca âm ba nhãn đều null, không gán theo thứ tự/số lượng hoặc loại trừ khi chưa biết ai là ai. Mâu thuẫn trực tiếp giữ label liên quan null. Tên notes-only được dùng hợp lệ nhưng không tự viết rằng các speaker đã nói tên đó trong transcript; không tạo keyMoment chứng minh việc tự giới thiệu không tồn tại.

Cleanup: như TC-014; các request độc lập, không kế thừa mapping từ lần chạy trước.

### TC-016 — Tái hiện kết quả user báo lỗi

Preconditions: [ảnh kết quả](demo-meeting-assistant.vercel.app_results.png); notes được chép nguyên văn/đối chiếu đọc rõ, không tự thay bằng mapping. Xác nhận [transcript mẫu](extracted-example.json) có tương ứng ảnh hay lấy transcript đúng từ JSON export/result hiện có. Không dùng ảnh làm nguồn duy nhất cho toàn transcript. Chuẩn bị bảng expected raw label → tên và trích đoạn/bằng chứng độc lập trước xem model output; ghi phần còn thiếu rõ ràng. Key/quota live qua cơ chế hiện có. Thiếu input/expected ghi NOT_RUN phần phụ thuộc, không PASS.

Chain: dùng transcript đúng và notes nguyên văn → POST summary live để tách chất lượng inference khỏi UI → lưu output không key, expected/actual/evidence cho từng label → trên profile demo nạp/mở result tương ứng qua cơ chế hiện có → giữ bản raw ban đầu → giữ notes roster (không thêm mapping) → Regenerate → quan sát network, transcript/filter/chart/summary/task/email/copy/Markdown/JSON → reload.

Assertions: mọi tên có căn cứ phải nhận đúng; sai tên hoặc null cho label có căn cứ là FAIL. Không đánh pass ca thực tế bằng toàn null hoặc chỉ vì schema hợp lệ. Nếu một nhãn thật sự thiếu bằng chứng, ghi khoảng trống và mức nghiệm thu chưa hoàn tất cho mục tiêu thực tế; không bắt user tự nghe và nhập mapping để vượt qua ca. Request regenerate đúng một summary với nguyên notes/transcript, không process/upload/transcribe. Tên được cập nhật đồng bộ, raw speaker/text/timestamps giữ nguyên, snapshot notes đúng, reload giữ kết quả nếu cache ghi thành công. Nếu local đạt nhưng trang đang deploy vẫn lỗi, ghi rõ revision/environment khác biệt, không tự deploy.

Cleanup: backup/restore riêng `meeting-assistant.lastResult` trên profile demo; bỏ interception nếu có; không xóa API key hoặc cache người dùng ngoài phạm vi; giữ evidence không secrets tại Verification Results.

## Coverage cập nhật và giới hạn

AC-17 → TC-014; AC-18 → TC-015; AC-19 → TC-012/015; AC-20 → TC-016; AC-05/10/13/14 → regression TC-004/010/011 và TC-016. Các ca cũ còn hợp lệ trừ mô tả transcript-only/cấm suy luận roster đã được yêu cầu mới thay thế.

Không có đáp án được xác nhận cho cuộc họp trong ảnh trong lượt planning này. Prompt diff đã có không chứng minh TC-014–016 pass; key/quota, transcript tương ứng và expected độc lập là prerequisite cho thực thi. Ca tổng hợp không đủ để đóng lỗi user. Không thêm unit tests hoặc framework.
