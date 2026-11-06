# PRD v4 — Notes bổ sung, brief và tên người tham gia

Ngày: 2026-11-06  
Trạng thái: Cập nhật suy luận danh tính từ notes và hội thoại ngày 2026-11-06; baseline notes/regenerate đã có code, yêu cầu nhận diện mới chưa được nghiệm thu live.
Phạm vi: Kết hợp transcript extracted với notes người dùng để brief cuộc họp, xác định đúng tên và tạo lại summary khi cần.

## Yêu cầu cập nhật — suy luận danh tính từ notes và hội thoại (2026-11-06)

Yêu cầu trực tiếp mới nhất của user thay thế các điều kiện cũ bên dưới nếu xung đột: hệ thống phải chủ động kết hợp danh sách người tham gia trong notes với toàn bộ hội thoại để xác định tên. Không yêu cầu người dùng nghe lại rồi gán Person/Speaker N. Câu đáp tự nhiên, người tiếp tục demo và vai trò phù hợp là bằng chứng hợp lệ; không bắt buộc tự giới thiệu hay nhắc lại tên trong câu đáp. Tên có thể chỉ xuất hiện trong notes. Không ghép theo thứ tự danh sách hoặc số lượng; chỉ giữ nhãn trung lập khi xét cả hai nguồn vẫn chưa đủ căn cứ hoặc mâu thuẫn.

Nghiệm thu: notes chỉ chứa tên/vai trò + transcript có gọi tên/đáp lời/demo phải tạo bảng tên tương ứng, áp dụng nhất quán lên kết quả. Danh sách không có bất kỳ ngữ cảnh phân biệt nào không được tự gán theo thứ tự. Regenerate dùng transcript hiện có và notes mới nhất.

## 1. Mục tiêu

Khi hội thoại có đủ căn cứ xác định người nói, ứng dụng hiển thị tên của người đó thay cho “Person N”. Tên được dùng nhất quán trong transcript, bộ lọc người nói, bản tóm tắt, action items và nội dung xuất ra.

**Ưu tiên tên có căn cứ, không ép mọi speaker phải có tên.** Khi chưa xác định được, giữ “Person N”. Demo cần chứng minh cả hai trường hợp: nhận ra tên đúng và không gán nhầm tên chỉ vì tên đó xuất hiện trong cuộc họp.

V4 bổ sung yêu cầu chất lượng danh tính trên nền [PRD v3](../v3/PRD.md). Giới hạn audio, tiến trình, lưu kết quả và retry giữ theo baseline hiện có; không phải hạng mục mở rộng của v4.

## 2. Bối cảnh và bằng chứng

- [Dữ liệu mẫu](extracted-example.json) có 322 đoạn transcript, ba nhãn `Speaker 1`, `Speaker 2`, `Speaker 3`; metadata audio khoảng 32 phút. Hội thoại nhắc đến Khánh, Long, Dũng và Sỹ.
- Mẫu có trạng thái `summary_failed`, `summary: null`, kèm lỗi nhà cung cấp 503. Mẫu dùng để phân tích hội thoại và kiểm tra retry; **không chứng minh chức năng nhận diện tên hiện tại đã chạy sai hoặc đã thành công**.
- Số tên được nhắc không đồng nghĩa số người nói. Một tên có thể thuộc người được nhắc tới hoặc người không phát biểu. Một nhãn diarization cũng có thể chứa lời nhiều người nếu phiên âm phân tách sai.
- Code đã có bảng `speakerNames`, quy tắc nhận diện từ tự giới thiệu/ngữ cảnh đáp lời, và cơ chế đổi nhãn thành tên khi hiển thị. V4 làm rõ hành vi cần đạt; không mặc định phải xây pipeline mới.

Không dùng file mẫu làm bảng đáp án danh tính. Trước nghiệm thu, người đánh giá cần xác nhận các ánh xạ có thể kết luận và đánh dấu trường hợp chưa đủ căn cứ.

## 3. Phạm vi demo

| Hạng mục | Quyết định |
|---|---|
| Môi trường | Demo local trên desktop Chrome, một người dùng, một cuộc họp mỗi lượt |
| Đầu vào | Transcript do luồng phiên âm hiện có tạo ra; ưu tiên hội thoại tiếng Việt có xen thuật ngữ tiếng Anh |
| Nguồn xác định tên | Toàn hội thoại kết hợp danh sách tên/vai trò/bối cảnh trong notes; không yêu cầu mapping thủ công |
| Kết quả chính | Tên có căn cứ thay cho “Person N”; người chưa rõ tên vẫn có nhãn ổn định |
| Cách thực hiện | Tận dụng bước tạo summary và bảng ánh xạ hiện có; không yêu cầu thêm lượt gọi AI riêng |
| Retry / regenerate | Dùng transcript đang có + notes mới nhất để tạo lại cả summary và bảng tên, kể cả khi summary trước đã thành công; không phiên âm lại |
| Dữ liệu cũ | Kết quả đã lưu vẫn mở được; không bắt buộc tự phân tích lại khi tải trang |
| Ưu tiên | Toàn bộ yêu cầu và AC dưới đây là P0; không có hạng mục mở rộng chặn demo |

### Ngoài phạm vi

- Nhận diện bằng giọng nói/sinh trắc học, hồ sơ người dùng, danh bạ hoặc danh sách nhân sự bên ngoài.
- Màn hình quản lý/gán danh tính riêng hoặc quản lý danh tính qua nhiều cuộc họp. Notes chứa tên/vai trò được dùng làm ứng viên để suy luận qua hội thoại; không ghép tên theo thứ tự danh sách.
- Sửa diarization, tách/gộp speaker hoặc suy đoán ai đang nói bằng audio trong bước summary.
- Hiển thị điểm tin cậy, bảng giải thích danh tính hoặc evidence viewer mới. Bằng chứng được ghi trong kết quả kiểm tra nghiệm thu.
- Đảm bảo nhận ra tên tất cả người tham gia, đạt một tỷ lệ chính xác trên mọi cuộc họp, hoặc tự khôi phục tên khi summary thất bại.
- Thêm provider, model picker, database, background job hoặc thay đổi giới hạn xử lý audio của v3.

## 4. Luồng demo chính

1. Người demo chọn audio, có thể ghi notes trước (bối cảnh, thuật ngữ, tên/vai trò đã biết), rồi chạy Process Meeting theo luồng hiện có.
2. Ứng dụng phiên âm với speaker label và timestamp như hiện tại.
3. Khi tạo summary, hệ thống xét toàn bộ transcript trong giới hạn được hỗ trợ cùng notes để brief và tìm tên tương ứng từng speaker. Bằng chứng ở cuối cuộc họp có thể giúp xác định người nói ở đầu cuộc họp.
4. Results ưu tiên tên đã xác định; speaker chưa rõ tên hiển thị “Person N”. Nội dung và timestamp của transcript gốc được giữ nguyên.
5. Người demo kiểm tra cùng một người trong transcript, bộ lọc, summary và action items; copy hoặc tải kết quả để xác nhận tính nhất quán.
6. Results có ô notes chứa lại nội dung ban đầu. User sửa/bổ sung khi summary hoặc tên chưa đúng rồi bấm Regenerate Summary. Nếu chưa có summary dùng Generate/Retry Summary. Mọi lượt dùng cùng transcript và notes hiện tại, không upload hoặc phiên âm lại.

## 5. Quy tắc xác định danh tính

### FR-01 — Chỉ gán tên khi liên kết được tên với người nói

| Tình huống | Hành vi yêu cầu |
|---|---|
| Tự giới thiệu rõ, ví dụ “Mình là Alex” | Có thể gán Alex cho speaker nói câu đó nếu không có bằng chứng mâu thuẫn |
| Gọi đích danh và đáp lời tự nhiên, tiếp tục demo hoặc thực hiện yêu cầu | Gán tên khi toàn ngữ cảnh hỗ trợ người được gọi; không bắt buộc nhắc lại tên trong câu đáp |
| Gọi tên, ví dụ “Bob demo luôn đi” | Xét câu đáp, demo và các trao đổi sau để xác định người được gọi; không gán cho người gọi hoặc người nói kế tiếp chỉ vì vị trí |
| Nhắc người thứ ba, ví dụ “Alex có làm cái đó” | Không gán Alex cho speaker đang nói chỉ từ câu này |
| Có nhiều người đáp, nói chồng hoặc chuyển chủ đề | Giữ chưa xác định nếu không phân biệt được người đáp |
| Bằng chứng mâu thuẫn hoặc một nhãn có dấu hiệu chứa nhiều người | Không ép một tên đại diện cho cả nhãn; giữ nhãn trung lập |
| Không có tên | Giữ nhãn trung lập; không tạo tên mẫu |

- Xét ngữ cảnh liên quan trong toàn transcript, không giới hạn ở câu giới thiệu hoặc đoạn đầu.
- Giữ tên theo cách xuất hiện trong hội thoại hoặc đính chính rõ ràng của user, gồm dấu tiếng Việt khi có. Không tự bổ sung họ tên, chức vụ hoặc thông tin cá nhân.
- Đại từ “anh”, “em”, “mình” hoặc vai trò đơn thuần không được coi là tên riêng.
- Không gộp hai nhãn chỉ vì cùng nhắc đến một tên. Nếu tên trùng nhau thực sự được xác nhận, UI phải phân biệt được bằng tên kèm số speaker; nếu không đủ căn cứ thì để chưa xác định.

### FR-02 — Một danh tính nhất quán trên kết quả

- Khi có tên hợp lệ, ưu tiên tên đó trên transcript, bộ lọc speaker và các nội dung liên quan: executive summary, takeaways, discussions, decisions, risks, questions, key moments, next steps, email draft và action items.
- Khi chưa rõ tên, dùng cùng nhãn “Person N” trên UI và nội dung cho người đọc; không xen kẽ “Speaker N” và “Person N” cho cùng người.
- Giữ raw speaker label làm định danh nội bộ. Không thay tên bằng cách sửa lời nói, timestamp hoặc gộp đoạn transcript.
- JSON giữ raw label và bảng `speakerNames` để truy vết; Markdown và nội dung copy dùng tên hiển thị. Raw JSON được phép chứa `Speaker N`.
- Ánh xạ tên phải bao phủ các speaker có trong transcript; speaker chưa rõ có tên bằng `null`. Không thêm speaker chỉ vì tên được nhắc trong hội thoại.
- Bản ghi cũ thiếu ánh xạ hoặc chưa có summary vẫn hiển thị bằng nhãn trung lập, không tự sinh tên.

### FR-03 — Phân biệt danh tính người nói và người phụ trách task

- Người nói tự nhận việc: assignee liên kết với speaker đó; hiển thị tên nếu đã xác định, nếu chưa thì dùng “Person N”.
- Hội thoại giao việc cho một người được gọi tên: giữ tên người được giao dù chưa biết họ tương ứng speaker nào hoặc họ không phát biểu.
- Không mặc định người đang nói là người phụ trách. Không rõ chủ sở hữu thì giữ `Unknown` theo hành vi hiện có.
- Nhắc tên trong một câu không tự tạo action item. Chỉ trích xuất khi có công việc/cam kết đủ rõ; không bổ sung deadline không được nêu.
- Sửa assignee thủ công theo tính năng hiện có chỉ sửa task; không đổi danh tính speaker hoặc các task khác.

### FR-04 — Lỗi và thử lại

- Không đủ căn cứ xác định tên là kết quả hợp lệ, không phải lỗi summary. Các phần summary khác vẫn được hiển thị.
- Tạo summary đầu tiên thất bại: giữ transcript và lỗi thật, không chèn tên hoặc nội dung mẫu. Regenerate thất bại khi đã có summary: giữ nguyên summary/bảng tên thành công trước đó và notes đang sửa; hiển thị lỗi lần tạo lại, cho retry.
- Retry thành công: cập nhật cùng lúc summary và ánh xạ tên trên các bề mặt liên quan; giữ nguyên transcript và timestamp.
- Cache, reload và export bảo toàn bảng tên đã tạo thành công theo cơ chế lưu kết quả hiện có. Khi cache không khả dụng, dữ liệu vẫn dùng được trong phiên theo baseline v3.
- Không yêu cầu tên ổn định tuyệt đối giữa các lần chạy AI độc lập. Mỗi kết quả phải đáp ứng quy tắc có căn cứ và nhất quán trong chính kết quả đó.

## 6. Các ca từ dữ liệu mẫu

Các câu dưới đây là ví dụ để kiểm tra giới hạn suy luận, chưa phải đáp án ánh xạ:

| Vị trí | Nội dung mẫu | Điều phải kiểm tra |
|---|---|---|
| 01:25.9 — Speaker 2 | “Xong rồi Long demo luôn đi.” | Không suy ra Speaker 2 là Long; câu tiếp theo không tự động xác nhận Long |
| 04:11.0 — Speaker 1 | “… Khánh ra chỗ team …” | Phải tìm thêm ngữ cảnh đáp lời trước khi gán Khánh cho speaker khác |
| 24:45.6 — Speaker 3 | “Khánh suy nghĩ logo cho em Khánh.” | Có thể giữ Khánh là người được nhắc/giao việc nếu ngữ cảnh đủ rõ; không suy ra Speaker 3 là Khánh |
| 25:28.5 — Speaker 3 | “… anh Dũng …” và nhiều lượt lời trong cùng đoạn | Không xem mọi lời trong đoạn là bằng chứng một danh tính duy nhất |

Nếu không xác định chắc được tên nào trong mẫu, kết quả dùng “Person N” là hợp lệ về độ thận trọng nhưng **chưa đủ chứng minh mục tiêu nhận ra tên**. Cần thêm một bản ghi ngắn có tự giới thiệu và gọi–đáp rõ ràng để nghiệm thu ca nhận diện thành công.

## 7. Tiêu chí nghiệm thu

| ID | Ca kiểm tra | Kết quả đạt |
|---|---|---|
| AC-01 | Bản ghi ngắn có ít nhất hai speaker, một người tự giới thiệu và một người có ngữ cảnh gọi–đáp xác nhận rõ | Cả hai người được hiển thị đúng tên theo đáp án xác nhận trước; không chỉ trả toàn bộ `null` |
| AC-02 | Bằng chứng tên xuất hiện muộn trong transcript | Tên đúng áp dụng cho cả các đoạn trước đó của cùng speaker |
| AC-03 | Có tên người thứ ba và một speaker không đủ căn cứ nhận diện | Không gán tên người thứ ba cho speaker; người chưa rõ giữ “Person N” |
| AC-04 | Chỉ gọi tên rồi có câu trả lời không liên quan; hoặc bằng chứng mâu thuẫn | Không gán tên từ vị trí liền kề hoặc chọn tùy ý một tên |
| AC-05 | Cùng một speaker xuất hiện ở transcript, filter, summary, task tự nhận, email, copy và Markdown | Tên/nhãn nhất quán; lọc và jump timestamp vẫn đúng; JSON giữ raw label cùng ánh xạ |
| AC-06 | Task giao đích danh cho người chưa liên kết speaker; task không có owner; task tự nhận | Lần lượt giữ tên được giao, `Unknown`, và danh tính của người tự nhận; không suy đoán thêm |
| AC-07 | Summary lỗi rồi Retry Summary thành công | Trước retry xem được transcript với nhãn trung lập; sau retry cập nhật tên; không có lượt upload/phiên âm mới |
| AC-08 | Reload kết quả đã lưu thành công và mở kết quả cũ thiếu ánh xạ | Kết quả mới giữ tên; kết quả cũ hiển thị fallback, không lỗi trang |
| AC-09 | Chạy summary/retry trên toàn bộ dữ liệu mẫu | Ghi rõ từng ánh xạ và đoạn làm căn cứ, hoặc lý do để `null`; người đánh giá kiểm tra không gán nhầm chỉ vì tên được nhắc |
| AC-10 | Đối chiếu dữ liệu trước/sau bước xác định tên | Không đổi số đoạn, raw speaker label, lời thoại hoặc timestamp; thao tác sửa assignee không đổi bảng tên |

## 8. Definition of Done

- Hoàn thành toàn bộ AC; lưu kết quả nghiệm thu tại `specs/v4/Verification-Results.md` khi thực hiện kiểm tra, kèm kết quả từng ca và giới hạn chưa xác nhận.
- Có ít nhất một lượt chạy AI thật trên bản ghi có đáp án rõ để xác nhận nhận ra tên, và một lượt summary/retry với transcript mẫu để kiểm tra hội thoại thực tế. Không cần phiên âm lại file mẫu để chứng minh riêng phần xác định tên.
- Ghi lại tên kỳ vọng, tên thực tế và vị trí bằng chứng cho từng speaker trong các ca kiểm tra; không dùng output AI làm đáp án cho chính nó.
- Kiểm tra nhất quán UI/copy/export, reload và retry; chạy các checks hiện có phù hợp nếu có thay đổi code. Không yêu cầu thêm unit test.
- Provider lỗi hoặc thiếu audio/đáp án kiểm chứng phải ghi là chưa xác nhận ở ca tương ứng; fixture chỉ chứng minh hiển thị và nhánh lỗi, không thay thế kiểm tra chất lượng nhận diện.
- Không yêu cầu thay kiến trúc, thêm màn hình riêng hoặc hoàn thiện tính năng production để coi demo v4 hoàn thành. Hai ô notes nằm trên các màn hình hiện có.

## 9. Bổ sung notes trước/sau và tạo lại kết quả

Phần này bổ sung FR-01–04; quy tắc nguồn danh tính và regenerate bên dưới thay thế giới hạn chỉ dùng transcript của bản trước. “Đoạn chat” trong yêu cầu này được hiểu là hội thoại/transcript hiển thị và các nội dung summary liên quan; không mở rộng tính năng Ask AI.

### FR-05 — Một nội dung notes, hai điểm chỉnh sửa

- Có textarea tùy chọn tại màn hình record/upload trước Process Meeting, và tại đầu Results, trước phần summary. Hai vị trí chỉnh cùng notes của cuộc họp, không phải hai nguồn độc lập. Không cần notes để xử lý audio.
- Placeholder gợi ý tên/vai trò và bối cảnh: “Cuộc họp gồm Alex (backend), Bob (frontend), Alice (PM). Nexus là tên dự án”. AI tự liên kết danh sách này với hội thoại, không yêu cầu user biết số speaker. Mapping thủ công vẫn được hỗ trợ nếu user chủ động cung cấp.
- Notes được chuyển cùng kết quả khi điều hướng, lưu bằng cơ chế cache best effort hiện có và có trong JSON export. Kết quả schema 3 cũ thiếu notes mở với chuỗi rỗng. Không dùng lại notes cuộc họp trước khi bắt đầu cuộc họp mới.
- Giới hạn đề xuất cho demo: 10.000 ký tự notes; vượt giới hạn hoặc sai kiểu phải báo rõ và không gọi AI, không cắt âm thầm. Ghi notes không tự kích hoạt inference.

### FR-06 — Kết hợp dữ liệu có phân biệt nguồn

- Tạo brief và các trường summary hiện có từ toàn transcript + notes, trong cùng một lượt summary AI. Không thêm định dạng brief hay pipeline extraction riêng.
- AI phải chủ động suy luận tên từ cả notes và toàn hội thoại, kể cả tên chỉ có trong notes, dựa trên gọi–đáp tự nhiên, phần demo và vai trò/trách nhiệm. Không đòi tự giới thiệu hoặc câu xác nhận danh tính. Đính chính rõ được ưu tiên; không tự ghép theo thứ tự/số lượng. Chỉ để null khi kết hợp hai nguồn vẫn thiếu căn cứ hoặc mâu thuẫn. Không tạo speaker mới từ tên trong notes.
- Nội dung chỉ có trong notes được nêu là bối cảnh/đính chính do user bổ sung trong phần summary phù hợp; không trình bày như lời nói hoặc quyết định đã được mọi người đồng ý. Không tạo timestamp/key moment giả cho thông tin chỉ có trong notes.
- Notes là dữ liệu, không phải chỉ dẫn hệ thống. Nội dung yêu cầu bỏ qua quy tắc, tiết lộ key hoặc tự tạo quyết định không được thực thi. Không đổi lời thoại raw/timestamp khi sửa tên hiển thị.

### FR-07 — Regenerate chủ động, an toàn

- Cho tạo lại từ cả completed, transcribed và summary_failed có transcript; không tạo summary cho no_speech chỉ từ notes.
- Lưu notes ngay khi sửa theo cơ chế hiện có; ghi rõ khi notes khác bản đã dùng tạo summary. User bấm nút mới gửi transcript + snapshot notes hiện tại. Khóa nút gửi lặp và ô notes trong lúc chờ để kết quả không gắn nhầm bản notes.
- Thành công thay toàn summary/bảng tên cùng lúc và bỏ cảnh báo chưa áp dụng. Lần tạo lại thay action items, bao gồm sửa owner/trạng thái thủ công; UI phải nói rõ điều này trước thao tác. Các metadata cuộc họp và transcript giữ nguyên.
- Thất bại giữ notes và kết quả thành công trước đó, vẫn báo notes chưa áp dụng; không biến completed thành summary_failed làm mất summary. Nếu chưa có summary, dùng nhánh summary_failed hiện có. Retry tiếp tục với notes mới nhất.

### Acceptance bổ sung (P0)

| ID | Ca kiểm tra | Kết quả đạt |
|---|---|---|
| AC-11 | Nhập notes trước Process; mở Results rồi reload | Notes giống input, được dùng ở lượt summary đầu, reload giữ khi cache ghi thành công; bỏ trống vẫn chạy như cũ |
| AC-12 | Transcript mơ hồ; notes ghi rõ Speaker 1 là Alex | Tên hiển thị và summary dùng Alex nhất quán; danh sách tên không có liên kết không được gán tùy ý; raw transcript giữ nguyên |
| AC-13 | Summary completed sai; sửa notes rồi Regenerate | Hiện trạng chưa áp dụng trước khi bấm; đúng một summary request với notes mới; không upload/phiên âm; summary và bảng tên thay cùng lúc |
| AC-14 | Regenerate lỗi rồi retry thành công | Summary/bảng tên cũ và notes mới còn nguyên khi lỗi; retry dùng notes mới; thành công cập nhật kết quả và trạng thái áp dụng |
| AC-15 | Notes thêm bối cảnh, chứa chỉ dẫn độc hại hoặc mâu thuẫn | Phân biệt nguồn user; không bịa đồng thuận/timestamp; không thực thi chỉ dẫn; mapping mâu thuẫn để null |
| AC-16 | Notes quá dài/sai kiểu, cache cũ, JSON export, cuộc họp mới | Báo validation rõ trước AI; cache cũ thiếu notes dùng rỗng; JSON giữ notes và bản đã áp dụng; cuộc họp mới không kế thừa notes cũ |

DoD bổ sung: hoàn thành AC-11–16 với kết quả thực thi riêng; kết quả verification lịch sử không chứng minh phần notes. Giới hạn 10.000 ký tự, khóa chỉnh sửa trong lúc chờ và thay toàn bộ tasks là lựa chọn thiết kế đề xuất cho demo, không phải quyết định đã được user phê duyệt riêng.


## 10. Acceptance bổ sung — tự nhận diện từ notes (P0)

| ID | Ca kiểm tra | Kết quả đạt |
|---|---|---|
| AC-17 | Notes chỉ chứa tên/vai trò, hội thoại có gọi–đáp và demo, không tự giới thiệu | Tên đúng được gán tự động cho mọi speaker có căn cứ; không yêu cầu mapping thủ công; không nghiệm thu bằng toàn null |
| AC-18 | Tên chỉ có trong notes, hội thoại phân biệt vai trò/trách nhiệm | Liên kết đúng qua ngữ cảnh, không ghép theo thứ tự danh sách; đổi thứ tự notes không làm đổi danh tính |
| AC-19 | Danh sách không có ngữ cảnh phân biệt, có người vắng mặt hoặc bằng chứng mâu thuẫn | Không ép dùng hết tên hoặc coi số tên bằng số speaker là đủ; giữ null ở nhãn thực sự không xác định |
| AC-20 | Notes nguyên văn trong ảnh lỗi + toàn transcript tương ứng, Regenerate | Kiểm chứng nhận diện từng người bằng bằng chứng độc lập; không yêu cầu user nghe rồi điền Person N. Người có căn cứ phải nhận đúng, null không có lý do là chưa đạt; giữ raw transcript/timestamp và cập nhật tên nhất quán |

AC-20 là điều kiện nghiệm thu thực tế, không được thay bằng static checks hoặc ví dụ tổng hợp. Cần xác minh transcript mẫu có tương ứng cuộc họp trong ảnh; nếu không, lấy transcript của kết quả đó qua cơ chế hiện có. Đáp án kiểm chứng do người thực thi lập từ nguồn độc lập trước khi xem output AI, không phải bước nhập mapping bắt buộc trong sản phẩm.
