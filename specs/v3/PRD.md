# PRD v3 — Xử lý file ghi âm nặng cho bản demo

Ngày: 2026-11-06  
Trạng thái: Đặc tả cho planning; chưa xác nhận bằng chạy thử nhà cung cấp.  
Phạm vi: Upload và xử lý cuộc họp dài trong demo local, một người dùng, một file mỗi lần.

## 1. Mục tiêu và vấn đề

Người dùng cần đưa một bản ghi cuộc họp thực tế vào ứng dụng, chờ xử lý với trạng thái rõ ràng, rồi đọc transcript và Meeting Intelligence. File nhỏ theo byte vẫn có thể chứa cuộc họp dài; tăng giới hạn upload đơn thuần không giải quyết thời gian phiên âm, độ dài transcript, mất kết quả trung gian hoặc lỗi lưu trình duyệt.

V3 tập trung vào xử lý đầu vào dài/nặng từ đầu đến cuối. Giữ trải nghiệm kết quả v2 và các chức năng đã có; không mở rộng thành nền tảng quản lý cuộc họp.

### Bằng chứng hiện tại

- File chuẩn: [meeting-2026-11-06.m4a](meeting-2026-11-06.m4a), 16.398.909 byte (~15,64 MiB), thời lượng metadata 1.920,084 giây (~32 phút), AAC mono 48 kHz. Đo bằng `stat` và `afinfo`; chưa phiên âm hoặc đánh giá chất lượng nội dung.
- [constants.ts](../../lib/constants.ts): upload tối đa 20 MiB; ghi âm trực tiếp tối đa 5 phút. File chuẩn đã nằm dưới giới hạn byte hiện tại.
- [process-meeting route](../../app/api/process-meeting/route.ts): một request bao gồm upload lên nhà cung cấp, phiên âm và tóm tắt; budget phiên âm gồm upload 180 giây, tóm tắt 60 giây.
- [MeetingWorkspace](../../components/MeetingWorkspace.tsx): chuyển trang sau khi ghi kết quả vào localStorage; [storage.ts](../../lib/storage.ts) có thể trả về ghi thất bại. V3 phải bảo đảm việc này không làm mất kết quả trong phiên.

Các số liệu trên là quan sát code/metadata, không phải kết luận nguyên nhân một lỗi live đã tái hiện.

## 2. Người dùng và kết quả mong đợi

Người demo upload audio từ máy, cung cấp Gemini API key bằng cơ chế hiện có, xử lý và xem kết quả. Thành công khi:

1. File chuẩn 32 phút đi qua luồng thực mà không phải cắt thủ công.
2. Transcript bao phủ đầu, giữa và cuối cuộc họp; bản tóm tắt xét toàn bộ transcript trong phạm vi đầu vào được hỗ trợ.
3. Khi tóm tắt lỗi, transcript vẫn đọc và tải về được, có thể thử lại riêng tóm tắt.
4. Người dùng biết hệ thống đang làm gì, khi nào thất bại và cần thao tác gì tiếp theo.

## 3. Giới hạn demo và ưu tiên

| Hạng mục | Quyết định cho demo |
|---|---|
| Môi trường | Next.js chạy local trên máy demo; tab đang mở; mạng ổn định và key/quota hợp lệ |
| Dung lượng upload | Tối đa 100 MiB = 104.857.600 byte, tính cả đúng ngưỡng; file rỗng bị từ chối |
| Thời lượng | Mục tiêu nghiệm thu đến 60 phút; trên 60 phút có cảnh báo ngoài phạm vi đã kiểm chứng, không cam kết xử lý thành công |
| Định dạng | Giữ MP3, WAV, M4A, WebM; metadata hợp lệ không đồng nghĩa codec giải mã được |
| Số lượng | Một file, một lần xử lý đang hoạt động trong một tab; không batch |
| Ghi âm trực tiếp | Giữ giới hạn 5 phút hiện tại; tăng giới hạn chỉ áp dụng upload |
| Tóm tắt / Ask AI | Tối đa 200.000 ký tự theo `JSON.stringify(transcript).length`; kiểm tra đầy đủ trước gọi AI, không cắt âm thầm |
| Chờ xử lý | Budget upload từ browser + upload provider + phiên âm: 12 phút; tóm tắt: 2 phút; toàn lượt tối đa 15 phút, tính từ Process |
| Lưu trữ | Audio chỉ trong phiên; kết quả mới nhất cache browser best effort; không bảo đảm khôi phục sau reload |

100 MiB và 60 phút là mục tiêu sản phẩm được chọn để demo, chưa phải khả năng đã được xác nhận của nhà cung cấp hoặc hosting. Không quảng bá hỗ trợ vô hạn. File >60 phút được cảnh báo trước khi Process nếu đọc được metadata; khi metadata không khả dụng, hiển thị chưa xác định thời lượng và vẫn cho thử trong giới hạn byte/budget.

P0: nhận file lớn, kiểm tra đầu vào, tiến trình trung thực, transcript đầy đủ, tách lỗi tóm tắt, retry, hiển thị/cache/export chịu được transcript dài. P1: tinh chỉnh tốc độ, hiển thị ước lượng thời gian dựa trên số đo thực. P1 không chặn demo.

## 4. Hành trình người dùng

1. Chọn/kéo thả một file; thấy tên, dung lượng, thời lượng nếu đọc được và giới hạn hỗ trợ.
2. Kiểm tra file và API key; lỗi đầu vào xuất hiện trước khi gọi AI.
3. Chọn Process; khóa thao tác gửi trùng và thay file trong lượt hiện tại.
4. Theo dõi “Đang tải lên và phiên âm” kèm thời gian đã chờ. Không giả phần trăm hoặc thời gian còn lại.
5. Khi có transcript, giữ nó trong phiên trước khi bắt đầu “Đang tạo tóm tắt”; có thể hiển thị transcript ngay.
6. Mở kết quả đầy đủ, hoặc kết quả có transcript và lỗi tóm tắt với Retry Summary.
7. Có thể tải transcript/kết quả. Nếu reload, giải thích audio/lượt đang chạy không được khôi phục; kết quả đã cache thành công vẫn xem được.

## 5. Yêu cầu chức năng

### FR-01 — Chọn và kiểm tra file (P0)

- Upload đúng 100 MiB được phép; vượt ngưỡng bị chặn ở browser và server. Không gửi file đã biết không hợp lệ lên AI.
- Kiểm tra định dạng theo quy tắc hiện có, bao gồm MIME thiếu/generic; file giả đuôi hoặc hỏng có lỗi giải mã rõ ràng, không chuyển thành “không có lời nói”.
- Không cần giải mã toàn bộ audio hoặc tạo waveform trước Process. Đọc metadata không được giữ UI ở trạng thái chờ vô hạn.
- Không yêu cầu người dùng nén/cắt file chuẩn để demo thành công.

### FR-02 — Tiến trình và thời gian chờ (P0)

- Phân biệt kiểm tra đầu vào, tải lên/phiên âm, tóm tắt và kết thúc. Cho phép gộp upload và phiên âm khi chưa có tín hiệu tách biệt thực.
- Hiển thị elapsed time và thông báo file dài có thể mất vài phút; dùng hoạt ảnh chờ khi không có phần trăm thật.
- Budget ở mục 3 là thời hạn kết thúc chờ, không phải cam kết mọi file xử lý thành công. Khi hết hạn, chỉ rõ bước lỗi và đường thử lại.
- Chống nhấn Process nhiều lần. Kết quả đến muộn từ lượt cũ không được ghi đè lượt mới.
- Không bắt buộc nút hủy chủ động. Đóng/reload tab chấm dứt khả năng theo dõi; không tuyên bố đã hủy xử lý phía nhà cung cấp.

### FR-03 — Phiên âm toàn bộ cuộc họp (P0)

- Giữ nội dung theo thời gian với timestamp và speaker nếu nhà cung cấp có trả về; không tự bỏ phần cuối, cắt đầu vào hoặc coi output bị giới hạn là kết quả hoàn chỉnh.
- Đối với file chuẩn, người đánh giá đối chiếu nội dung nghe được ở đầu, giữa, cuối và một vài đoạn chuyển chủ đề. Không dùng timestamp cuối như bằng chứng duy nhất của độ đầy đủ.
- Không có lời nói là trạng thái riêng, chỉ khi phiên âm hoàn tất hợp lệ và không có speech. Lỗi, output hỏng hoặc bị cắt phải báo thất bại.
- Nếu sau này cần chia audio: timestamp phải theo toàn file và không khẳng định speaker giữa các phần là cùng người nếu chưa có căn cứ. Chia audio tự động chưa thuộc demo v3.

### FR-04 — Tóm tắt cuộc họp dài (P0)

- Xem xét toàn bộ transcript nằm trong giới hạn; không chỉ gửi vài phút đầu và vẫn gọi là tóm tắt toàn cuộc họp.
- Giữ nội dung cốt lõi v2: title, executive summary, discussion points, decisions, action items, transcript; tiếp tục hiển thị các enrichment hiện có khi có dữ liệu hợp lệ.
- Sự kiện, quyết định, danh tính và cam kết có căn cứ trong transcript. Nhận định/rủi ro suy luận và đề xuất bước tiếp theo được phép nếu liên quan và thể hiện rõ là suy luận/đề xuất.
- Speaker chưa rõ giữ nhãn trung lập nhất quán; không đoán tên, người phụ trách hoặc deadline. Không gộp các speaker chỉ vì trùng tên.
- Nội dung theo ngôn ngữ chính cuộc họp; không có dữ liệu thì empty state, không dùng nội dung demo mẫu.
- Nếu transcript vượt 200.000 ký tự hoặc nhà cung cấp báo giới hạn context/output: giữ transcript, thông báo không thể tạo bản tóm tắt đầy đủ trong scope demo. Không tự cắt bớt hoặc retry vô ích cùng đầu vào vượt ngưỡng.

### FR-05 — Kết quả trung gian và thử lại (P0)

- Transcript được giữ trong bộ nhớ browser ngay sau phiên âm, trước bước tóm tắt; lỗi summary, timeout hoặc lỗi cache không làm mất nó trong tab hiện tại.
- Retry Summary sử dụng transcript hiện tại, không upload lại audio và không gọi lại phiên âm. Thất bại tiếp vẫn giữ transcript.
- Lỗi upload/phiên âm cho phép thử lại từ file còn trong phiên; chưa yêu cầu resume byte hoặc checkpoint phiên âm.
- Không retry AI tự động vô hạn. Demo ưu tiên retry thủ công để kiểm soát chi phí và tránh gửi trùng.

### FR-06 — Xem và xuất kết quả dài (P0)

- Transcript có tìm kiếm, lọc speaker và khả năng xem đến đoạn cuối; chia trang hoặc tải thêm để tránh render toàn bộ số lượng lớn đoạn cùng lúc.
- Có thể tìm kiếm toàn transcript, không chỉ trang đang hiển thị. Chuyển từ insight đến timestamp phải mở đúng trang/đoạn tương ứng.
- Audio jump hoạt động khi audio còn trong phiên; thiếu audio không chặn xem transcript.
- Download Markdown và JSON dùng toàn bộ transcript cùng trạng thái thực tế, kể cả summary thất bại; không chỉ export trang hiện tại.
- Có cache thì reload được kết quả. Khi cache đầy/không khả dụng, vẫn mở Results từ dữ liệu trong phiên và hiện cảnh báo cần export trước khi rời trang; không lặng lẽ hiển thị kết quả cũ.
- Giữ chỉnh sửa action items, copy và các tương tác kết quả hiện có trong phạm vi dữ liệu hỗ trợ. Ask AI vượt ngưỡng phải báo rõ, không trả câu trả lời mẫu hoặc giả vờ đã đọc toàn bộ.

### FR-07 — Lỗi, dữ liệu và vận hành demo (P0)

- Phân biệt file quá lớn/sai định dạng, key/quota, mạng, timeout, phiên âm lỗi, không speech, tóm tắt lỗi và cache lỗi; có thông điệp và hành động tiếp phù hợp.
- Key không xuất hiện trong logs, export hoặc thông báo lỗi. Không ghi audio/transcript đầy đủ vào log phục vụ đo hiệu năng.
- Audio tạm trên provider được cleanup best effort sau khi xong hoặc lỗi nếu biết định danh; không hứa xóa thành công khi chưa xác nhận. Cleanup thất bại là cảnh báo, không xóa transcript hợp lệ.
- Ghi số đo từng giai đoạn và tổng thời gian, byte đầu vào, số đoạn/ký tự transcript và kết quả để đánh giá demo; không cần dashboard hoặc hệ thống giám sát mới.

## 6. Ngoài phạm vi

Queue/worker, database, lịch sử nhiều cuộc họp, background job bền vững, tiếp tục sau restart/reload, batch, resumable upload phía người dùng, tự động nén/chuyển codec/chia audio, pipeline tóm tắt nhiều tầng, xác thực người dùng, cộng tác, tích hợp gửi email/task, đảm bảo SLA production hoặc triển khai serverless. Không thêm model/provider hoặc dependency lớn nếu luồng sẵn có đủ đáp ứng demo.

## 7. Tiêu chí nghiệm thu

| ID | Tiêu chí có thể quan sát |
|---|---|
| AC-01 | File chuẩn ~32 phút chạy thực end-to-end, có transcript và core summary; đối chiếu đầu/giữa/cuối không thiếu khối nội dung lớn |
| AC-02 | File audio hợp lệ >20 MiB và ≤100 MiB đi vào xử lý; ca đúng ngưỡng được nhận, quá ngưỡng/rỗng bị từ chối trước gọi AI |
| AC-03 | Một file audio thực khoảng 60 phút được xử lý; đo và ghi rõ dung lượng, format, thời gian và kết quả, không suy diễn chỉ từ file chuẩn |
| AC-04 | UI hiển thị giai đoạn và elapsed time; không giả tiến độ; không gửi trùng khi nhấn nhiều lần |
| AC-05 | Hết budget hoặc lỗi provider kết thúc chờ và chỉ đúng bước lỗi; kết quả đến muộn không ghi đè |
| AC-06 | Summary lỗi sau phiên âm: transcript xem/export được; retry summary không upload/phiên âm lại |
| AC-07 | Transcript vượt ngưỡng: giữ/export đầy đủ, summary/Ask AI báo giới hạn; không cắt âm thầm |
| AC-08 | Cache ghi thất bại vẫn mở đúng kết quả mới trong cùng phiên, hiện cảnh báo; cache thành công reload đúng kết quả |
| AC-09 | Transcript dài search/filter toàn bộ, mở được cuối, jump đúng đoạn; export đầy đủ |
| AC-10 | File hỏng/provider lỗi khác no_speech; silence hợp lệ hiển thị no_speech và không sinh dữ liệu giả |
| AC-11 | Input nhỏ và ghi âm ≤5 phút vẫn hoạt động; kết quả giữ đúng dữ liệu cuộc họp và tương tác hiện có |
| AC-12 | Cleanup được thử với resource đã biết; lỗi cleanup không làm mất kết quả, key không nằm trong log/export |

## 8. Definition of Done và giới hạn xác nhận

- Hoàn tất P0 và chạy các ca liên quan AC; ghi evidence, thời gian thực tế và giới hạn môi trường.
- Chạy các checks hiện có phù hợp sau implementation; không bắt buộc thêm unit test.
- File chuẩn và file ~60 phút phải có lượt chạy thật với key/quota hợp lệ để xác nhận chất lượng và thời gian. Fixture giả chỉ xác nhận UI/error paths, không thay thế nghiệm thu AI.
- Nếu ca mục tiêu thất bại vì giới hạn provider, báo chính xác chưa đạt; không tự đổi tiêu chí thành “upload được” hoặc thêm kiến trúc production để che lỗi.
- Tài liệu này không khẳng định đã triển khai hoặc chạy AI thành công. Các ngưỡng là lựa chọn demo theo yêu cầu ưu tiên giải pháp đơn giản; điều chỉnh chỉ khi có bằng chứng kiểm chứng và phải cập nhật tài liệu liên quan.
