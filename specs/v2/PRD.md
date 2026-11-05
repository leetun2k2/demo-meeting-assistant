# PRD — AI Meeting Assistant: Meeting Intelligence

**Version:** 2.1  
**Status:** Ready for Product Review  
**Scope:** Output Page & Post-Meeting Experience  
**Product Stage:** MVP / Proof of Concept

## 1. Product Overview

### 1.1. Problem

Sau cuộc họp, người dùng thường phải dành thời gian để:

- Đọc lại transcript dài để tìm thông tin quan trọng.
- Xác định ai đã nói gì và ai chịu trách nhiệm.
- Tổng hợp các quyết định đã thống nhất.
- Ghi nhận và theo dõi công việc được giao.
- Phát hiện những vấn đề chưa được giải quyết.
- Soạn email hoặc nội dung follow-up.

Transcript và bản tóm tắt thông thường chỉ giúp người dùng xem lại cuộc họp, chưa thực sự giúp họ xử lý công việc sau cuộc họp.

### 1.2. Product Goal

Biến kết quả cuộc họp thành một **Meeting Intelligence Workspace**, nơi người dùng nhanh chóng hiểu:

1. **What happened?** — Cuộc họp đã thảo luận những gì?
2. **Who said what?** — Ai đã nói gì?
3. **What was decided?** — Những quyết định nào đã được đưa ra?
4. **Who owns what?** — Ai chịu trách nhiệm cho từng công việc?
5. **What needs attention?** — Vấn đề nào còn tồn đọng?
6. **What's next?** — Cần thực hiện những hành động gì sau cuộc họp?

Ứng dụng cần tạo cảm giác như một AI Assistant thực sự hỗ trợ công việc, không đơn thuần là công cụ Speech-to-Text.

---

## 2. User Experience

### 2.1. User Journey

1. Người dùng hoàn tất ghi âm hoặc upload audio.
2. AI xử lý và phân tích cuộc họp.
3. Người dùng được chuyển đến Output Page.
4. Hệ thống tự động hiển thị các thông tin quan trọng.
5. Người dùng xem lại quyết định, công việc, người phụ trách và những vấn đề tồn đọng.
6. Người dùng có thể thực hiện các hành động follow-up trực tiếp từ kết quả.

### 2.2. Output Page Structure

**A. Meeting Overview**

Hiển thị thông tin tổng quan:

- Meeting title — tự động đặt tên theo nội dung.
- Executive Summary — tóm tắt 2–4 câu.
- Meeting duration, nếu có.
- Number of speakers.
- Number of decisions.
- Number of action items.

**B. Meeting Intelligence**

Khu vực nội dung chính:

- Key Discussion Points
- Decisions Made
- Action Items
- Transcript

**C. Additional Insights**

Các thông tin bổ sung:

- Risks & Blockers
- Unresolved Questions
- Key Moments
- Suggested Next Steps

**D. Quick Actions**

Các thao tác hỗ trợ công việc sau cuộc họp.

---

## 3. Functional Requirements

### FR-01 — Executive Summary

**Priority: P0**

AI tự động tạo một bản tóm tắt ngắn, phản ánh bản chất và kết quả của cuộc họp.

**Expected Behavior**

- Nội dung tóm tắt rõ ràng, dễ hiểu.
- Ưu tiên kết quả, quyết định và hướng hành động.
- Không chỉ liệt kê lại các chủ đề.
- Sử dụng ngôn ngữ chính của cuộc họp.
- Không đưa thông tin không có cơ sở từ nội dung cuộc họp.

Executive Summary phải là thông tin nổi bật nhất khi người dùng mở Output Page.

### FR-02 — Automatic Speaker Name Resolution

**Priority: P0**

Hệ thống tự động xác định tên người nói dựa trên nội dung và ngữ cảnh hội thoại.

**Expected Behavior**

- Nếu xác định được danh tính người nói với đủ bằng chứng, hiển thị tên người đó thay cho speaker ID.
- Nếu không đủ thông tin, sử dụng `Person 1`, `Person 2`, `Person 3`...
- Không suy đoán danh tính chỉ để thay thế nhãn Person.
- Tên của một người phải được sử dụng nhất quán trong toàn bộ kết quả.
- Không được gán nhầm tên người được nhắc đến thành tên người đang nói.

**Examples**

*Scenario A — Explicit Introduction*

Transcript:

> Person 1: Chào mọi người, mình là Minh, phụ trách dự án này.
>
> Person 2: Chào anh Minh, em là Hương, phụ trách frontend.

Expected output:

- Person 1 → Minh
- Person 2 → Hương

*Scenario B — Contextual Identification*

Transcript:

> Person 1: Hương, phần giao diện hiện tại thế nào?
>
> Person 2: Dạ, em đã hoàn thành phần chính rồi anh.
>
> Person 1: Cảm ơn Hương.

Expected output:

- Person 1 → Person 1
- Person 2 → Hương, nếu ngữ cảnh đủ rõ để xác định Hương là người đang trả lời.

*Scenario C — Insufficient Information*

Transcript:

> Person 1: Chúng ta bắt đầu nhé.
>
> Person 2: Đồng ý.

Expected output:

- Person 1 → Person 1
- Person 2 → Person 2

*Scenario D — Mentioned Person*

Transcript:

> Person 1: Anh Minh đã gửi báo cáo cho tôi hôm qua.

Expected output:

- Person 1 → Person 1

Không được tự xác định Person 1 là Minh chỉ vì tên Minh xuất hiện trong hội thoại.

**Name Resolution Rules**

1. Ưu tiên tính chính xác hơn tỷ lệ nhận diện.
2. Chỉ resolve khi có đủ bằng chứng trong hội thoại.
3. Giữ nguyên danh tính nhất quán xuyên suốt transcript.
4. Không hợp nhất hai người nói khác nhau chỉ vì có cùng tên.
5. Nếu xuất hiện thông tin mâu thuẫn hoặc không chắc chắn, giữ nhãn Person.
6. Tên đã resolve phải được áp dụng trên Transcript, Action Items và các nội dung liên quan.
7. Việc xác định tên từ nội dung cuộc họp không đồng nghĩa với xác thực danh tính bằng giọng nói.

**Success Criteria**

Người dùng có thể đọc transcript và nhanh chóng biết ai nói gì mà không phải tự đối chiếu speaker IDs, khi cuộc họp có đủ thông tin về danh tính.

### FR-03 — Key Discussion Points

**Priority: P0**

Trình bày các chủ đề quan trọng đã được thảo luận.

**Expected Behavior**

- Mỗi chủ đề được trình bày ngắn gọn.
- Loại bỏ nội dung lặp lại hoặc không quan trọng.
- Nhóm các trao đổi liên quan thành một chủ đề.
- Không biến từng câu nói thành một discussion point.

### FR-04 — Decisions Made

**Priority: P0**

Trích xuất những quyết định thực sự được đưa ra.

**Expected Behavior**

- Phân biệt quyết định với đề xuất hoặc ý kiến chưa được thống nhất.
- Mỗi quyết định thể hiện rõ nội dung được chốt.
- Không tự tạo quyết định.
- Có thể mở hoặc chuyển đến đoạn transcript liên quan để kiểm tra ngữ cảnh.

Nếu không có quyết định nào, hiển thị trạng thái phù hợp thay vì tạo nội dung giả.

### FR-05 — Action Items

**Priority: P0**

Chuyển các công việc được giao trong cuộc họp thành danh sách có thể theo dõi.

**Information**

| Field | Description |
|---|---|
| Task | Công việc cần làm |
| Assignee | Người phụ trách |
| Deadline | Thời hạn |
| Status | Trạng thái công việc |

**Expected Behavior**

- Tự động trích xuất action items.
- Hiển thị tên người phụ trách nếu đã resolve được.
- Giữ nhãn Person nếu chưa xác định được danh tính.
- Không tự tạo deadline khi chưa được đề cập.
- Người dùng có thể chỉnh sửa thông tin công việc.
- Người dùng có thể đánh dấu công việc hoàn thành.
- Có thể sao chép danh sách action items.

Các chỉnh sửa chỉ phục vụ phiên demo hiện tại, không yêu cầu lưu trữ lâu dài.

### FR-06 — Transcript Viewer

**Priority: P0**

Cung cấp transcript dễ đọc và dễ tra cứu.

**Expected Behavior**

- Hiển thị nội dung theo thứ tự thời gian.
- Hiển thị tên người nói sau khi đã resolve.
- Giữ nhãn Person đối với người chưa xác định được.
- Mỗi đoạn có timestamp.
- Phân biệt trực quan các người nói.
- Hỗ trợ tìm kiếm nội dung.
- Hỗ trợ lọc theo người nói.
- Cho phép chuyển tới vị trí tương ứng trong audio, nếu audio còn khả dụng.

Không yêu cầu chỉnh sửa toàn bộ transcript hoặc xác thực danh tính bằng giọng nói.

### FR-07 — Risks & Blockers

**Priority: P1**

AI xác định những rủi ro, trở ngại hoặc yếu tố phụ thuộc có ảnh hưởng đến công việc.

**Expected Behavior**

- Chỉ hiển thị vấn đề có căn cứ từ cuộc họp.
- Mô tả ngắn gọn và dễ hiểu.
- Ưu tiên những vấn đề ảnh hưởng đến quyết định hoặc action items.
- Không tự tạo rủi ro giả định và trình bày như một vấn đề đã được xác nhận.

### FR-08 — Unresolved Questions

**Priority: P1**

Xác định những câu hỏi hoặc vấn đề chưa được giải quyết trong cuộc họp.

**Expected Behavior**

- Chỉ hiển thị câu hỏi thực sự chưa có câu trả lời rõ ràng.
- Không lặp lại những vấn đề đã được thống nhất.
- Ưu tiên câu hỏi có ảnh hưởng đến bước tiếp theo.
- Có thể tham chiếu tới transcript liên quan.

### FR-09 — Key Moments

**Priority: P1**

Tóm tắt các mốc quan trọng trong cuộc họp.

**Expected Behavior**

Mỗi mốc gồm:

- Timestamp
- Tiêu đề ngắn
- Mô tả nội dung

Ví dụ:

- 00:45 — Budget discussion
- 02:15 — Final decision
- 04:30 — Task assignment

Người dùng có thể chọn một key moment để xem lại đoạn transcript tương ứng.

Chỉ hiển thị những mốc thực sự có căn cứ trong nội dung ghi âm.

### FR-10 — Suggested Next Steps

**Priority: P1**

AI đề xuất các bước tiếp theo giúp người dùng triển khai công việc sau cuộc họp.

Ví dụ:

- Xác nhận lại các quyết định quan trọng.
- Làm rõ câu hỏi chưa được giải quyết.
- Theo dõi action items sắp đến hạn.
- Chuẩn bị nội dung cho buổi họp tiếp theo.

**Expected Behavior**

- Đề xuất dựa trên kết quả cuộc họp.
- Ngắn gọn, có thể hành động.
- Phân biệt rõ AI recommendations với công việc đã được giao chính thức.
- Không tự thêm recommendation thành action item.

### FR-11 — Post-Meeting Actions

**Priority: P1**

Cung cấp các hành động giúp người dùng sử dụng kết quả cuộc họp ngay lập tức.

**Required Actions**

- Copy Meeting Summary
- Copy Action Items
- Download JSON
- Download Markdown
- Generate Follow-up Email

**Generate Follow-up Email**

Người dùng có thể tạo bản nháp email dựa trên:

- Nội dung cuộc họp.
- Các quyết định.
- Công việc được giao.
- Những bước tiếp theo.

Email cần ngắn gọn, chuyên nghiệp và sử dụng ngôn ngữ chính của cuộc họp.

Người dùng có thể xem và sao chép nội dung trước khi gửi bằng công cụ khác.

Không yêu cầu tích hợp Gmail, Outlook hoặc tự động gửi email.

---

## 4. UX & Design Expectations

### Design Goal

Output Page phải tạo cảm giác **AI đã thực sự hiểu cuộc họp và biến nội dung thành thông tin hữu ích**, không phải chỉ định dạng lại transcript.

### Visual Hierarchy

**Level 1 — Most Important**

- Executive Summary
- Key Decisions
- Action Items

**Level 2 — Supporting Insights**

- Discussion Points
- Risks & Blockers
- Unresolved Questions
- Suggested Next Steps

**Level 3 — Reference Information**

- Transcript
- Key Moments
- Raw JSON

### Interaction Principles

- Người dùng nhìn vào là hiểu ngay kết quả cuộc họp.
- Thông tin quan trọng xuất hiện trước.
- Các nội dung chi tiết dễ truy cập nhưng không chiếm quá nhiều không gian.
- Quick Actions phải thực sự có chức năng.
- Hạn chế thành phần trang trí không mang lại giá trị.
- Các khu vực không có dữ liệu cần có empty state phù hợp.

### Visual Direction

- Modern, minimal enterprise SaaS.
- Professional and productivity-oriented.
- Compact, readable, structured.
- Clear visual grouping.
- Responsive layout.
- Không biến trang thành một dashboard KPI phức tạp.

---

## 5. Scope & Priorities

### P0 — Core Meeting Intelligence

Bắt buộc cho demo:

1. Executive Summary
2. Automatic Speaker Name Resolution
3. Key Discussion Points
4. Decisions Made
5. Action Items
6. Transcript Viewer

### P1 — Enhanced Productivity

Thực hiện sau khi P0 hoàn chỉnh:

1. Risks & Blockers
2. Unresolved Questions
3. Key Moments
4. Suggested Next Steps
5. Post-Meeting Actions

### Out of Scope

- Authentication và user management.
- Meeting history.
- Persistent storage.
- Speaker voiceprint enrollment.
- Biometric speaker verification.
- External project management integrations.
- Automatic email sending.
- Workspace collaboration.
- Advanced analytics.
- Production-grade task management.

---

## 6. Acceptance Criteria

| ID | Acceptance Criteria |
|---|---|
| AC-01 | Output Page hiển thị Executive Summary rõ ràng |
| AC-02 | AI resolve tên người nói khi có đủ bằng chứng |
| AC-03 | Người nói chưa rõ danh tính hiển thị Person N |
| AC-04 | Không gán tên khi thông tin không đủ hoặc mâu thuẫn |
| AC-05 | Tên người nói nhất quán giữa Transcript và Action Items |
| AC-06 | Decisions được phân biệt với đề xuất chưa thống nhất |
| AC-07 | Action Items có task, assignee, deadline và status |
| AC-08 | Người dùng có thể chỉnh sửa và hoàn thành action items trong phiên hiện tại |
| AC-09 | Transcript có speaker, timestamp, search và filter |
| AC-10 | Risks và unresolved questions không chứa thông tin không có căn cứ |
| AC-11 | Key Moments liên kết được đến nội dung transcript tương ứng |
| AC-12 | Người dùng có thể copy hoặc export kết quả |
| AC-13 | Người dùng có thể tạo và sao chép follow-up email |
| AC-14 | Nội dung phân tích sử dụng ngôn ngữ chính của cuộc họp |
| AC-15 | Trải nghiệm ưu tiên kết quả hữu ích thay vì chỉ hiển thị văn bản |

---

## 7. Product Success Criteria

Đối với bản demo, đánh giá thành công dựa trên ba yếu tố:

**1. Understanding**

AI nắm bắt đúng nội dung cuộc họp, phân biệt người nói và tự nhận diện tên khi có cơ sở.

**2. Actionability**

Người dùng có thể nhanh chóng xác định quyết định, công việc, người phụ trách và các bước cần làm tiếp theo.

**3. Usability**

Người dùng có thể hiểu kết quả và sử dụng các chức năng post-meeting mà không cần hướng dẫn phức tạp.

---

## 8. Definition of Done

Output Page sẵn sàng để người dùng đánh giá khi:

- Các tính năng P0 đã được triển khai.
- Speaker Name Resolution được áp dụng nhất quán.
- Các insight quan trọng được tổ chức rõ ràng.
- Action Items có tương tác cơ bản.
- Transcript có khả năng tra cứu.
- Những tính năng P1 được ưu tiên theo giá trị demo.
- Không mở rộng sang các chức năng quản lý cuộc họp ngoài scope.

Việc đánh giá và kiểm thử thực tế do người dùng thực hiện sau khi hoàn tất implementation.

**Final Product Principle**

AI Meeting Assistant không chỉ giúp người dùng biết *đã nói những gì*, mà còn giúp họ hiểu *ai đã nói, điều gì được quyết định, ai chịu trách nhiệm và cần làm gì tiếp theo*.