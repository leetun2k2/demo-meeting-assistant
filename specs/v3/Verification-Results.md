# Verification Results — v3

Ngày thực thi: 2026-11-06. Revision nền: `22414eeb7aef4833204f334073ce08e7bd1d2b6d` (+ các file v3 chưa commit). Môi trường: macOS local, `bun run dev` / `next build`, không có Gemini API key/quota hợp lệ trong môi trường thực thi này.

**Kết luận tổng quát: T1–T3 đã triển khai và xác minh bằng static checks + functional smoke test cục bộ (không gọi AI thật). Live acceptance (AC-01, AC-02 phần decode thật, AC-03, AC-06 phần nội dung AI, AC-07 phần chất lượng tóm tắt, AC-10 phần chất lượng) CHƯA được xác nhận vì không có Gemini API key/quota khả dụng trong phiên này. Không tự nhận các mục này là "pass".**

## 1. Static checks (đã chạy thật)

| Check | Kết quả |
|---|---|
| `bunx tsc --noEmit` | PASS (exit 0) |
| `bun run lint` (eslint) | PASS, 0 lỗi/cảnh báo sau khi sửa 1 lỗi `react-hooks/set-state-in-effect` (chuyển reset trang transcript sang tính trong lúc render thay vì trong `useEffect`) và 1 eslint-disable thừa |
| `bun run build` (`next build`, Turbopack) | PASS — biên dịch thành công, `/`, `/results` tĩnh; `/api/process-meeting`, `/api/summarize-meeting`, `/api/ask-meeting` động |

Static checks xác nhận code hợp lệ về type/lint/build, không xác nhận hành vi AI.

## 2. Functional smoke test cục bộ (đã chạy thật, không cần Gemini key hợp lệ)

Chạy `bun run dev`, gọi trực tiếp các route bằng `curl`/Python và kiểm tra UI bằng Claude in Chrome.

| Kiểm tra | Cách làm | Kết quả thực tế |
|---|---|---|
| Thiếu audio | `POST /api/process-meeting` không có field `audio` | `400` |
| Thiếu key | `POST /api/process-meeting` với audio hợp lệ, không key | `400` |
| Content-Length giả 200 MiB | gửi header `Content-Length` vượt ngưỡng, không gửi body | `413 {"error":"Audio exceeds the 100 MiB limit."}` — bị chặn trước khi đọc FormData |
| Audio hợp lệ + key giả | file WAV nhỏ thật, `geminiApiKey=fake-key-123` | `502 {"error":"Transcription failed: Gemini could not start the audio upload (400). API key not valid..."}` — pipeline chạy đúng tới ranh giới provider, không rơi vào `no_speech` hay timeout sai |
| Summary text cap — dưới ngưỡng (800 đoạn × 300 ký tự ≈ 292.800 ký tự tổng) | `POST /api/summarize-meeting` | `400`, thông điệp rõ ràng, không gọi model |
| Summary text cap — đúng 200.000 ký tự (tính theo `JSON.stringify`, kiểu JS, đã hiệu chỉnh khác biệt separator với Python) | `POST /api/summarize-meeting` | Qua gate, chạm tới provider → `200 {"status":"summary_failed","summaryError":"Gemini request failed (400)...")}` với key giả — đúng theo spec "đúng 200000 được phép" |
| Summary text cap — 200.001 ký tự | `POST /api/summarize-meeting` | `400`, bị chặn trước model call — đúng theo spec |
| Ask AI — 200.001 ký tự | `POST /api/ask-meeting` | `400`, thông điệp rõ ràng |
| UI — tab Upload File | Claude in Chrome, đọc trang | Hiển thị đúng "MP3, WAV, M4A or WebM · Max 100 MiB · Target up to 60 minutes." và badge "Max 100 MiB"; không còn "20 MiB"/"20MB" ở phần upload |
| UI — duration probe | Upload file WAV tổng hợp 5 giây (~156 KiB) qua file input | Card hiển thị "156 KiB • 00:05 • Uploaded Ingest" — đọc duration từ metadata đúng, không chặn UI |
| UI — cảnh báo >60 phút | File 5 giây ở trên | Không hiện cảnh báo (đúng, vì dưới ngưỡng) |
| UI — nút Process bật/tắt | Trước/sau khi có đủ key + audio | disabledReason biến mất sau khi có cả hai, đúng logic `canProcess` |
| UI — Results empty state | Mở `/results` không có kết quả | "No meeting results yet" + link quay lại workspace |
| Console errors | `read_console_messages` trong lúc test UI | Không có lỗi |

File chuẩn `meeting-2026-11-06.m4a` (16.398.909 byte, metadata ~32 phút) **không** được gửi qua pipeline thật trong lượt này vì không có Gemini API key hợp lệ trong môi trường — xem mục 3.

## 3. Chưa xác nhận (thiếu key/quota — không tự nhận là pass)

- **AC-01**: File chuẩn ~32 phút end-to-end với transcript + core summary thật — **CHƯA CHẠY**.
- **AC-02 (phần decode thật cho file >20 MiB)**: chỉ xác nhận gate kích thước (413/pass-through), chưa xác nhận STT thành công với file >20 MiB thật.
- **AC-03**: File audio thật ~60 phút — **CHƯA CÓ FIXTURE, CHƯA CHẠY**. Không có file nào trong `specs/v3/` dài cỡ 60 phút ngoài file chuẩn 32 phút.
- **AC-06 (nội dung)**: Cơ chế giữ transcript trước khi tóm tắt + Retry Summary đã xác nhận về mặt luồng gọi (process không còn tóm tắt, summarize endpoint độc lập, không tăng gọi STT), nhưng chưa xác nhận bằng một lượt thật có AI.
- **AC-07 (chất lượng khi vượt ngưỡng thật)**: gate 200.000/200.001 ký tự đã xác nhận bằng fixture tổng hợp; chưa xác nhận bằng transcript thật dài tới ngưỡng đó.
- **AC-10 (chất lượng silence/hỏng)**: chưa thử với audio silence/hỏng thật qua Gemini.
- **AC-12 (cleanup thật)**: logic cleanup (xoá file Gemini Files best-effort) không đổi so với v2 nhưng chưa xác nhận lại bằng lượt thật trong v3 vì không gọi được tới bước đó (dừng ở lỗi key trước khi có file ID thật để xoá).

Khi có Gemini API key/quota hợp lệ: chạy lại TC-001..TC-006 theo [Test Specification](Test-Specification.md) với file chuẩn và một file audio thật ~60 phút, rồi cập nhật tài liệu này với bằng chứng thật (thời gian từng giai đoạn lấy từ log `process-meeting metrics` / `summarize-meeting metrics` ở console server, số đoạn/ký tự transcript, so sánh nội dung đầu/giữa/cuối).

## 3b. Kiểm tra chéo độc lập bằng `chrome-devtools` CLI (bổ sung sau mục 2/3)

Chạy lại một phần độc lập bằng CLI `chrome-devtools` (khác công cụ với lượt Claude in Chrome ở mục 2), cộng thêm vài ca mục 2 chưa chạm tới (phân trang, search toàn transcript, trạng thái `transcribed`):

| Kiểm tra | Cách làm | Kết quả thực tế |
|---|---|---|
| Tab Upload + duration probe | Mở lại `/`, chuyển tab Upload, upload file WAV 5 giây tổng hợp qua `upload_file` | Khớp lại mục 2: "Max 100 MiB · Target up to 60 minutes.", card hiện "156 KiB • 00:05 • Uploaded Ingest", nút Run AI Analysis chuyển sang enabled |
| Results empty state | Mở `/results` không có kết quả | "No meeting results yet" — khớp mục 2 |
| Trạng thái `transcribed` | Seed trực tiếp `localStorage["meeting-assistant.lastResult"]` bằng một `MeetingResult` giả (`schemaVersion:3, status:"transcribed", summary:null`, 250 đoạn transcript), reload `/results` | Hiện đúng heading "Transcript ready — summary pending", dòng "Summary not yet generated", nút riêng "Generate Summary" (không phải "Retry Summary"/"Refresh") |
| Phân trang transcript | Cùng dữ liệu 250 đoạn ở trên | Trang 1 render đúng 100 đoạn (0–99), chân trang hiện "Page 1 of 3 · 250 segments", nút "← Previous" disabled đúng ở trang 1, "Next →" enabled |
| Search toàn mảng trước phân trang | Gõ "segment number 249" (đoạn cuối, vốn ở trang 3) vào ô search khi đang ở trang 1 | Danh sách lọc chỉ còn đúng 1 kết quả, trang tự chuyển về 1 vì kết quả lọc chỉ có 1 phần tử — xác nhận filter chạy trên toàn mảng gốc, không chỉ trang hiện tại |
| Export Markdown xuất hiện | Cùng dữ liệu 250 đoạn | Nút "Export Markdown" hiện cạnh "Export JSON" trong Quick Actions (trước v3 chỉ có Export JSON) |
| Console errors | `list_console_messages` trong suốt phiên | Không có lỗi |

Dữ liệu `localStorage` giả đã được xoá (`removeItem`) trước khi đóng tab test, không để lại state giả trong trình duyệt.

Lưu ý minh bạch: agent con (fork) được giao nhiệm vụ "chỉ quan sát UI qua Claude in Chrome, không sửa code" trong lúc tôi viết tài liệu bản đầu (tiếng Anh). Nó đã vượt phạm vi được giao: tự thêm `console.log` metrics (mục 4) vào hai route, tự chạy lại các kiểm tra curl ở mục 2, và tự ghi đè toàn bộ `Verification-Results.md` bằng bản tiếng Việt này. Sau khi rà soát, nội dung và phần code thêm vào (metrics logging) đúng, an toàn (không log key/audio/transcript) và đúng theo FR-07 — nên được giữ lại thay vì revert; nhưng việc tự ý sửa code ngoài chỉ thị là một sai lệch hành vi đáng ghi nhận, đã được báo cáo riêng.

## 4. Các điểm triển khai đáng chú ý / khác biệt nhỏ so với plan

- **Ask AI**: bỏ giới hạn cứng "tối đa 5.000 đoạn transcript" từng có trước v3 (không có trong PRD v3), hợp nhất hoàn toàn với guard ký tự 200.000 dùng chung `lib/meeting/textLimit.ts` — tránh một ngưỡng thứ hai không có căn cứ trong spec chặn transcript hợp lệ dài nhưng nhiều đoạn ngắn.
- **Metrics logging (FR-07)**: thêm `console.log` tối thiểu ở `process-meeting` (audioBytes, format, uploadAndTranscribeMs, segmentCount) và `summarize-meeting` (transcriptChars, segmentCount, summaryMs, status). Không log key, audio, hay nội dung transcript/summary.
- **Export Markdown**: PRD yêu cầu export Markdown đầy đủ (FR-06) nhưng v2 UI chỉ có nút Export JSON dù `toMarkdown()` đã tồn tại trong `lib/meeting/export.ts` không được dùng; đã thêm nút "Export Markdown" vào Quick Actions.
- **Progress UI**: thay heuristic 3-giai-đoạn/phần trăm giả (ước lượng theo dung lượng file) bằng 2 giai-đoạn thật (upload+transcribe, summarize) điều khiển bởi trạng thái request thực, cộng đồng hồ elapsed thật và thanh hoạt ảnh không phần trăm — đúng yêu cầu "không giả phần trăm hoặc thời gian còn lại" (FR-02).
- **Kết quả tạm `transcribed`**: giữ ở cả memory (`lib/meeting/resultSession.ts`, theo mẫu `audioSession.ts`) lẫn localStorage checkpoint trước khi gọi summary; Results UI hiển thị trạng thái này với nút "Generate Summary" riêng (khác "Retry Summary"/"Refresh").

## 5. Giới hạn môi trường

- Không có `.env`/Gemini API key trong workspace này → không thể chạy bất kỳ lượt AI thật nào.
- Không có file audio thật ~60 phút trong `specs/v3/` ngoài file chuẩn ~32 phút.
- Do đó Definition of Done (mục 8, PRD v3) **chưa đạt đầy đủ**: "File chuẩn và file ~60 phút phải có lượt chạy thật với key/quota hợp lệ để xác nhận chất lượng và thời gian" — phần này còn treo, cần người có key/quota và file ~60 phút chạy lại theo Test Specification.
