# Verification Results — v4

Ngày thực hiện: 2026-11-06. Revision triển khai: chưa commit, dựa trên HEAD `5660e5f6636bdba0c0790d9789be3008aae61f09` + diff làm việc (`app/results/page.tsx`, `components/MeetingWorkspace.tsx`, `components/OutputPage.tsx`, `lib/meeting/display.ts`, `lib/meeting/export.ts`, `lib/meeting/gemini.ts`, file mới `lib/meeting/speakerNames.ts`, `lib/meeting/cacheCompat.ts`). Môi trường: macOS local, `bun dev` tại `http://localhost:3000`, Chrome qua tiện ích Claude-in-Chrome, Gemini API key đã có sẵn trong localStorage trình duyệt của người dùng (không được agent nhập, không bị in ra).

Nguồn: [PRD](PRD.md), [Technical Design](Technical-Design.md), [Test Specification](Test-Specification.md).

## Tóm tắt kết quả

| Hạng mục | Kết quả |
|---|---|
| Static checks (`tsc --noEmit`, `lint`, `build`) | PASS |
| Code review | 2 phát hiện CONFIRMED (mức Medium), chi tiết bên dưới |
| TC-001 | NOT_RUN — thiếu F1 (audio 2 giọng thật); có bằng chứng gián tiếp (xem ghi chú) |
| TC-002 | PASS |
| TC-003 | PASS |
| TC-004 | PARTIAL — nhất quán cấu trúc PASS; nhất quán prose FAIL (Finding #2) |
| TC-005 | PARTIAL — dữ liệu đúng, nhưng UI chọn "Custom name…" có lỗi hiển thị (Finding #1) |
| TC-006 | PARTIAL — retry không re-upload đã xác nhận qua UI thật; lỗi provider thật quan sát được (tại TC-007), nhưng chưa bấm nút Retry Summary trực tiếp trên một kết quả summary_failed thật |
| TC-007 | PASS (có phân tích độc lập) |
| TC-008 | PASS |

**Acceptance verdict: NOT_READY** — do 2 lỗi CONFIRMED ảnh hưởng trực tiếp FR-02/AC-05 (TC-004) và trải nghiệm sửa assignee (TC-005/AC-06), cộng với TC-001 và một phần TC-006 chưa chạy được do thiếu tiền đề (audio thật, network interception). Không có lỗi nào làm sai lệch dữ liệu transcript/raw label; cả hai lỗi đều ở lớp hiển thị/phục hồi cache.

## Code review — phát hiện

### Finding #1 (CONFIRMED, Medium) — Dropdown "Custom name…" không giữ trạng thái đã chọn

- **File**: `components/OutputPage.tsx:1002` (`<select value={isKnownAssigneeOption(item.assignee) ? item.assignee : "__custom__"} ...>`) và `components/OutputPage.tsx:416` (`handleAssigneeSelectChange`).
- **Mô tả**: Khi một task đang có assignee là một speaker đã biết (ví dụ "Speaker 1"), nếu người dùng chọn "Custom name…" trong dropdown, `handleAssigneeSelectChange` chỉ mở ô nhập tên tự do (`setCustomAssigneeIdx(idx)`) mà **không** đổi `item.assignee`. Vì `<select value=...>` được điều khiển hoàn toàn bởi `item.assignee`, React render lại dropdown về đúng lựa chọn cũ ("Khánh (Person 1)") ngay sau khi người dùng vừa chọn "Custom name…", trong khi ô nhập tên tự do vẫn xuất hiện bên dưới.
- **Bằng chứng tái hiện** (trình duyệt thật, fixture dựng thủ công, không cần AI key):
  1. Set `localStorage['meeting-assistant.lastResult']` với một `completed` result có `actionItems[0].assignee = "Speaker 1"`.
  2. Dispatch sự kiện `change` hợp lệ trên `<select>` để chọn `"__custom__"`.
  3. Đọc lại `select.value` ngay sau đó: **vẫn là `"Speaker 1"`**, không phải `"__custom__"` — xác nhận dropdown "bật lại" lựa chọn cũ dù input tự do đã hiện ra (`customInputVisible: true`).
- **Tác động**: Người dùng không thấy phản hồi trực quan rằng họ đã chọn "Custom name…" — gây nhầm lẫn khi demo AC-06/TC-005 (sửa assignee), dù dữ liệu cuối cùng (sau khi gõ tên và blur) vẫn lưu đúng — xác nhận riêng: gõ tên thật qua bàn phím thật rồi click ra ngoài, `localStorage` cập nhật đúng `assignee: "ThanhReal"`, các task khác và `speakerNames` không đổi.
- **Đề xuất sửa** (để bàn giao lại cho implementation): tách trạng thái "đang ở chế độ custom" khỏi `item.assignee` khi tính `value` của `<select>`, ví dụ `value={customAssigneeIdx === idx ? "__custom__" : (isKnownAssigneeOption(item.assignee) ? item.assignee : "__custom__")}`.

### Finding #2 (CONFIRMED, Medium-High) — Phục hồi cache không chuẩn hóa lại prose theo bảng tên

- **File**: `lib/meeting/cacheCompat.ts` (`normalizeStoredSpeakerNames` — chỉ bổ sung bảng `speakerNames`, không gọi `applySpeakerNamesToSummary`/`normalizeSpeakerMentions`), dùng tại `app/results/page.tsx:34` và `components/MeetingWorkspace.tsx:146`.
- **Mô tả**: Technical Design §3 yêu cầu rõ: "Chuẩn hóa prose lúc restore theo bảng hợp lệ". Implementation Plan T3 lặp lại yêu cầu này. Bản vá hiện tại chỉ bổ sung/ sửa bảng `speakerNames` khi phục hồi cache (schemaVersion 3), nhưng **không** chạy lại `normalizeSpeakerMentions` trên các trường prose (`executiveSummary`, `discussions`, `decisions[].text`, `risks[].text`, `unresolvedQuestions[].text`, `keyMoments[].title/description`, `nextSteps`, `followUpEmail`) theo bảng đã được chuẩn hóa/bổ sung đó.
- **Bằng chứng tái hiện** (trình duyệt thật): nạp một `completed` result (schemaVersion 3) có `executiveSummary: "Speaker 1 va Speaker 2 trung ten. Person 3 chua ro danh tinh."` và `speakerNames` resolve Speaker 1 = Speaker 2 = "Khánh" (trùng tên, cần suffix `(Person N)`), Speaker 3 = null, qua `/results`:
  - Transcript, bộ lọc speaker, speaking breakdown, assignee dropdown và cả **Export Markdown** đều hiển thị đúng và nhất quán: "Khánh (Person 1)", "Khánh (Person 2)", "Person 3".
  - Nhưng Executive Summary trên trang **và** trong file Markdown xuất ra vẫn giữ nguyên **"Speaker 1 va Speaker 2 trung ten. Person 3 chua ro danh tinh."** — không được chuẩn hóa.
  - Đối chứng: cùng một luồng nhưng đi qua tạo mới thật (retry một `transcribed` result qua nút "Generate Summary", live AI, không phải cache phục hồi) cho executiveSummary đúng là "Lan và Person 2 đã họp..." — nghĩa là `applySpeakerNamesToSummary` hoạt động đúng tại thời điểm tạo mới; lỗi chỉ nằm ở đường phục hồi cache.
- **Tác động**: Vi phạm FR-02 (tên phải nhất quán trên "transcript, bộ lọc speaker và các nội dung liên quan... executive summary...") và AC-05/AC-08 đối với bất kỳ kết quả nào được phục hồi từ cache mà prose gốc chưa khớp bảng tên hiện tại (cache cũ thiếu bảng, cache có bảng không đầy đủ được bổ sung, hoặc bất kỳ bản ghi nào prose chứa "Speaker N"/"Person N" thô). Không ảnh hưởng raw transcript/JSON (vẫn đúng theo thiết kế).
- **Đề xuất sửa**: sau khi `buildSpeakerNameTable` tạo bảng cuối cùng trong `normalizeStoredSpeakerNames`, áp dụng `normalizeSpeakerMentions` (hoặc tương đương `applySpeakerNamesToSummary`) lên các trường prose của `summary` trước khi trả về, đảm bảo idempotent (đã test: hàm bảng hiện tại idempotent, nhưng áp dụng thêm bước chuẩn hóa prose cần giữ tính đó).

### Ghi chú phụ (không phải finding v4, không chặn)

- Phát hiện 2 byte NUL (`\x00`) tại `components/OutputPage.tsx` dòng khởi tạo `transcriptFilterKey` (vốn có từ trước, xác nhận bằng `git show HEAD`), khiến `grep`/`rg` coi file là binary. Không phải do thay đổi v4, không ảnh hưởng hành vi (NUL vẫn hoạt động như một ký tự phân tách hợp lệ trong template string). Không sửa trong lượt review này vì ngoài phạm vi v4; nêu để người triển khai lưu ý nếu dùng công cụ tìm kiếm văn bản trên file này.

## Kết quả theo từng ca (Test Specification)

### TC-001 — Tự giới thiệu, gọi–đáp, tên xuất hiện muộn — **NOT_RUN**

Không có audio F1 (hai giọng thật) trong môi trường này — tiền đề này đã được Requirement Findings/Test Spec ghi nhận là "chưa có" từ giai đoạn planning. Không có quyền/khả năng ghi âm thay cho người dùng.

Bằng chứng gián tiếp (không thay thế TC-001, chỉ hỗ trợ đánh giá logic suy luận): đã chạy một transcript văn bản thật qua `/api/summarize-meeting` live mô phỏng đúng mẫu "tự giới thiệu + gọi tên để xác nhận + đáp lời xác nhận rõ":
```
Speaker 1: "Chào mọi người, mình là Lan."
Speaker 2: "Lan ơi, bạn confirm giúp mình là bạn Lan và sẽ làm phần UI nhé."
Speaker 1: "Đúng rồi, mình là Lan, mình sẽ làm phần UI."
```
→ Speaker 1 = "Lan" (đúng), Speaker 2 = null (đúng, Speaker 2 không tự nhận danh tính) — thực hiện qua UI thật (nút "Generate Summary"), xác nhận đúng 1 request `POST /api/summarize-meeting` (network log), transcript/timestamp giữ nguyên, executiveSummary dùng đúng "Lan"/"Person 2". Vẫn cần ghi âm thật với diarization thật để đóng TC-001/AC-01/AC-02 chính thức.

### TC-002 — Không suy diễn chỉ từ tên được nhắc — **PASS**

Live, key thật:
- Base case (F2): `Speaker 1: "Minh đã gửi tài liệu cho mọi người rồi nhé."`, `Speaker 2: "Long demo luôn đi."`, `Speaker 3: "Mạng đang chậm quá."` → `speakerNames` = `[null, null, null]`. Không tạo speaker "Minh"/"Long" mới. Đúng yêu cầu.
- Biến thể mâu thuẫn thật (hai tự giới thiệu khác tên, không có câu sửa lời): `Speaker 1: "...mình là Hùng, phụ trách backend."` rồi sau đó `Speaker 1: "Mình là Tuấn, sẽ báo cáo..."` → `Speaker 1: null`. Đúng yêu cầu ("bằng chứng mâu thuẫn → null").

Ghi chú (không phải lỗi, chỉ là quan sát để người đánh giá biết): một biến thể đầu tiên có câu tự sửa lời rõ ràng ("À quên, mình là Tuấn, xin lỗi mọi người") khiến model trả về "Tuấn" thay vì null. Đây là một case tự-sửa-lời (retraction), không phải "hai tự giới thiệu mâu thuẫn ngang hàng" mà Test Spec mô tả — không tính là fail vì fixture ban đầu không phản ánh đúng kịch bản mong muốn; đã dựng lại fixture sát hơn và model trả null đúng như kỳ vọng.

### TC-003 — Ownership khác người nói — **PASS**

Live: `Speaker 1` tự giới thiệu "Khánh", rồi 3 câu: tự nhận sửa lỗi đăng nhập, giao việc cho "Minh", và một câu chưa chốt ai làm ("Cần kiểm tra lại báo cáo doanh thu, chưa chốt ai làm").

Kết quả: `speakerNames` Speaker 1 → "Khánh"; `actionItems` = [{assignee: "Speaker 1" (raw key, hiển thị "Khánh"), task sửa lỗi đăng nhập}, {assignee: "Minh", task viết tài liệu}]. Không có action item thứ ba (model không trích xuất câu "chưa chốt ai làm" thành task) — hợp lệ theo Test Spec ("Nếu model bỏ một task cần thiết thì ghi chính xác, không sửa output trước khi đánh giá"); quan trọng nhất, model **không** gán nhầm việc đó cho Khánh. Không tạo speaker "Minh" giả.

### TC-004 — Nhất quán bề mặt và tên trùng — **PARTIAL**

Fixture: 3 speaker, Speaker 1 = Speaker 2 = "Khánh" (trùng tên thật), Speaker 3 = null; actionItems tự nhận/giao Minh/Unknown; nạp qua `localStorage` + `/results`.

- PASS: transcript, bộ lọc speaker (`All Speakers / Khánh (Person 1) / Khánh (Person 2) / Person 3`), speaking breakdown, dropdown assignee (bảng + modal "Add Task"), Raw JSON (giữ raw label + bảng đầy đủ), Export Markdown (bảng Action Items + Transcript) — tất cả hiển thị "Khánh (Person 1)"/"Khánh (Person 2)"/"Person 3" nhất quán và đúng.
- FAIL (Finding #2): Executive Summary trên trang và trong Markdown xuất ra giữ nguyên text thô "Speaker 1 va Speaker 2 trung ten. Person 3 chua ro danh tinh." thay vì được chuẩn hóa — vi phạm nhất quán prose theo FR-02/AC-05.

### TC-005 — Sửa assignee độc lập — **PARTIAL**

- PASS: sửa assignee task đầu (chọn "Custom name…" rồi gõ tên thật "ThanhReal" bằng bàn phím thật, blur) → chỉ `actionItems[0].assignee` đổi; `speakerNames`, raw transcript, 2 task còn lại không đổi (xác nhận qua đọc trực tiếp `localStorage` sau thao tác).
- FAIL (Finding #1): khi vừa chọn "Custom name…", dropdown hiển thị bật lại lựa chọn cũ thay vì phản ánh lựa chọn "Custom name…" vừa chọn — gây nhầm lẫn trực quan dù dữ liệu cuối cùng vẫn đúng khi gõ xong và blur.
- Chưa test: reload sau khi sửa (dữ liệu đã nằm trong `localStorage` nên dự kiến giữ, nhưng chưa reload xác nhận trực tiếp trong lượt này).

### TC-006 — Lỗi summary và retry — **PARTIAL**

- PASS: dựng một `transcribed` result (chưa có summary) với transcript tự giới thiệu + gọi–đáp, bấm "Generate Summary" thật trên UI → network log xác nhận đúng 1 request `POST /api/summarize-meeting`, không có request nào tới `/api/process-meeting`; kết quả cập nhật summary + speakerNames cùng lúc; transcript/timestamp giữ nguyên.
- PASS (gián tiếp, không qua nút Retry): khi chạy TC-007 trên mẫu F4, gặp 2 lần lỗi provider thật `Gemini request failed (503)...` liên tiếp trước khi lần thứ 3 thành công — xác nhận lỗi thật được hiển thị nguyên văn (`summaryError`), `status: "summary_failed"`, không có tên giả được chèn vào.
- Chưa test trực tiếp: bấm nút "Retry Summary" trên một result đã ở trạng thái `summary_failed` thật (có `summaryError`) và xác nhận UI chuyển đúng sang `completed` — không có công cụ chặn network theo điều kiện (network interception) trong bộ công cụ hiện tại để ép lỗi rồi retry ngay trên cùng một phiên UI; TC-008(c) đã xác nhận riêng phần "xem được transcript với nhãn trung lập khi summary_failed" bằng fixture tĩnh.

### TC-007 — Mẫu thực đủ 322 đoạn — **PASS**

Chạy nguyên transcript 322 đoạn từ `extracted-example.json` qua `/api/summarize-meeting` live (2 lần đầu gặp lỗi provider thật `503 — high demand`, lần 3 thành công; không chỉnh sửa transcript, không cắt bớt).

Kết quả: `speakerNames` = `[Speaker 1: null, Speaker 2: null, Speaker 3: null]`.

**Đối chiếu độc lập** (tự đọc transcript gốc, không dùng output AI làm đáp án): rà toàn bộ các đoạn nhắc "Khánh", "Long", "Dũng", "Sỹ" (tổng cộng ~35 lượt nhắc). Phát hiện:
- "Khánh" được Speaker 1 và Speaker 3 gọi trực tiếp (vai "em"/2nd person) rất nhiều lần ("Khánh ra chỗ team", "Khánh demo cái đi", "Ủa Khánh xong ba cái rồi nè" → Speaker 2 đáp "Xong rồi rồi rồi đúng rồi."), gợi ý Speaker 2 có thể là Khánh — nhưng **không có lần nào** Speaker 2 tự nhận ("mình là Khánh") hay xác nhận rõ ràng theo đúng cách được gọi; các câu đáp chỉ là tiếp tục nội dung kỹ thuật, không phải xác nhận danh tính rõ ràng. Đây đúng là ca "chỉ gọi tên, câu đáp không chắc chắn là của người được gọi" mà PRD §5/FR-01 liệt kê là **chưa đủ căn cứ**.
- "Long", "Dũng", "Sỹ" đều chỉ xuất hiện dưới dạng gọi trực tiếp hoặc nhắc đến người thứ ba, không có tự giới thiệu, và người đáp sau khi gọi tên không nhất quán (có lúc chính người gọi tự nói tiếp, có lúc người khác nói tiếp) — không đủ căn cứ theo đúng tiêu chuẩn PRD.
- Kết luận: kết quả `null` cho cả 3 speaker là **hợp lý và đúng theo quy tắc thận trọng** của FR-01, không phải model bỏ sót bằng chứng rõ ràng. Quan trọng nhất đã xác nhận: **không có tên nào trong 4 tên được nhắc bị gán nhầm cho một speaker chỉ vì tên đó xuất hiện** — đúng tiêu chí chính của AC-09. Test Spec cũng nêu rõ mẫu này "không bắt buộc nhận ra ít nhất một tên; TC-001 chịu trách nhiệm ca dương."

### TC-008 — Cache tương thích và ghi lỗi — **PASS**

Live, 5 fixture dựng tay theo đúng mô tả, nạp qua `localStorage['meeting-assistant.lastResult']` + reload `/results` và `/`:

| Fixture | Kỳ vọng | Kết quả |
|---|---|---|
| (a) thiếu `speakerNames` hoàn toàn | Mở được, Person N, không gọi AI | PASS — hiển thị "Person 1"/"Person 2" |
| (b) bảng thiếu entry (chỉ có Speaker 1) | Entry thiếu → null, entry có giữ nguyên | PASS — "Khánh"/"Person 2" |
| (c) `summary: null`, `status: "summary_failed"` | Xem được transcript, lỗi thật, không tên giả | PASS — hiển thị `summaryError` thật, "Summary unavailable" |
| (d) `resolvedName` sai kiểu (number) | Từ chối toàn bộ, không crash | PASS — rơi về "No meeting results yet" |
| (e) `schemaVersion: 2` | Từ chối toàn bộ, không crash | PASS — rơi về "No meeting results yet" |

`components/MeetingWorkspace.tsx` (trang chủ) phản ánh đúng theo từng fixture: fixture hợp lệ (a) → nút "View Stored Results →"; fixture bị từ chối (e) → nút "View Results →" (mặc định, không coi là có kết quả cũ).

## Giới hạn chưa xác nhận

- TC-001 chính thức (audio 2 giọng thật) chưa chạy được — cần người dùng cung cấp file ghi âm hoặc tự ghi âm qua UI.
- TC-005: chưa test reload sau khi sửa assignee (dữ liệu nằm trong `localStorage`, dự kiến giữ nguyên theo cơ chế `persist()` có sẵn, nhưng chưa xác nhận trực tiếp).
- TC-006: chưa bấm nút "Retry Summary" trực tiếp trên một kết quả `summary_failed` thật trong cùng một phiên UI (thiếu công cụ chặn network theo điều kiện trong bộ công cụ hiện có); đã có bằng chứng tương đương một phần qua lỗi provider thật gặp ở TC-007 và qua luồng "Generate Summary" từ trạng thái `transcribed`.
- Không đo lường độ chính xác tổng thể của việc nhận diện tên trên nhiều cuộc họp khác; đây không phải mục tiêu của v4 (PRD mục "Ngoài phạm vi").

## Bổ sung notes (FR-05–07) — triển khai và kiểm chứng ngày 2026-11-06

Revision triển khai: chưa commit, trên HEAD `28a54c1a617d4e16227ca9298fe42f76172a3b96` + diff làm việc hiện tại (`lib/types.ts`, `lib/constants.ts`, `lib/meeting/notesLimit.ts` mới, `lib/meeting/gemini.ts`, `lib/meeting/storedResult.ts`, `app/api/summarize-meeting/route.ts`, `components/MeetingWorkspace.tsx`, `components/OutputPage.tsx`, `app/results/page.tsx`). Không đổi `app/api/process-meeting/route.ts` (đúng thiết kế: notes không ảnh hưởng bước extraction). Môi trường: macOS local, `bun run dev` tại `http://localhost:3000`, Chrome qua Claude-in-Chrome.

Static checks: `bunx tsc --noEmit`, `bun run lint`, `bun run build` — cả ba **PASS**, không cảnh báo mới.

Kiểm chứng chức năng live (Gemini API key thật có sẵn trong trình duyệt trước khi test; xem sự cố cuối mục):

| Ca | Kết quả |
|---|---|
| TC-009 (notes đầu vào, mapping) | PASS một phần — xác nhận qua fixture dựng tay ở boundary summary (xem dưới), không phải qua toàn bộ audio chain |
| TC-010 (sửa notes, regenerate thành công) | PASS |
| TC-011 (regenerate lỗi, giữ kết quả cũ, retry) | PASS cho nhánh lỗi+giữ kết quả; chưa test double-click/điều hướng khỏi trang giữa chừng |
| TC-012 (nguồn dữ liệu, notes mơ hồ/độc hại) | NOT_RUN — chưa chạy đủ 4 biến thể (a)-(d) của fixture N |
| TC-013 (giới hạn/tương thích) | PASS một phần — xem chi tiết dưới |

Fixture dựng tay (tương đương fixture N của Test Spec, bơm thẳng vào `localStorage['meeting-assistant.lastResult']` làm một `completed` result có sẵn thay vì chạy qua audio thật):

1. **TC-010 — sửa notes rồi Regenerate thành công**: kết quả completed ban đầu có `speakerNames = {Speaker 1: Khánh, Speaker 2: Long}` với `meetingNotes = summaryNotes = "Speaker 1 là Khánh; Speaker 2 là Long; Nexus là tên dự án."`. Sửa notes thêm `"Speaker 1 là Lan."` (đính chính ngược với suy luận ban đầu) → banner "Notes changed since this summary — Regenerate to apply them." hiện đúng lúc → bấm Regenerate → một request `POST /api/summarize-meeting` live. Kết quả: `speakerNames[0].resolvedName = "Lan"` (đè đúng theo đính chính rõ ràng mới nhất), toàn bộ prose/summary/speaking-breakdown dùng "Lan" nhất quán, transcript gốc và timestamp không đổi, `meetingNotes === summaryNotes` sau khi áp dụng (banner biến mất đúng), Raw JSON xuất đủ `meetingNotes`/`summaryNotes`. Tên người thứ ba "Minh" được nhắc trong transcript không bị biến thành speaker.
2. **TC-011 — Regenerate lỗi giữ nguyên kết quả cũ**: từ trạng thái completed ở trên, sửa notes thêm `"Long là leader."`, cố ý đặt API key sai trong `localStorage`, bấm Regenerate. Kết quả: lỗi `Gemini request failed (400). API key not valid...` hiển thị tại chỗ ("Last attempt failed: ..."), **summary/speakerNames/summaryNotes cũ được giữ nguyên nguyên vẹn**, `status` vẫn `"completed"`, banner "Notes changed..." vẫn đúng (notes mới chưa được áp dụng). Sau đó không kiểm tra lại nhánh retry thành công với key hợp lệ do sự cố key ở dưới.
3. **TC-013 (một phần)**: xác nhận field `meetingNotes`/`summaryNotes` thiếu ở cache cũ không làm validator từ chối toàn bộ result (optional field, dùng `?? ""` tại nơi hiển thị). Chưa test rõ ràng: POST với notes 10.000/10.001 ký tự, `null`/object notes, cache sai kiểu cho hai field này, UI nhập quá giới hạn trên `maxLength`.

### Sự cố trong lúc kiểm chứng — mất giá trị Gemini API key cũ trong trình duyệt

Khi dựng ca TC-011, agent đã ghi đè `localStorage['meeting-assistant.geminiApiKey']` bằng một chuỗi giả để ép lỗi provider, nhưng **không lưu lại giá trị thật trước đó** — giá trị gốc không còn khôi phục được từ trong trình duyệt. Sau khi test xong, agent đã xóa field này (và xóa fixture `lastResult` giả dùng để test) để tránh để lại dữ liệu giả/khóa hỏng. **Người dùng cần nhập lại Gemini API key thật của mình** tại trang chủ trước khi dùng lại ứng dụng; đây là bản sao client-side của key, không phải key gốc trên Google AI Studio nên không có rủi ro mất quyền truy cập, chỉ mất bản lưu cục bộ trong trình duyệt này.

## Giới hạn chưa xác nhận — phần notes

- TC-009 đầy đủ (qua audio thật, không phải fixture bơm thẳng cache) chưa chạy — cần audio F1 như TC-001 gốc.
- TC-012 (notes chỉ liệt kê tên, notes tự mâu thuẫn, notes chứa chỉ dẫn độc hại/yêu cầu bịa quyết định) chưa chạy; đây là ca quan trọng nhất để xác nhận an toàn chống prompt-injection qua notes.
- TC-013: giới hạn 10.000/10.001 ký tự ở route và validation kiểu dữ liệu sai (`null`/object) chưa có bằng chứng request thật; chỉ xác nhận qua đọc code (`app/api/summarize-meeting/route.ts`) rằng logic kiểm tra tồn tại trước lời gọi provider.
- Chưa test khóa textarea/nút trong lúc `retryingSummary` đang pending bằng quan sát trực tiếp (request hoàn tất quá nhanh để bắt kịp qua công cụ trình duyệt tự động); đã xác nhận qua đọc code rằng các control liên quan (`textarea`, checkbox, select, nút trạng thái, nút Add Task) đều có `disabled={retryingSummary}`.
- Chưa test ca double-click Regenerate hoặc điều hướng khỏi `/results` giữa lúc một request đang chờ (token guard `generateTokenRef`/`mountedRef`/so sánh `processedAt` mới chỉ được xác nhận qua đọc code, chưa qua kịch bản race-condition thật).


## Triển khai và kiểm chứng v4 — 2026-11-06

### 1. Triển khai S1 (suy luận danh tính từ roster và hội thoại)

- **`lib/meeting/gemini.ts`**:
  - `buildSpeakerNamesInstruction`: Điều chỉnh chỉ dẫn suy luận kết hợp danh sách tên/vai trò trong notes với toàn bộ diễn biến cuộc họp; cho phép sử dụng ngữ cảnh gọi–đáp tự nhiên, tiếp tục demo, vai trò/trách nhiệm và bằng chứng muộn, kể cả tên chỉ có trong notes. Không đòi hỏi câu đáp phải nhắc lại tên ("Tôi là Bob") hoặc câu giới thiệu trực tiếp. Giữ vững quy tắc: không gán theo thứ tự danh sách/số lượng, không gán tên người thứ ba được nhắc, không gộp nhãn, giữ nguyên tên/dấu tiếng Việt từ notes/transcript và trả `null` khi mâu thuẫn hoặc không đủ căn cứ.
  - `buildNotesInstruction`: Xác định rõ danh sách người tham gia và vai trò trong notes là dữ liệu ứng viên để đối chiếu với transcript, không phải mapping cố định theo vị trí. Cho phép xử lý đính chính rõ ("Speaker 1 is Alex", "Person 2 là Bob"). Giữ ranh giới an toàn: nội dung chỉ có trong notes được trích xuất như bối cảnh bổ sung, không biến thành lời nói/quyết định thực tế trong cuộc họp và không gán timestamp/keyMoment giả.
- **`lib/constants.ts`**:
  - `NOTES_PLACEHOLDER`: Đổi sang `"Cuộc họp gồm Alex (backend), Bob (frontend), Alice (PM). Nexus là tên dự án."` phản ánh bối cảnh roster tự nhiên.
  - `NOTES_HELPER_TEXT`: Đổi sang `"Optional. Add participant names, roles and meeting context. AI combines these notes with the conversation to identify speakers automatically."` làm rõ AI tự kết hợp danh sách với hội thoại, không bắt người dùng nhập mapping thủ công.

### 2. Triển khai S2 (nhất quán kết quả và xử lý Finding #2)

- **`lib/meeting/cacheCompat.ts`**:
  - Đã khắc phục triệt để **Finding #2**: `normalizeStoredSpeakerNames` sau khi dựng bảng `speakerNames` chuẩn hóa qua `buildSpeakerNameTable`, tiếp tục chạy `normalizeSpeakerMentions` lên toàn bộ các trường văn bản prose của summary (`executiveSummary`, `title`, `themes`, `keyTakeaways`, `discussions`, `decisions[].text`, `risks[].text`, `unresolvedQuestions[].text`, `keyMoments[].title/description`, `nextSteps`, `followUpEmail.subject/body`).
  - Đã kiểm chứng tính bất biến và idempotent: nạp fixture chứa tên trùng ("Khánh (Person 1)", "Khánh (Person 2)") và "Person 3", kết quả các trường prose được chuẩn hóa đồng bộ; lần chạy thứ hai trả về kết quả giống hệt; `isStoredMeetingResult` trả về `true`.
- **`components/OutputPage.tsx`**:
  - Đối chiếu **Finding #1**: `customAssigneeIdx === idx ? "__custom__" : (isKnownAssigneeOption(item.assignee) ? item.assignee : "__custom__")` đã được áp dụng, đảm bảo trạng thái dropdown không bị nhảy ngược khi người dùng chọn chế độ gõ tên tự do.

### 3. Kiểm chứng tĩnh (Static Verification)

- `npx --no-install tsc --noEmit`: **PASS** (không có lỗi kiểu).
- `npm run lint`: **PASS** (không có lỗi lint).
- `npm run build`: **PASS** (Next.js 16.4.5 Turbopack production build thành công toàn bộ routes).

### 4. Chuẩn bị và hiện trạng S3 (Kiểm chứng ca thực tế)

- **Đối chiếu transcript mẫu và ảnh kết quả**:
  - Đã xác nhận `specs/v4/extracted-example.json` (cuộc họp 32 phút, 322 đoạn) **không tương ứng** với ảnh `specs/v4/demo-meeting-assistant.vercel.app_results.png` (cuộc họp "Email Formatting and HTML Rendering Bug Review", ~03:58 est., 3 speakers).
  - Đã trích xuất transcript nguyên vẹn từ ảnh bằng OCR thị giác (Apple Vision framework) thành fixture độc lập tại `specs/v4/screenshot-meeting-fixture.json` gồm 61 đoạn hội thoại kèm timestamp và raw speaker labels.
  - Notes nguyên văn trong ảnh: `"Catchup ngắn giữa BE (Semaj), QA (James) và iOS Dev (Chị 13)."`.
- **Phân tích độc lập trước chạy AI (Ground Truth Analysis)**:
  - `Speaker 1` (59% text share): Chủ động nêu lỗi hiển thị link/email, đối chiếu hiển thị giữa Gmail web và Android, trao đổi với Chị Hằng và chỉ ra lỗi hiển thị body của Person 2 -> Vai trò QA (James).
  - `Speaker 2` (28% text share): Giải thích "chỉ tải body HTML về rồi boot lên view", "sao bản view này nó lỗi", hỏi "API nào, markdown nào", nhận "để em coi thử" -> Vai trò iOS Dev / Dev phụ trách view (Chị 13 hoặc Semaj).
  - `Speaker 3` (13% text share): Chỉ phát biểu ở đoạn đầu (00:18–00:50), hướng dẫn mở link và phân biệt markdown/HTML -> Có thể là BE (Semaj) giải thích định dạng API trả về.
- **Tình trạng nghiệm thu live**:
  - Môi trường hiện tại không lưu cấu hình Gemini API key (`process.env.GEMINI_API_KEY` = null) để bảo mật.
  - Các ca live inference (TC-014, TC-015, TC-016) được ghi nhận là **PENDING LIVE EXECUTION** (chờ chạy với API key thật qua giao diện người dùng); không tự đánh pass giả định hoặc thay thế bằng static checks.
