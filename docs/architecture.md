# Kiến trúc BookApp

BookApp sử dụng layered architecture: React gọi REST API, FastAPI nhận và kiểm tra dữ liệu, service xử lý nghiệp vụ, SQLAlchemy quản lý transaction với MySQL. Đây là một ứng dụng triển khai chung, chưa phải hệ thống microservice hoặc Clean Architecture đầy đủ.

| Lớp | Trách nhiệm | Mã nguồn |
| --- | --- | --- |
| React pages/components | Điều hướng, trạng thái giao diện, lựa chọn xung đột, phát âm thanh | `frontend/src/pages`, `frontend/src/components` |
| React hooks/API | HTTP, tải danh mục, hàng đợi đồng bộ tiến độ | `frontend/src/api`, `frontend/src/hooks` |
| Routes/schemas | Xác thực, phân quyền, giới hạn đầu vào, hợp đồng API | `backend/app/routes`, `backend/app/schemas` |
| Services | Sách/truyện, ghi chú, tiến độ, AI/TTS, quản trị | `backend/app/services` |
| Persistence | MySQL, SQLAlchemy async, migration Alembic | `backend/app/models`, `backend/migrations` |
| Hạ tầng | Redis cho OTP/rate limit; volume cho upload; Nginx reverse proxy | `compose.yaml`, `frontend/nginx.conf` |

## Tiến độ đọc và xung đột

Khóa chính của tiến độ là `(user_id, book_id)`. Client gửi vị trí cùng `base_revision` và `mutation_id`. Server tạo hàng nếu thiếu, khóa hàng trong transaction, rồi so sánh revision. Nếu khớp, server cập nhật vị trí và tăng revision; nếu không khớp, trả HTTP 409 cùng vị trí đang lưu. Gửi lại cùng mutation gần nhất trả kết quả cũ thay vì tăng revision lần nữa.

Client xếp các lần lưu vào hàng đợi để giảm yêu cầu ghi đè lẫn nhau. Khi gặp 409, giao diện yêu cầu chọn vị trí server hoặc giữ vị trí hiện tại. Đồng hồ thiết bị không quyết định bản nào thắng. Dữ liệu local được phân tách theo tài khoản và sách; sự kiện `online` kích hoạt thử lại, `pagehide` gửi bản còn chờ bằng keepalive.

Giới hạn: `mutation_id` chỉ nhận diện lần ghi gần nhất, không phải nhật ký idempotency vô hạn. Mất kết nối vẫn có thể cần người dùng giải quyết xung đột; đây không phải CRDT hoặc đồng bộ offline đầy đủ.

## Ghi chú theo nguồn

Ghi chú lưu đoạn trích, offset UTF-16, chương/trang và fingerprint nguồn. Offset thống nhất với JavaScript, bao gồm ký tự ngoài BMP như emoji. Khi nội dung đổi, backend thử định vị lại đoạn trích; đoạn không tìm được được đánh dấu `source_missing`. Trích dẫn mơ hồ không được tự ý gắn sang một vị trí khác.

## Xác thực

JWT chứa user ID, hạn sử dụng và phiên bản token. Mỗi request kiểm tra phiên bản với tài khoản trong database và dùng vai trò hiện tại của tài khoản để phân quyền. Đăng xuất/reset mật khẩu tăng phiên bản bằng SQL increment, thu hồi mọi token cũ. Thiết kế này chọn sự đơn giản và khả năng thu hồi ngay, đổi lại logout tác động đến tất cả thiết bị và mỗi request xác thực cần đọc DB.

Frontend dùng cookie HttpOnly và không lưu JWT trong localStorage/sessionStorage. Cookie production có Secure; nguồn browser gửi request ghi phải nằm trong CORS cho phép. Redis thực hiện kiểm tra OTP bằng Lua để số lần thử và thao tác dùng một lần là nguyên tử giữa nhiều worker. Redis lỗi trả lỗi dịch vụ, không tự chuyển sang bộ nhớ của từng worker.

## Danh mục và hiệu năng

Danh mục được lọc, sắp xếp và phân trang trong MySQL. Rating và favorite được tổng hợp riêng trước khi join để tránh nhân số đếm. Thứ tự có khóa phụ ID để phân trang ổn định khi các giá trị bằng nhau. Tủ sách dùng union và `row_number()` để một sách vừa lưu vừa yêu thích chỉ xuất hiện một lần, rồi mới phân trang.

Tìm kiếm hiện dùng chuỗi con có escape ký tự wildcard. Index thông thường không giải quyết hoàn toàn truy vấn `%keyword%`; cần đo và cân nhắc full-text khi quy mô tăng. Chương truyện được tải riêng. HTML sách có cache LRU cục bộ theo phiên bản file, được đọc/parse trong thread để không chặn event loop. Giới hạn dung lượng cache là ước lượng kích thước object Python, không phải giới hạn RAM toàn process.

## AI và âm thanh

AI lấy nguồn từ backend, giới hạn độ dài ngữ cảnh và lọc trích dẫn theo chuỗi nguồn. Chưa có embedding, vector database hoặc đánh giá semantic entailment; không gọi tính năng này là RAG.

TTS chia đoạn văn bản, cache theo nội dung/giọng, chia sẻ tác vụ đang tạo trong cùng process, giới hạn hàng đợi và concurrency. Client tải trước một đoạn; chuyển trang hủy âm thanh cũ. TTS vẫn phụ thuộc dịch vụ Microsoft bên ngoài. Hàng đợi TTS và cache reader là cục bộ theo process, nên chưa có bảo đảm giới hạn tổng khi tăng số worker.

## Dữ liệu và migration

Các quan hệ chính: user tải nhiều book; book có rating/comment/favorite/save và tiến độ theo user; story mở rộng book và chứa nhiều chapter; annotation thuộc user/book, có thể neo theo chapter. SQL demo có một số ràng buộc khác với schema tạo mới từ ORM; baseline migration bổ sung các trường cần thiết và index có chọn lọc, chưa tự sửa toàn bộ ràng buộc của dữ liệu cũ.

Alembic ghi phiên bản trong `alembic_version`; migration baseline hỗ trợ cả database trống và database demo cũ. Baseline không hỗ trợ downgrade phá dữ liệu; khôi phục bằng backup nếu cần quay lại. Chỉ chạy migration một lần trong quy trình release trước khi khởi động nhiều replica.
