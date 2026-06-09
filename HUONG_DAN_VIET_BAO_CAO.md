# Hướng dẫn viết Báo cáo dự án WebQuiz

> File này là **kế hoạch + checklist** để bạn viết báo cáo (đồ án / báo cáo môn học / tài liệu kỹ thuật) cho hệ thống **WebQuiz – High School Learning Analytics & Online Exam Platform**.
> Cấu trúc bên dưới theo chuẩn báo cáo đồ án ở Việt Nam (đầy đủ nhất). Nếu chỉ là báo cáo môn học → bỏ bớt các chương phụ (xem mục [Cách rút gọn](#13-cách-rút-gọn-cho-báo-cáo-nhỏ)).

---

## 0. Tóm tắt dự án (để bạn tự đối chiếu)

WebQuiz là nền tảng web hỗ trợ **dạy – học – thi trắc nghiệm trực tuyến** cho bậc THPT, kèm **phân tích học tập (learning analytics)**.

**Công nghệ chính:**
- **Frontend:** React 19, Vite 6, TypeScript, TailwindCSS 4, React Query, Zustand, React Router 7, Chart.js, Socket.io-client, KaTeX (công thức Toán), react-hook-form + Zod.
- **Backend:** Node.js + Express 4, TypeScript, Prisma ORM 6, JWT (xác thực), Socket.io (realtime), Winston (logging), Multer (upload).
- **Hạ tầng/dịch vụ:** PostgreSQL (DB chính), Redis (cache + Socket.io adapter), MinIO (lưu ảnh/tệp), Docker.
- **Tính năng nâng cao:** OCR đề thi (tesseract.js + pdfjs), phát hiện trùng câu hỏi (pg_trgm), làm giàu câu hỏi bằng AI (Google Gemini), Knowledge Graph (sơ đồ tri thức + đo mức độ thành thạo), giám sát thi (proctoring), báo cáo PDF.

**Vai trò người dùng (RBAC):** Admin, Giáo viên (Teacher), Học sinh (Student), Phụ huynh (Parent).

**Các nhóm tính năng lớn:**
1. Xác thực & phân quyền, quản lý tài khoản, vòng đời mật khẩu.
2. Quản lý lớp học (năm học, học kỳ, lớp, thành viên, tài nguyên, hoạt động, điểm danh, thời khóa biểu, diễn đàn lớp).
3. Ngân hàng câu hỏi (môn → chương, nhiều loại câu hỏi, phiên bản câu hỏi, tag, phát hiện trùng).
4. Tổ chức thi (đề thi, lịch thi, giao bài, lượt làm bài, chấm điểm, chế độ điều hướng).
5. Giám sát thi / chống gian lận (security session, ghi nhận vi phạm, proctor review, mẫu chính sách bảo mật).
6. Phân tích & báo cáo (snapshot kết quả, thống kê câu hỏi/đáp án, insight học sinh, xuất PDF/Excel).
7. Import & OCR (nhập đề từ PDF/DOCX/ảnh, hàng đợi duyệt, làm giàu bằng AI).
8. Knowledge Graph & lộ trình học (đo mastery, gợi ý tiên quyết, bộ luyện tập cá nhân hóa).
9. Thông báo (in-app + web push), nhật ký hoạt động, sao lưu, cấu hình hệ thống.

> ⚠️ Bạn **không cần đưa hết** vào báo cáo. Chọn nhóm tính năng làm điểm nhấn (gợi ý: Thi trực tuyến + Analytics + Knowledge Graph) và mô tả phần còn lại ở mức tổng quan.

---

## 1. Trước khi viết – chuẩn bị (Giai đoạn 0)

Làm xong bước này thì viết sẽ rất nhanh.

- [ ] **Xác định loại báo cáo & template của trường/giáo viên.** Font, lề, đánh số trang, format trích dẫn (APA/IEEE) thường có quy định cứng → lấy trước.
- [ ] **Xác định số trang mục tiêu** (đồ án tốt nghiệp ~50–80 trang; báo cáo môn học ~20–40 trang).
- [ ] **Liệt kê tính năng thực sự đã làm xong** (đối chiếu mục 0). Cái nào chưa xong → cho vào "Hướng phát triển".
- [ ] **Thu thập số liệu thật từ DB** để báo cáo có dẫn chứng: số bảng, số dòng code, số API, số màn hình. Xem mục [Lệnh lấy số liệu](#11-phụ-lục-lệnh-lấy-số-liệu-nhanh).
- [ ] **Chụp/chuẩn bị ảnh màn hình** từng tính năng (xem mục [Ảnh & demo](#9-ảnh-màn-hình--video-demo)).
- [ ] **Vẽ sẵn các sơ đồ** (use case, kiến trúc, ERD, sequence) — xem mục [Sơ đồ cần vẽ](#8-các-sơ-đồ-cần-chuẩn-bị).
- [ ] **Gom tài liệu tham khảo** (link công nghệ, sách, bài báo về learning analytics).

---

## 2. Cấu trúc tổng thể báo cáo

```
Trang bìa
Trang bìa phụ
Lời cảm ơn
Lời cam đoan
Mục lục
Danh mục hình ảnh
Danh mục bảng
Danh mục từ viết tắt (RBAC, OCR, ERD, API, JWT, ORM...)

MỞ ĐẦU (Lý do, mục tiêu, phạm vi, đối tượng, phương pháp)

Chương 1: Tổng quan đề tài
Chương 2: Cơ sở lý thuyết & công nghệ
Chương 3: Phân tích yêu cầu
Chương 4: Thiết kế hệ thống
Chương 5: Cài đặt & triển khai (hiện thực)
Chương 6: Kiểm thử & đánh giá
Chương 7: Kết luận & hướng phát triển

TÀI LIỆU THAM KHẢO
PHỤ LỤC (hướng dẫn cài đặt, ảnh màn hình, mã nguồn tiêu biểu)
```

---

## 3. Chi tiết từng phần & viết gì

### Phần MỞ ĐẦU
- **Lý do chọn đề tài:** dạy học trực tuyến tăng mạnh, nhu cầu thi trắc nghiệm + chấm tự động + phân tích kết quả để cá nhân hóa việc học; các công cụ hiện có (Google Forms, Azota, Quizizz) thiếu phân tích sâu / sơ đồ tri thức.
- **Mục tiêu:** xây dựng hệ thống thi trực tuyến có ngân hàng câu hỏi, chấm tự động, phân tích học tập và gợi ý lộ trình.
- **Phạm vi:** bậc THPT; 4 vai trò; web app (chưa làm mobile native).
- **Đối tượng sử dụng:** giáo viên, học sinh, quản trị, phụ huynh.
- **Phương pháp thực hiện:** khảo sát → phân tích yêu cầu → thiết kế → hiện thực Agile/lặp → kiểm thử.

### Chương 1 – Tổng quan đề tài
- Bài toán & bối cảnh.
- **Khảo sát hệ thống tương tự** (Azota, Quizizz, Google Forms, Moodle, Kahoot): lập **bảng so sánh** tiêu chí (ngân hàng câu hỏi, chấm tự động, chống gian lận, analytics, sơ đồ tri thức, import OCR...). → Nêu bật điểm khác biệt của WebQuiz.
- Tính cấp thiết & ý nghĩa thực tiễn.

### Chương 2 – Cơ sở lý thuyết & công nghệ
Mỗi công nghệ viết 1 đoạn ngắn: *là gì – vì sao chọn – dùng ở đâu trong dự án*.
- Mô hình **Client–Server**, **REST API**, **realtime với WebSocket/Socket.io**.
- **React + Vite + TypeScript**; quản lý state (React Query cho server-state, Zustand cho client-state).
- **Node.js + Express**, kiến trúc phân tầng (routes → controller → service → Prisma).
- **Prisma ORM & PostgreSQL** (quan hệ, migration).
- **Redis** (cache, pub/sub cho Socket.io khi scale nhiều instance).
- **MinIO / Object Storage** (S3-compatible) để lưu ảnh câu hỏi & tệp.
- **JWT & bcrypt** (xác thực, băm mật khẩu).
- **OCR** (Tesseract), trích xuất PDF (pdfjs), so khớp văn bản gần đúng (**pg_trgm / Levenshtein**) để chống trùng câu hỏi.
- **LLM/Gemini** để làm giàu câu hỏi (giải thích, phân loại).
- Khái niệm **Learning Analytics** & **Knowledge Graph / mastery model** (cơ sở cho phần phân tích).
- **Docker** (đóng gói dịch vụ).

### Chương 3 – Phân tích yêu cầu
- **Yêu cầu chức năng** theo từng vai trò (liệt kê dạng bảng: vai trò → chức năng).
- **Yêu cầu phi chức năng:** bảo mật (RBAC, JWT, chống gian lận), hiệu năng (cache Redis, phân trang), khả năng mở rộng, tính khả dụng, logging/giám sát.
- **Sơ đồ Use Case tổng quát** + đặc tả vài use case quan trọng (Đăng nhập, Tạo đề thi, Làm bài thi, Xem phân tích kết quả, Import đề bằng OCR) theo mẫu: tác nhân – tiền điều kiện – luồng chính – luồng phụ – hậu điều kiện.

### Chương 4 – Thiết kế hệ thống
- **Kiến trúc tổng thể:** sơ đồ Frontend ↔ API ↔ (PostgreSQL, Redis, MinIO) + Socket.io realtime. Giải thích luồng dữ liệu.
- **Thiết kế CSDL:** sơ đồ **ERD** (các nhóm bảng chính: User/Class, Question/Exam, Attempt/Answer, Analytics, Import, KnowledgeGraph). Mô tả các bảng quan trọng + quan hệ (lấy từ `prisma/schema.prisma`).
- **Thiết kế API:** bảng các endpoint chính theo module (method, path, mô tả, quyền). Có thể nhóm theo module trong `server/src/modules/`.
- **Thiết kế phân quyền (RBAC):** ma trận vai trò × quyền.
- **Thiết kế giao diện (UI/UX):** sơ đồ điều hướng (sitemap) + wireframe/ảnh các màn hình chính.
- **Một vài sequence diagram:** "Học sinh nộp bài → chấm → cập nhật mastery", "Import PDF → OCR → duyệt → tạo câu hỏi".

### Chương 5 – Cài đặt & triển khai (hiện thực)
- **Môi trường phát triển:** Node version, Docker, cấu trúc thư mục `client/`, `server/`, `prisma/`.
- **Mô tả hiện thực các module trọng tâm** (chọn 3–5 module, kèm đoạn code tiêu biểu — KHÔNG dán nguyên file dài):
  - Xác thực & phân quyền (JWT, middleware, vòng đời mật khẩu).
  - Tổ chức & làm bài thi (lobby, realtime, chấm tự động).
  - Phân tích kết quả (snapshot, thống kê câu hỏi, xuất PDF).
  - Import/OCR + chống trùng.
  - Knowledge Graph (đo mastery, gợi ý lộ trình).
- Mỗi module: **mục đích → luồng xử lý → ảnh màn hình → đoạn code minh họa (10–25 dòng)**.
- Cách chạy dự án (tóm tắt; chi tiết để ở Phụ lục).

### Chương 6 – Kiểm thử & đánh giá
- **Phương pháp kiểm thử:** unit test (Vitest cho client, Jest cho server), kiểm thử thủ công theo kịch bản.
- **Bảng test case** (mã TC, chức năng, đầu vào, kết quả mong đợi, kết quả thực tế, Pass/Fail).
- **Đánh giá:** so với mục tiêu ban đầu (đã đạt gì, % hoàn thành), hiệu năng cơ bản (thời gian phản hồi, tải đồng thời nếu có đo).
- Hạn chế còn tồn tại (nêu trung thực, ví dụ: GEMINI_API_KEY chưa cấu hình ở local nên AI enrich chạy ở chế độ degrade).

### Chương 7 – Kết luận & hướng phát triển
- Kết quả đạt được (đối chiếu mục tiêu).
- Bài học kinh nghiệm.
- **Hướng phát triển:** app mobile, AI ra đề tự động, đề thi thích ứng (adaptive testing), tích hợp video proctoring, đa ngôn ngữ...

### Tài liệu tham khảo & Phụ lục
- Tham khảo: docs React/Prisma/Express/Socket.io/Postgres, tài liệu Learning Analytics.
- Phụ lục: hướng dẫn cài đặt chi tiết, biến môi trường, bộ ảnh màn hình đầy đủ, một số đoạn mã quan trọng.

---

## 8. Các sơ đồ cần chuẩn bị

| Sơ đồ | Dùng ở chương | Công cụ gợi ý |
|---|---|---|
| Use Case tổng quát + chi tiết | 3 | draw.io, PlantUML, Mermaid |
| Kiến trúc hệ thống (FE/API/DB/Redis/MinIO) | 4 | draw.io / Excalidraw |
| ERD (sơ đồ quan hệ thực thể) | 4 | `prisma-erd-generator`, dbdiagram.io |
| Sequence (nộp bài, import OCR) | 4/5 | PlantUML / Mermaid |
| Sitemap / luồng điều hướng UI | 4 | Figma / draw.io |
| Sơ đồ triển khai (Docker) | 5 | draw.io |

> Mẹo ERD nhanh: cài `prisma-erd-generator` rồi `prisma generate` để xuất ERD tự động từ `schema.prisma`. Sơ đồ có ~60 bảng sẽ rất rối → **tách theo nhóm** (subgraph) cho dễ đọc.

---

## 9. Ảnh màn hình & video demo

- [ ] Đăng nhập / phân quyền theo vai trò.
- [ ] Dashboard từng vai trò (Admin / Teacher / Student).
- [ ] Tạo đề thi + ngân hàng câu hỏi + soạn câu hỏi có công thức Toán (KaTeX).
- [ ] Lobby trước khi thi + màn hình làm bài (đếm giờ, điều hướng câu).
- [ ] Màn hình kết quả + báo cáo phân tích (biểu đồ Chart.js) + xuất PDF.
- [ ] Import đề bằng PDF/ảnh (OCR) + hàng đợi duyệt.
- [ ] Knowledge Graph + gợi ý lộ trình học.
- [ ] Trang giám sát thi / cảnh báo vi phạm.

> Quay 1 video demo ~3–5 phút theo kịch bản end-to-end (Giáo viên tạo đề → giao bài → Học sinh thi → xem phân tích) sẽ rất ăn điểm khi bảo vệ.

---

## 10. Quy trình viết theo thứ tự (lộ trình đề xuất)

1. **Tuần 1:** Hoàn thiện chuẩn bị (mục 1) + vẽ toàn bộ sơ đồ + chụp ảnh màn hình.
2. **Tuần 1–2:** Viết Chương 3, 4, 5 trước (phần "ruột", bạn nắm rõ nhất khi vừa code xong).
3. **Tuần 2:** Viết Chương 1, 2 (tổng quan & lý thuyết).
4. **Tuần 2–3:** Viết Chương 6, 7 + Mở đầu + Kết luận.
5. **Tuần 3:** Mục lục, danh mục hình/bảng, tài liệu tham khảo, phụ lục, soát chính tả, format theo template.
6. **Cuối:** Chuẩn bị slide bảo vệ (10–15 slide) + tập demo.

> Lý do viết Chương 4–5 trước: đó là phần có sẵn dữ liệu (code, sơ đồ), viết nhanh; viết xong mới dễ tóm tắt ngược lên Mở đầu/Tổng quan.

---

## 11. Phụ lục: lệnh lấy số liệu nhanh (để dẫn chứng trong báo cáo)

Chạy trong PowerShell tại thư mục `webquiz`:

```powershell
# Số model & enum trong schema Prisma
(Select-String -Path .\prisma\schema.prisma -Pattern '^model ' ).Count
(Select-String -Path .\prisma\schema.prisma -Pattern '^enum ' ).Count

# Số dòng code TypeScript ở server (bỏ node_modules)
(Get-ChildItem .\server\src -Recurse -Include *.ts | Get-Content | Measure-Object -Line).Lines

# Số dòng code ở client (tsx/ts)
(Get-ChildItem .\client\src -Recurse -Include *.ts,*.tsx | Get-Content | Measure-Object -Line).Lines

# Số trang (màn hình) phía client
(Get-ChildItem .\client\src\pages -Recurse -Include *.tsx).Count

# Số module backend
(Get-ChildItem .\server\src\modules -Directory).Count

# Liệt kê các route file để lập bảng API
Get-ChildItem .\server\src -Recurse -Include *.routes.ts | Select-Object Name
```

> Ghi lại các con số này vào báo cáo (ví dụ: "Hệ thống gồm N bảng dữ liệu, M API, K màn hình"). Số liệu cụ thể làm báo cáo thuyết phục hơn nhiều.

---

## 12. Checklist hoàn thiện cuối cùng

- [ ] Đúng format template trường (font, lề, cỡ chữ, giãn dòng, đánh số trang).
- [ ] Mục lục, danh mục hình/bảng tự cập nhật (dùng Heading Styles trong Word).
- [ ] Mọi hình/bảng đều **được đánh số và có chú thích** + được nhắc đến trong văn bản.
- [ ] Trích dẫn tài liệu tham khảo đúng chuẩn, đánh số nhất quán.
- [ ] Không dán nguyên file code dài; chỉ trích đoạn tiêu biểu có chú thích.
- [ ] Soát chính tả, thống nhất thuật ngữ (Việt hóa hay giữ tiếng Anh — chọn 1 kiểu).
- [ ] Kiểm tra tính trung thực: phần nào chưa làm xong để ở "Hướng phát triển", không phóng đại.
- [ ] Nhờ người khác đọc lại 1 lượt.
- [ ] Xuất PDF kiểm tra layout trước khi nộp.

---

## 13. Cách rút gọn cho báo cáo nhỏ

Nếu chỉ là **báo cáo môn học / tiểu luận** (không phải đồ án tốt nghiệp):
- Gộp Chương 1 + 2 thành "Tổng quan & công nghệ".
- Gộp Chương 3 + 4 thành "Phân tích & thiết kế".
- Giữ Chương 5 (hiện thực) làm trọng tâm.
- Rút gọn Chương 6 còn 1 bảng test case ngắn.
- Bỏ Lời cam đoan, có thể bỏ danh mục từ viết tắt.
- Chọn **3 tính năng tiêu biểu** để mô tả sâu, phần còn lại liệt kê tổng quan.

---

### Gợi ý cuối
Nếu bạn cho tôi biết **loại báo cáo** (đồ án tốt nghiệp / báo cáo môn học / tài liệu kỹ thuật) và **có template của trường không**, tôi có thể:
- Viết luôn nội dung chi tiết cho từng chương (không chỉ là khung).
- Sinh sơ đồ ERD / kiến trúc dạng Mermaid.
- Lập sẵn bảng API và bảng test case từ chính mã nguồn của bạn.
```
