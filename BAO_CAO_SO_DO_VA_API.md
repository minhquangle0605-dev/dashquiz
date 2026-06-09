# Phụ lục Báo cáo — Sơ đồ & Bảng API (WebQuiz)

> Sinh trực tiếp từ mã nguồn (`prisma/schema.prisma` + 21 file `*.routes.ts`).
> Tất cả sơ đồ viết bằng **Mermaid** — dán vào https://mermaid.live để xuất ảnh PNG/SVG chèn vào Word.
> Số liệu thực tế: **57 bảng**, **32 enum**, **17 module backend**, ~**200+ endpoint**, **62 màn hình**, ~**69.000 dòng code**.

---

## A. SƠ ĐỒ KIẾN TRÚC HỆ THỐNG (Chương 4)

```mermaid
flowchart TB
    subgraph Client["🖥️ Trình duyệt — React 19 SPA (Vite, TS, Tailwind)"]
        UI[React Router · React Query · Zustand]
        WS1[Socket.io-client]
        SW[Service Worker · Web Push]
    end

    subgraph Server["⚙️ Backend — Node.js + Express 4 (TypeScript)"]
        direction TB
        MW[Middlewares: JWT auth · RBAC · rate-limit · validate · activityLog]
        API[REST API — routes → controller → service]
        IO[Socket.io server — realtime giám sát thi]
        OCR[OCR engine: tesseract.js + pdfjs]
        PR[Prisma ORM 6]
    end

    subgraph Infra["🗄️ Hạ tầng (Docker Compose)"]
        PG[(PostgreSQL<br/>57 bảng · pg_trgm)]
        RD[(Redis<br/>cache + Socket.io adapter)]
        MO[(MinIO<br/>ảnh câu hỏi · file · export)]
    end

    GEM[☁️ Google Gemini API<br/>làm giàu câu hỏi]

    UI -->|HTTPS REST /api/*| MW --> API --> PR --> PG
    WS1 <-->|WebSocket| IO
    IO <--> RD
    API --> RD
    API --> MO
    OCR --> API
    API -.->|tùy chọn| GEM
    SW -.->|push notification| UI
```

---

## B. SƠ ĐỒ USE CASE TỔNG QUÁT (Chương 3)

### Bản UML chuẩn (PlantUML) — *khuyến nghị dùng cho đồ án*

> Dán vào http://www.plantuml.com/plantuml hoặc cài extension **PlantUML** trong VS Code (Alt+D để xem trước → Export PNG/SVG).
> Lưu ý: 4 vai trò đều **kế thừa** actor "Người dùng" (đường tam giác) nên dùng chung use case *Đăng nhập / Đổi mật khẩu*.

```plantuml
@startuml UseCase_WebQuiz
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome
skinparam shadowing false
skinparam linetype ortho

actor "Người dùng" as U
actor "Admin" as A
actor "Giáo viên" as T
actor "Học sinh" as S
actor "Phụ huynh" as P

' Tổng quát hóa: mọi vai trò đều là Người dùng
A --|> U
T --|> U
S --|> U
P --|> U

rectangle "Hệ thống WebQuiz" {
  usecase "UC1 · Đăng nhập / Đổi mật khẩu"          as UC1
  usecase "UC2 · Quản lý tài khoản & phân quyền"     as UC2
  usecase "UC3 · Quản lý năm học · học kỳ · lớp"     as UC3
  usecase "UC4 · Quản lý ngân hàng câu hỏi"          as UC4
  usecase "UC5 · Import đề PDF/DOCX/ảnh (OCR)"       as UC5
  usecase "UC6 · Tạo & cấu hình đề thi"              as UC6
  usecase "UC7 · Giao bài & lập lịch thi"            as UC7
  usecase "UC8 · Làm bài thi trực tuyến"             as UC8
  usecase "UC9 · Giám sát thi / chống gian lận"      as UC9
  usecase "UC10 · Chấm điểm & xem kết quả"           as UC10
  usecase "UC11 · Phân tích & báo cáo · xuất PDF"    as UC11
  usecase "UC12 · Knowledge Graph & lộ trình học"    as UC12
  usecase "UC13 · Theo dõi kết quả của con"          as UC13
  usecase "UC14 · Sao lưu · cấu hình hệ thống"       as UC14
}

' Use case dùng chung qua tổng quát hóa
U  --> UC1

' Admin
A --> UC2
A --> UC3
A --> UC14
A --> UC4
A --> UC11
A --> UC12

' Giáo viên
T --> UC4
T --> UC5
T --> UC6
T --> UC7
T --> UC9
T --> UC10
T --> UC11
T --> UC12

' Học sinh
S --> UC8
S --> UC10
S --> UC12

' Phụ huynh
P --> UC13
P --> UC12

' Quan hệ include/extend (tăng chiều sâu)
UC6 ..> UC4 : <<include>>
UC7 ..> UC6 : <<include>>
UC5 ..> UC4 : <<extend>>
UC9 ..> UC8 : <<extend>>
@enduml
```

**Giải thích quan hệ include/extend:**
- `UC6 ⟶ UC4` (**include**): tạo đề thi luôn cần lấy câu từ ngân hàng câu hỏi.
- `UC7 ⟶ UC6` (**include**): muốn giao bài/lập lịch thì phải có đề đã tạo.
- `UC5 ⟶ UC4` (**extend**): import OCR là cách *mở rộng* để bổ sung câu vào ngân hàng (tùy chọn).
- `UC9 ⟶ UC8` (**extend**): cơ chế giám sát/ghi nhận vi phạm *mở rộng* trong lúc học sinh làm bài.

### Bản Mermaid (thay thế nhanh nếu không cài được PlantUML)

```mermaid
flowchart LR
    Admin([👤 Admin])
    Teacher([👤 Giáo viên])
    Student([👤 Học sinh])
    Parent([👤 Phụ huynh])

    subgraph Sys["Hệ thống WebQuiz"]
        UC1(Đăng nhập / Đổi mật khẩu)
        UC2(Quản lý tài khoản & phân quyền)
        UC3(Quản lý năm học · học kỳ · lớp)
        UC4(Quản lý ngân hàng câu hỏi)
        UC5(Import đề PDF/DOCX/ảnh - OCR)
        UC6(Tạo & cấu hình đề thi)
        UC7(Giao bài & lập lịch thi)
        UC8(Làm bài thi trực tuyến)
        UC9(Giám sát thi / chống gian lận)
        UC10(Chấm điểm & xem kết quả)
        UC11(Phân tích & báo cáo · xuất PDF)
        UC12(Knowledge Graph & lộ trình học)
        UC13(Theo dõi kết quả của con)
        UC14(Sao lưu · cấu hình hệ thống)
    end

    Admin --> UC1 & UC2 & UC3 & UC4 & UC11 & UC12 & UC14
    Teacher --> UC1 & UC4 & UC5 & UC6 & UC7 & UC9 & UC10 & UC11 & UC12
    Student --> UC1 & UC8 & UC10 & UC12
    Parent --> UC1 & UC13
```

> Đặc tả chi tiết (tác nhân – tiền điều kiện – luồng chính – luồng phụ – hậu điều kiện) nên viết cho 5 use case quan trọng: **Đăng nhập, Tạo đề thi, Làm bài thi, Import đề bằng OCR, Xem phân tích kết quả**.

---

## C. SƠ ĐỒ ERD (Chương 4) — tách theo cụm cho dễ đọc

> 57 bảng vẽ chung 1 hình sẽ rối. Tách thành 8 cụm theo nghiệp vụ. Mỗi cụm chỉ ghi khóa chính + vài cột tiêu biểu.

### Cụm 1 — Người dùng & Học vụ

```mermaid
erDiagram
    User ||--o| StudentProfile : "hồ sơ HS"
    User ||--o| ParentProfile : "hồ sơ PH"
    ParentProfile ||--o{ StudentProfile : "có con"
    AcademicYear ||--o{ Semester : "gồm"
    Semester ||--o{ Class : "có lớp"
    User ||--o{ Class : "GV chủ nhiệm"
    Subject ||--o{ Class : "môn"
    Class ||--o{ ClassStudent : "ghi danh"
    User ||--o{ ClassStudent : "là HS"
    Class ||--o{ StudentProfile : "lớp chủ nhiệm"
    Subject ||--o{ Chapter : "chương"

    User { int id PK }
    StudentProfile { string studentCode PK }
    ParentProfile { string parentCode PK }
    AcademicYear { int id PK }
    Semester { int id PK }
    Class { int id PK }
    Subject { int id PK }
    Chapter { int id PK }
```

### Cụm 2 — Ngân hàng câu hỏi

```mermaid
erDiagram
    Subject ||--o{ Question : ""
    Chapter ||--o{ Question : ""
    Question ||--o{ QuestionOption : "đáp án"
    Question ||--o{ QuestionTag : "tag"
    Question ||--o{ QuestionVersion : "lịch sử phiên bản"
    Question ||--o| QuestionReview : "duyệt"
    Question ||--o{ QuestionDuplicateLink : "cặp trùng"

    Question { int id PK }
    QuestionOption { int id PK }
    QuestionVersion { int id PK }
    QuestionDuplicateLink { int id PK }
```

### Cụm 3 — Đề thi & Làm bài

```mermaid
erDiagram
    Exam ||--o{ ExamQuestion : "câu hỏi"
    Question ||--o{ ExamQuestion : ""
    Exam ||--o{ ExamSchedule : "lịch"
    Exam ||--o{ ExamAssignment : "giao lớp"
    Class ||--o{ ExamAssignment : ""
    Exam ||--o{ ExamAttempt : "lượt làm"
    User ||--o{ ExamAttempt : "HS làm"
    ExamAttempt ||--o{ AttemptAnswer : "câu trả lời"
    Question ||--o{ AttemptAnswer : ""

    Exam { int id PK }
    ExamAttempt { int id PK }
    AttemptAnswer { int id PK }
```

### Cụm 4 — Giám sát thi / Chống gian lận

```mermaid
erDiagram
    Exam ||--o| ExamSecuritySetting : "cấu hình bảo mật"
    ExamAttempt ||--o| AttemptSecuritySession : "phiên thiết bị"
    ExamAttempt ||--o{ ExamAttemptEvent : "sự kiện"
    ExamAttempt ||--o{ AttemptViolation : "vi phạm"
    ExamAttemptEvent ||--o| AttemptViolation : "sinh ra"
    ExamAttempt ||--o| ProctorReview : "kết luận GV"

    ExamSecuritySetting { int id PK }
    ExamAttemptEvent { int id PK }
    AttemptViolation { int id PK }
    ProctorReview { int id PK }
```

### Cụm 5 — Phân tích & Báo cáo (snapshot cache)

```mermaid
erDiagram
    Exam ||--o{ ExamReportSnapshot : "ảnh chụp kết quả"
    Exam ||--o{ QuestionStat : "thống kê câu"
    Exam ||--o{ QuestionOptionStat : "thống kê đáp án"
    Exam ||--o{ StudentExamInsight : "insight HS"

    ExamReportSnapshot { int id PK }
    QuestionStat { int id PK }
    StudentExamInsight { int id PK }
    ReportExport { int id PK }
```

### Cụm 6 — Import & OCR

```mermaid
erDiagram
    User ||--o{ ImportJob : "tạo phiên import"
    ImportJob ||--o{ ImportPreviewItem : "câu trích xuất"

    ImportJob { int id PK }
    ImportPreviewItem { int id PK }
```

### Cụm 7 — Knowledge Graph

```mermaid
erDiagram
    KnowledgeNode ||--o{ KnowledgeNode : "cha/con"
    KnowledgeNode ||--o{ KnowledgeRelation : "quan hệ (tiên quyết...)"
    KnowledgeNode ||--o{ KnowledgeNodeAlias : "bí danh"
    Question ||--o{ QuestionKnowledgeNode : "gắn node"
    KnowledgeNode ||--o{ QuestionKnowledgeNode : ""
    User ||--o{ StudentKnowledgeMastery : "mức thành thạo"
    KnowledgeNode ||--o{ StudentKnowledgeMastery : ""

    KnowledgeNode { int id PK }
    KnowledgeRelation { int id PK }
    StudentKnowledgeMastery { int id PK }
```

### Cụm 8 — Lớp học (LMS) & Thảo luận

```mermaid
erDiagram
    Class ||--o{ ClassSection : "chương mục"
    ClassSection ||--o{ ClassResource : "tài nguyên"
    ClassSection ||--o{ ClassActivity : "hoạt động"
    ClassActivity ||--o{ ClassSubmission : "bài nộp"
    ClassActivity ||--o{ ClassForumPost : "diễn đàn"
    ClassActivity ||--o{ ClassAttendanceRecord : "điểm danh"
    Class ||--o{ ClassTimetableSlot : "thời khóa biểu"
    Class ||--o{ Discussion : "thông báo/thảo luận"
    Discussion ||--o{ DiscussionReply : "phản hồi"

    ClassActivity { int id PK }
    ClassSubmission { int id PK }
    Discussion { int id PK }
```

> Các bảng hệ thống còn lại (không cần ERD riêng): `Notification`, `ActivityLog`, `SystemConfig`, `Backup`, `WebPushSubscription`, `ExamSecurityPolicyTemplate`, `ClassMemberRoleAssignment`, `ClassCompletion`, `ClassActivityLog`, `DiscussionAttachment`.

---

## D. SƠ ĐỒ TUẦN TỰ (Sequence — Chương 4/5)

### D1. Học sinh nộp bài → chấm tự động → cập nhật mastery

```mermaid
sequenceDiagram
    actor HS as Học sinh
    participant FE as React SPA
    participant API as Express API
    participant DB as PostgreSQL
    participant KG as Knowledge Graph engine

    HS->>FE: Bấm "Nộp bài"
    FE->>API: POST /api/student/attempts/:id/submit
    API->>DB: Đọc đáp án + câu trả lời (AttemptAnswer)
    API->>API: Chấm điểm tự động (so khớp isCorrect)
    API->>DB: Cập nhật ExamAttempt (totalScore, status=GRADED)
    API->>KG: Kích hoạt cập nhật mastery
    KG->>DB: Tính lại StudentKnowledgeMastery theo node
    API-->>FE: Trả kết quả + điểm
    FE-->>HS: Hiển thị màn hình kết quả
```

### D2. Import đề từ PDF/ảnh → OCR → duyệt → tạo câu hỏi

```mermaid
sequenceDiagram
    actor GV as Giáo viên
    participant FE as Import Wizard
    participant API as Express API
    participant OCR as OCR (tesseract/pdfjs)
    participant DB as PostgreSQL
    participant MO as MinIO

    GV->>FE: Tải lên PDF/DOCX/ảnh
    FE->>API: POST /api/questions/extract-from-document
    API->>MO: Lưu file gốc (ImportJob.sourceObject)
    API->>OCR: Trích xuất văn bản
    OCR-->>API: Câu hỏi thô
    API->>API: Chuẩn hóa + kiểm tra trùng (pg_trgm)
    API->>DB: Lưu ImportPreviewItem (status=VALID/INVALID)
    API-->>FE: Danh sách câu để GV duyệt
    GV->>FE: Sửa/chọn câu → Commit
    FE->>API: POST /api/questions/bulk-create
    API->>DB: Ghi vào ngân hàng câu hỏi (Question)
    API-->>FE: Số câu đã nhập thành công
```

---

## E. BẢNG API (Chương 4) — nhóm theo module

> Mọi API đều có tiền tố `/api`. Cột **Quyền**: 🔓 = đã đăng nhập; vai trò cụ thể ghi rõ. Tổng cộng **21 nhóm route**.

### E1. Xác thực — `/api/auth`
| Method | Path | Mô tả | Quyền |
|---|---|---|---|
| POST | `/login` | Đăng nhập, cấp JWT | 🔓 công khai |
| POST | `/logout` | Đăng xuất | 🔓 |
| POST | `/refresh` | Làm mới access token | 🔓 công khai |

### E2. Tài khoản cá nhân — `/api/users`
| Method | Path | Mô tả | Quyền |
|---|---|---|---|
| GET | `/me` | Lấy thông tin bản thân | 🔓 |
| PUT | `/me` | Cập nhật hồ sơ | 🔓 |
| PUT | `/me/password` | Đổi mật khẩu | 🔓 |
| POST | `/me/avatar` | Tải ảnh đại diện | 🔓 |

### E3. Quản trị tài khoản — `/api/admin/users` *(Admin)*
| Method | Path | Mô tả |
|---|---|---|
| GET | `/` · `/roles` · `/import-template` | Danh sách / DS vai trò / tải file mẫu import |
| POST | `/` · `/:id/reset-password` · `/import` | Tạo / reset mật khẩu / import hàng loạt |
| PUT | `/:id` · `/:id/role` | Cập nhật thông tin / đổi vai trò |
| DELETE | `/:id` | Xóa tài khoản |

### E4. Ngân hàng câu hỏi — `/api/questions` *(GV/Admin)*
| Method | Path | Mô tả |
|---|---|---|
| GET | `/` · `/:id` · `/images/:key` | Danh sách / chi tiết / phục vụ ảnh |
| POST | `/` · `/:id/tags` · `/:id/versions/:versionId/restore` | Tạo / gắn tag / khôi phục phiên bản |
| PUT | `/:id` | Cập nhật câu hỏi (sinh QuestionVersion) |
| DELETE | `/:id` · `/:id/tags/:tagId` | Xóa câu / gỡ tag |
| POST | `/import` · `/import-zip` · `/extract-from-document` | Import Excel / ZIP ảnh / trích xuất DOCX-PDF (OCR) |
| POST | `/bulk-create` · `/bulk-update` · `/bulk-delete` | Thao tác hàng loạt |
| POST | `/ai-suggest` · `/export-gift` · `/images` | Gợi ý AI / xuất GIFT / upload ảnh |
| GET | `/import-template` · `/document-import-template` · `/zip-import-template` | Tải file mẫu |

### E5. Đề thi — `/api/exams` *(GV/Admin)*
| Method | Path | Mô tả |
|---|---|---|
| GET | `/` · `/:id` | Danh sách / chi tiết đề |
| POST | `/` · `/:id/questions` · `/:id/schedule` · `/:id/assign` | Tạo / thêm câu / lập lịch / giao lớp |
| PUT | `/:id` · `/:id/publish` · `/:id/security-settings` | Sửa / phát hành / cấu hình bảo mật |
| DELETE | `/:id` · `/:id/attempts/:attemptId` | Xóa đề / xóa lượt làm |
| GET | `/:id/assignments` · `/:id/monitoring` · `/:id/proctoring/live` | Lớp được giao / giám sát realtime |
| GET | `/:id/reports` · `/:id/attempts/:attemptId/evidence` | Báo cáo điểm / hồ sơ bằng chứng |
| PUT | `/:id/attempts/:attemptId/review` · `/.../answers/:answerId/grade` | Kết luận proctor / chấm tay 1 câu |

### E6. Làm bài thi (Học sinh) — `/api/student`
| Method | Path | Mô tả |
|---|---|---|
| GET | `/exams` | Danh sách đề được giao |
| POST | `/exams/:id/precheck` · `/exams/:id/start` | Kiểm tra điều kiện (lobby) / bắt đầu thi |
| PUT | `/attempts/:id/save` | Tự lưu câu trả lời |
| POST | `/attempts/:id/submit` | Nộp bài (chấm tự động) |
| POST | `/attempts/:id/events` · `/events/batch` · `/security-session` · `/heartbeat` | Ghi sự kiện giám sát / phiên bảo mật / nhịp tim |
| GET | `/attempts` · `/attempts/:id/result` | Lịch sử / kết quả 1 lượt |

### E7. Phân tích đề thi (GV) — `/api/teacher`
| Method | Path | Mô tả |
|---|---|---|
| GET | `/exams/:id/analytics/summary` · `/questions` · `/students` · `/status` | Tổng quan / theo câu / theo HS / trạng thái |
| POST | `/exams/:id/analytics/recalculate` | Tính lại snapshot |
| GET | `/students/:studentId/knowledge-graph` · `/classes/:classId/knowledge-graph` · `/weak-nodes` | KG của HS / lớp / node yếu |
| POST | `/classes/:classId/knowledge-graph/practice` | Giao bộ luyện tập theo node yếu |

### E8. Knowledge Graph (Admin) — `/api/admin/knowledge-nodes`
| Method | Path | Mô tả |
|---|---|---|
| GET | `/` · `/:id/aliases` · `/relations` · `/quality` | Liệt kê node / bí danh / quan hệ / báo cáo chất lượng |
| POST | `/autogenerate` · `/recalculate` · `/relations` · `/relations/seed-part-of` · `/:id/aliases` · `/:id/merge` | Tự sinh / tính lại / tạo quan hệ / gộp node |
| PATCH | `/:id` | Sửa node |
| DELETE | `/:id` · `/relations/:id` · `/aliases/:aliasId` | Xóa node / quan hệ / bí danh |

### E9. Knowledge Graph (Học sinh) — `/api/student`
| Method | Path | Mô tả |
|---|---|---|
| GET | `/knowledge-graph` · `/recommendations` · `/path` | Sơ đồ tri thức / gợi ý / lộ trình học |
| POST | `/knowledge-graph/practice` | Sinh bộ luyện tập cá nhân hóa |

### E10. Phụ huynh — `/api/parent` *(Parent)*
| Method | Path | Mô tả |
|---|---|---|
| GET | `/children` · `/children/:id/results` · `/children/:id/dashboard` | DS con / kết quả / dashboard |
| GET | `/children/:id/knowledge-graph` · `/knowledge-graph/path` | KG & lộ trình học của con |

### E11. Các module còn lại (tóm tắt theo base path & số endpoint)
| Module | Base path | Số endpoint | Chức năng chính |
|---|---|---|---|
| Lớp học (LMS) | `/api/classes` | 33 | Lớp, chương mục, tài nguyên, hoạt động, bài nộp, điểm danh, hoàn thành |
| Thảo luận | `/api/discussions` | 10 | Thông báo, thảo luận, phản hồi, đính kèm |
| Thời khóa biểu | `/api/timetable` | 9 | Tiết học, môn, phòng, kiểm tra trùng lịch thi |
| Học vụ | `/api/admin/academic` | 8 | Năm học, học kỳ, môn, lớp |
| Hệ thống | `/api/admin/system` | 7 | Cấu hình, giám sát, sao lưu (backup) |
| Thông báo | `/api/notifications` | 5 | In-app + Web Push |
| Phân tích admin | `/api/admin` | — | Thống kê toàn hệ thống |
| Phân tích HS | `/api/student` | — | Dashboard học tập của HS |
| Chương trình | `/api` | 3 | Subject → Chapter (curriculum) |
| Chất lượng câu hỏi | `/api/questions` | — | Review queue, duplicate, quality flag |
| Import job | `/api/questions` | — | Theo dõi tiến trình import (poll) |
| AI | `/api/ai` | 1 | Sinh phương án nhiễu (matching distractor) |

---

## F. MA TRẬN PHÂN QUYỀN (RBAC) — Chương 4

| Nhóm chức năng | Admin | Giáo viên | Học sinh | Phụ huynh |
|---|:--:|:--:|:--:|:--:|
| Quản lý tài khoản & phân quyền | ✅ | — | — | — |
| Quản lý năm học / học kỳ / môn | ✅ | — | — | — |
| Quản lý lớp & nội dung lớp | ✅ | ✅ | xem | — |
| Ngân hàng câu hỏi & Import/OCR | ✅ | ✅ | — | — |
| Tạo / giao / lập lịch đề thi | ✅ | ✅ | — | — |
| Làm bài thi | — | — | ✅ | — |
| Giám sát thi & chấm tay | ✅ | ✅ | — | — |
| Phân tích & báo cáo đề thi | ✅ | ✅ | — | — |
| Knowledge Graph & lộ trình | ✅ (quản trị) | ✅ (lớp/HS) | ✅ (bản thân) | xem (của con) |
| Theo dõi kết quả của con | — | — | — | ✅ |
| Sao lưu & cấu hình hệ thống | ✅ | — | — | — |

---

### Ghi chú khi đưa vào báo cáo
- Mỗi sơ đồ/bảng phải **được đánh số** (Hình 4.1, Bảng 4.2…) và **được nhắc tới trong văn bản** trước khi xuất hiện.
- ERD nên dán **từng cụm** kèm 1–2 câu giải thích quan hệ chính, không dán cả 8 cụm liền nhau.
- Bảng API đầy đủ (toàn bộ ~200 endpoint) nên để ở **Phụ lục**; trong Chương 4 chỉ trích các module trọng tâm (E4–E9).
