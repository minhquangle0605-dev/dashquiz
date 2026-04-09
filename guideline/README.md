# Thư mục `guideline/` — Ghi chú quan trọng

## Mục đích

Toàn bộ nội dung trong folder **`guideline/`** (file PDF, HTML, và mọi file khác nếu có sau này) **chỉ dùng để**:

- **Đọc** — tham khảo kiến trúc, ERD, luồng người dùng, use case, UI/UX, lộ trình phát triển.
- **Xây dựng theo** — triển khai code, database, API và giao diện **bám theo** các bản vẽ và tài liệu này.

Đây là **tài liệu nội bộ cho nhóm phát triển**, không phải nội dung sản phẩm gửi tới người dùng cuối.

## Không được làm gì

- **Không** mount, copy, hoặc phục vụ trực tiếp các file trong `guideline/` qua web server (Express static, Nginx `root`, Vite `public`, v.v.) sao cho người dùng truy cập URL và **xem được** PDF/HTML thiết kế trên môi trường production (hoặc staging công khai).
- **Không** đưa đường dẫn `/guideline/...` vào router frontend hoặc route backend để “xem tài liệu” trên app đã triển khai.
- Khi build Docker / deploy: **không** đóng gói thư mục `guideline/` vào image hoặc artifact production nếu không cần thiết cho vận hành (trừ khi có quy trình nội bộ riêng và vẫn không expose ra internet).

## Sau khi dự án xây xong

Trên **web** (ứng dụng WebQuiz cho học sinh / giáo viên / admin / phụ huynh) **không được** hiển thị hoặc liên kết tới các file trong `guideline/`. Người dùng cuối chỉ thấy ứng dụng đã xây theo spec, không thấy bản thân các file thiết kế gốc.

Nếu cần tài liệu hướng dẫn cho user, hãy viết **trang Help / About riêng** trong `client/`, không tái sử dụng nguyên file HTML/PDF trong `guideline/`.

---

*File này nhắc nhở toàn bộ contributor: `guideline/` = chỉ để đọc và code theo, không phải nội dung hiển thị trên web.*
