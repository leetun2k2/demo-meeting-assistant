# PRD — AI Meeting Assistant

**Version:** 2.3  
**Status:** Ready for Implementation  
**Product Type:** Proof of Concept (POC)  
**Priority:** MVP  
**Development Target:** 1 hour

## 1. Product Overview

### 1.1. Background

Trong các cuộc họp, người tham gia thường phải ghi chú thủ công, dễ bỏ sót các nội dung quan trọng như quyết định, công việc được giao và thời hạn thực hiện.

AI Meeting Assistant là ứng dụng demo sử dụng AI để tự động chuyển nội dung cuộc họp thành văn bản, phân biệt người nói và tổng hợp những thông tin quan trọng.

### 1.2. Product Goal

Xây dựng một ứng dụng web đơn giản để chứng minh tính khả thi của việc sử dụng AI trong xử lý cuộc họp.

Ứng dụng cần trả lời được ba câu hỏi:

1. **Who said what?** — AI có thể phân biệt từng người nói và nội dung họ đã nói không?
2. **What matters?** — AI có thể xác định những thông tin và quyết định quan trọng không?
3. **What's next?** — AI có thể xác định các công việc cần thực hiện, người phụ trách và deadline không?

Mục tiêu là kiểm chứng khả năng thực tế của AI, không phải xây dựng một sản phẩm hoàn chỉnh.

## 2. Target Users & Use Cases

**Target user:** Product Owner, Developer hoặc người muốn thử nghiệm AI Meeting Assistant.

### Use Case 1 — Record a Meeting

Người dùng muốn ghi âm nhanh một cuộc hội thoại ngay trên trình duyệt và xem AI phân tích kết quả.

**User Journey:**

1. Mở ứng dụng.
2. Nhập Gemini API key lần đầu hoặc sử dụng keys đã lưu trong browser.
3. Chọn Record Audio.
4. Nhấn Start Recording.
5. Trao đổi với một hoặc nhiều người.
6. Nhấn Stop Recording.
7. Có thể nghe lại bản ghi âm nếu audio preview P1 được triển khai (optional).
8. Nhấn Process Meeting.
9. Xem transcript và AI summary.

### Use Case 2 — Analyze an Existing Recording

Người dùng đã có một file ghi âm cuộc họp và muốn kiểm tra khả năng AI xử lý.

**User Journey:**

1. Mở ứng dụng.
2. Nhập Gemini API key lần đầu hoặc sử dụng keys đã lưu trong browser.
3. Chọn Upload Audio.
4. Chọn file từ máy tính.
5. Nhấn Process Meeting.
6. Xem kết quả phân tích.

Cả hai use cases phải trả về cùng một định dạng kết quả.

## 3. Product Requirements

### FR-01 — API Configuration

Người dùng có thể nhập:

- Một Gemini API Key dùng chung cho cả STT và summary.

**Expected Behavior:**

- Key được nhập trực tiếp trên giao diện.
- Có thể thay đổi key khi không đang xử lý; khóa inputs trong lúc xử lý.
- Tự động lưu Gemini API key vào localStorage của browser và khôi phục khi mở lại ứng dụng trên cùng origin; refresh không làm mất key.
- Thay đổi key sẽ cập nhật giá trị đã lưu; xóa nội dung input sẽ xóa key tương ứng khỏi localStorage. Có nút “Clear saved keys” để xóa Gemini key khỏi input và localStorage; khóa nút này trong lúc xử lý.
- Nếu localStorage không khả dụng, vẫn dùng key trong bộ nhớ cho phiên hiện tại và hiển thị “Your API key could not be saved in this browser.”; không chặn xử lý.
- Không cần tạo tài khoản hoặc đăng nhập.
- Không hiển thị key trong kết quả.

Key được lưu chỉ trên browser của người dùng để tái sử dụng cho demo; server chỉ giữ key trong bộ nhớ của request hiện tại. Hiển thị input dạng password và ghi chú: “Your Gemini API key is saved in this browser. Audio goes to Gemini 3.5 Transcribe and the transcript goes to Gemini 3.5 Flash-Lite when you process.” localStorage không phải kho bí mật được mã hóa của ứng dụng; không lưu audio hoặc kết quả vào đó.

### FR-02 — Audio Recording

Người dùng có thể ghi âm trực tiếp qua microphone.

**Required Features:**

- Start Recording
- Stop Recording
- Recording Timer
- Play Recording (optional, P1)
- Record Again

**Expected Behavior:**

- Browser yêu cầu quyền microphone.
- Hiển thị trạng thái khi đang ghi âm.
- Sau khi dừng, người dùng có thể nghe lại nếu audio preview P1 được triển khai.
- Có thể ghi âm lại nếu chưa hài lòng.
- Không tự động gửi audio trước khi người dùng nhấn Process Meeting.

Không cần waveform, audio enhancement hay chức năng chỉnh sửa âm thanh.

### FR-03 — Audio Upload

Người dùng có thể upload file audio từ máy tính.

**Required Features:**

- Select Audio File
- Display Filename
- Audio Preview (optional, P1)
- Replace File

Hỗ trợ upload MP3, WAV, M4A và WebM; file không hợp lệ hoặc provider không đọc được phải có thông báo dễ hiểu.

Giới hạn demo: tối đa 20 MiB (20 × 1024 × 1024 bytes) cho mỗi audio, áp dụng cho cả Record và Upload. File vượt giới hạn bị từ chối trước khi gọi provider. Browser mục tiêu là Chrome desktop hiện hành; không yêu cầu hỗ trợ browser khác cho MVP. Recording tự dừng sau 5 phút, giữ bản ghi để người dùng nhấn Process Meeting; không tự gửi. Khuyến nghị upload audio tối đa 5 phút, nhưng không yêu cầu đọc metadata hoặc áp giới hạn duration cho file upload. Đây là giới hạn sản phẩm cho demo, không phải cam kết về giới hạn hoặc hiệu năng của provider.

Không cần drag-and-drop hoặc upload nhiều file cùng lúc.

### FR-04 — Process Meeting

Sau khi có audio, người dùng nhấn **Process Meeting**.

Ứng dụng tự động thực hiện:

1. Chuyển audio thành văn bản bằng Gemini 3.5 Transcribe (`gemini-3.5-transcribe`).
2. Phân biệt người nói (Speaker Diarization).
3. Phân tích transcript bằng Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`).
4. Trả kết quả cho người dùng.

**Expected Behavior:**

- Không cần chọn ngôn ngữ trước khi xử lý.
- Hỗ trợ tiếng Việt, tiếng Anh và hội thoại xen kẽ.
- Hiển thị trạng thái đang xử lý.
- Không cho phép submit trùng trong lúc xử lý.
- Khi lỗi, hiển thị thông báo dễ hiểu.
- Nếu phiên âm thành công nhưng tóm tắt thất bại, vẫn hiển thị transcript và báo rõ summary thất bại.
- Chỉ cho phép Process Meeting khi đã có audio và Gemini API key không rỗng; không cần Test Connection.
- Trong lúc xử lý, khóa thay đổi keys, recording, upload và chuyển tab input; chỉ có một audio đang được chọn. Thay audio hoặc bắt đầu xử lý lần mới sẽ xóa kết quả/lỗi cũ. Đổi keys không tự chạy lại.
- Nếu transcript không có lời nói, hiển thị “No speech detected”, không gọi model summary và không tạo kết luận cuộc họp.
- Khi lỗi, người dùng có thể sửa input/keys và nhấn Process Meeting lại để chạy toàn bộ pipeline; không có retry riêng cho từng bước.

Không cần realtime transcription hay streaming results.

### FR-05 — Meeting Summary

Đây là khu vực quan trọng nhất của ứng dụng và phải được ưu tiên hiển thị.

AI cần trả về ba nhóm thông tin:

**A. Key Discussion Points**

Tóm tắt những vấn đề chính đã được thảo luận.

Ví dụ:

- Tiến độ phát triển sản phẩm.
- Những vấn đề đang cản trở dự án.
- Phương án giải quyết được đề xuất.

**B. Decisions Made**

Liệt kê các quyết định thực sự được thống nhất.

Ví dụ:

- Ưu tiên hoàn thành MVP trước.
- Hoãn tính năng Analytics sang giai đoạn tiếp theo.

**C. Action Items**

Hiển thị các công việc phát sinh từ cuộc họp.

| Assignee | Task | Deadline |
|---|---|---|
| Speaker 1 | Hoàn thành giao diện | Friday |
| Speaker 2 | Review API | Not specified |

**AI Requirements:**

- Tóm tắt bằng ngôn ngữ chính của cuộc họp. Nếu không có ngôn ngữ chiếm ưu thế rõ ràng, dùng ngôn ngữ của phát ngôn có nội dung đầu tiên; không cần bộ phát hiện ngôn ngữ riêng.
- Không tự tạo quyết định hoặc công việc không được đề cập.
- Không suy đoán deadline. Giữ nguyên deadline tương đối như “Friday”, không tự đổi thành ngày lịch; thiếu deadline thì ghi “Not specified”.
- Chỉ gán người phụ trách khi transcript nói rõ trách nhiệm: tự nhận việc thì dùng speaker label; tên được nêu rõ thì giữ tên đó mà không tự liên kết tên với speaker ID. Nếu chưa xác định được người phụ trách, ghi “Unknown”; không mặc định người đang nói là người nhận việc.
- Trả về danh sách rỗng nếu không có decisions hoặc action items.

### FR-06 — Meeting Transcript

Hiển thị toàn bộ nội dung đã được nhận diện.

Mỗi đoạn transcript có:

- Speaker label
- Timestamp
- Nội dung hội thoại

**Example:**

**Speaker 1 — 00:05**

> Hôm nay chúng ta cần review tiến độ phát triển MVP.

**Speaker 2 — 00:12**

> Phần backend đã hoàn thành, nhưng frontend vẫn còn một số vấn đề.

**Speaker 1 — 00:20**

> Vậy chúng ta ưu tiên hoàn thành frontend trước thứ Sáu.

**Expected Behavior:**

- Speaker labels được phân biệt trực quan.
- Speaker ID nhất quán trong toàn bộ transcript.
- Không tự gán tên thật khi thiếu thông tin. Nếu provider không xác định speaker, hiển thị “Unknown speaker”; không tạo danh tính giả.
- Nội dung theo đúng thứ tự thời gian.
- Có thể xem transcript ngay cả khi Gemini summary thất bại.

Không cần chỉnh sửa transcript hoặc gán lại speaker.

### FR-07 — Raw JSON

Cho phép người dùng xem kết quả JSON để đánh giá khả năng tích hợp vào sản phẩm thực tế.

JSON cần bao gồm:

- Transcript
- Speaker labels
- Timestamps
- Summary
- Decisions
- Action items

JSON phân biệt trạng thái `completed`, `summary_failed`, và `no_speech`. Khi `summary_failed` hoặc `no_speech`, summary là `null` (bao gồm discussions, decisions và action items không khả dụng), transcript vẫn được giữ; UI báo đúng trạng thái thay vì hiển thị summary như đã thành công. Khi `completed`, summary chứa discussions, decisions và action items; decisions/action items có thể là danh sách rỗng hợp lệ.

Có nút Copy JSON nếu dễ triển khai.

Không cần export PDF, DOCX hoặc định dạng phức tạp.

## 4. UI/UX Expectations

### 4.1. Screen Layout

Ứng dụng chỉ có **một trang duy nhất**, hiển thị các section trên cùng trang; không có bước Continue hoặc wizard.

PRD là nguồn quyết định hành vi và phạm vi. `wireframe.png` chỉ tham khảo bố cục; không triển khai model selectors, Test Connection hoặc Continue. Hai model cố định là `gemini-3.5-transcribe` cho STT và `gemini-3.5-flash-lite` cho summary; không có UI chọn model. Wireframe là ảnh legacy, không áp dụng phần cấu hình provider/keys; PRD này thay thế các chi tiết đó. Tên và ngày trong wireframe chỉ là dữ liệu minh họa, không cho phép suy đoán thông tin.

**Section 1 — Configuration**

Một password input cho Gemini API key, dùng chung cho hai model cố định.

**Section 2 — Audio Input**

Hai tab:

- Record Audio
- Upload Audio

Một nút Process Meeting dùng chung.

**Section 3 — Processing**

Hiển thị trạng thái đang xử lý, không cần phần trăm tiến độ giả.

**Section 4 — Results**

Ưu tiên trình bày:

1. Meeting Summary
2. Decisions
3. Action Items
4. Transcript
5. Raw JSON

### 4.2. Low-effort UX refinements

- Hiển thị lý do Process Meeting đang disabled ngay cạnh nút, tùy prerequisite còn thiếu; ví dụ “Add your Gemini API key and record or upload audio.” Khi đang ghi: “Stop recording before processing.” Không yêu cầu keys hợp lệ qua Test Connection.
- Bên cạnh upload, hiển thị “MP3, WAV, M4A or WebM · Max 20 MiB · Recommended: 5 minutes or less.” Hiển thị filename và kích thước file được chọn. Timer ghi âm có dạng `00:32 / 05:00`; khi tự dừng hợp lệ: “5-minute limit reached. Your recording is ready to process.” Nếu audio vượt giới hạn size, báo lỗi thay vì báo ready.
- Summary, decisions, action items và transcript hiển thị trực tiếp. Raw JSON nằm trong vùng disclosure mặc định đóng, mở bằng control native; không thêm output tabs. Khi summary thất bại, warning và transcript vẫn hiển thị trực tiếp.
- Summary thành công nhưng không có dữ liệu phải ghi “No decisions identified” / “No action items identified.” Partial success ghi “Transcript ready. Summary could not be generated.”; giải thích Process Meeting sẽ chạy lại toàn bộ pipeline nếu người dùng thử lại.
- Errors nằm gần input/section liên quan và có hướng xử lý ngắn: sửa key, chọn audio khác, cho phép microphone hoặc dùng Upload Audio. No speech gợi ý kiểm tra microphone hoặc chọn recording khác.
- Trong lúc chờ, nút ghi “Processing…” và hiển thị “Keep this page open; processing may take a few minutes.” Không hiển thị stage giả, phần trăm giả hoặc thời gian còn lại ước đoán; elapsed timer không bắt buộc.
- Dùng visible labels, keyboard focus rõ ràng, native buttons và speaker labels có cả text lẫn màu. Thông báo trạng thái dùng polite live region; lỗi cần hành động dùng alert, không announce timer mỗi giây.
- Copy giao diện dùng tiếng Anh thống nhất; ngôn ngữ summary theo cuộc họp. Giữ font hiện có và light theme. Chuyển tab input sẽ xóa audio/kết quả cũ; báo cạnh tabs “Switching input methods clears the current audio and results.”, không thêm confirmation modal.
- Audio preview vẫn là P1: một native audio player cho audio đang chọn, không autoplay; preview lỗi không chặn Process Meeting nếu file vẫn đạt điều kiện xử lý. Không tạo waveform hoặc custom player.
- Copy JSON vẫn là P1: copy đúng JSON đang hiển thị, báo “Copied.”; nếu clipboard thất bại, báo lỗi và giữ JSON có thể chọn/copy thủ công.

### 4.3. Design Direction

- Phong cách modern SaaS application.
- Clean, minimal, professional.
- Light theme.
- Phân cấp thông tin rõ ràng.
- Summary và action items phải dễ đọc.
- Speaker labels có màu phân biệt.
- Responsive cơ bản.
- Có empty, loading, completed và error states.

**Avoid:**

- Chat interface.
- Dashboard quá phức tạp.
- Sidebar hoặc navigation không cần thiết.
- Animations và visual effects không có giá trị.
- Component abstraction quá mức.

Ưu tiên một UI đơn giản nhưng hoàn chỉnh, không cần thiết kế quá mức cho bản demo dùng một lần.

## 5. Scope & Constraints

### In Scope

- Record audio trên browser.
- Upload file audio.
- Gemini 3.5 Transcribe transcription.
- Speaker diarization.
- Gemini 3.5 Flash-Lite summarization.
- Transcript viewer.
- Meeting summary.
- Decisions và action items.
- Raw JSON.
- Basic error handling.

### Out of Scope

- Authentication và user accounts.
- Database và persistent storage cho audio/kết quả hoặc phía server. Ngoại lệ được cho phép: lưu Gemini API key trong localStorage của browser.
- Meeting history.
- Realtime STT.
- Live collaboration.
- Voiceprint speaker identification.
- Transcript editing.
- Chat with transcript.
- PDF/DOCX export.
- Multiple meeting management.
- Advanced audio processing.
- Production deployment.
- Analytics và reporting.
- Automated tests hoặc test infrastructure.

Không tạo thêm tính năng ngoài scope nếu không thực sự cần để hoàn tất demo.

### Model-specific demo limits

STT bật verbatim, speaker diarization và word-level timestamps, không bật smart mode/custom vocabulary. Theo tài liệu Gemini, diarization hỗ trợ tối đa 8 speakers; gán speaker từ 3 người trở lên còn experimental, word timestamps có thể làm giảm độ chính xác. Audio có diarization/timestamps tối đa 30 phút ở provider; file upload vượt giới hạn bị từ chối rõ ràng, không chia chunk hoặc mở rộng demo. Giữ giới hạn sản phẩm 20 MiB, recording 5 phút và khuyến nghị upload tối đa 5 phút. Nguồn: [Transcribe guide](https://ai.google.dev/gemini-api/docs/transcribe).

## 6. Implementation Guidelines

Project Next.js đã được khởi tạo tại workspace hiện tại bằng:

`bun create next-app .`

Sử dụng cấu trúc và dependencies có sẵn:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Bun

**Do not recreate the project.**

Implementation expectations:

- Bắt đầu implement trực tiếp trong project hiện tại.
- Giữ nguyên framework và cấu hình sẵn có.
- Một Next.js app, không cần backend project riêng.
- Gemini API key được nhập qua UI và gửi đến Next.js server để gọi AI providers.
- Không lưu audio hoặc kết quả vào database hay local filesystem.
- Một pipeline xử lý chung cho Record và Upload.
- Không cần background jobs, queues hoặc WebSockets.
- Ưu tiên xử lý một request từ đầu đến cuối cho audio ngắn.
- Không tạo kiến trúc phức tạp hoặc tách nhiều component không cần thiết.

Coding Agent có quyền tự lựa chọn cách implement đơn giản nhất, miễn đáp ứng các yêu cầu sản phẩm.

## 7. Implementation Priority

### P0 — Must Have

1. API key configuration.
2. Record Audio.
3. Upload Audio.
4. Process Meeting.
5. Gemini 3.5 Transcribe transcription + diarization.
6. Gemini 3.5 Flash-Lite summarization.
7. Display summary, action items và transcript.
8. Display JSON.

### P1 — Nice to Have

- Audio preview.
- Copy JSON.
- UI polish.
- Optional elapsed processing timer (basic waiting feedback is required in §4.2).

Nếu gặp khó khăn hoặc vượt quá phạm vi thời gian, ưu tiên hoàn thiện P0 trước.

Không tự ý loại bỏ các chức năng P0. Nếu có blocker thực sự, báo rõ phần chưa hoàn thành.

## 8. Delivery Expectations

**Target:** Complete the MVP implementation within a 60-minute development timebox.

Coding Agent cần:

1. Sử dụng project Next.js hiện có.
2. Implement toàn bộ chức năng P0.
3. Giữ code đơn giản, dễ hiểu.
4. Không thực hiện automated tests, manual tests hoặc browser verification.
5. Không gọi Gemini API thật trong quá trình implement.
6. Không tạo test cases hoặc test documentation.
7. Không mở rộng tính năng ngoài phạm vi.
8. Bàn giao code và hướng dẫn chạy.
9. Nêu rõ các limitation hoặc blocker chưa giải quyết.

Sau khi implementation hoàn tất, người dùng sẽ tự chạy và kiểm tra.

## 9. Definition of Done

MVP sẵn sàng bàn giao khi:

- Ứng dụng Next.js đã được implement.
- Có hai phương thức Record và Upload Audio.
- Người dùng có thể nhập Gemini API key.
- Có luồng xử lý Gemini 3.5 Transcribe → Gemini 3.5 Flash-Lite.
- Transcript có speaker labels và timestamps.
- Summary có discussions, decisions và action items.
- Kết quả JSON được hiển thị.
- Không có database hoặc infrastructure không cần thiết.
- Có hướng dẫn khởi chạy bằng Bun.
- Những phần chưa được kiểm chứng được nêu rõ.

**Implementation completion is not equivalent to successful API verification. Testing is explicitly delegated to the user.**

---

## Final Product Principle

**Build the smallest complete AI Meeting Assistant that demonstrates the value of transcription, speaker diarization and meeting summarization.**

This is a one-time product experiment.

Prioritize end-to-end functionality, clear results and rapid implementation over production architecture, extensibility or unnecessary engineering practices.