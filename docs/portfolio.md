# BookApp trong CV và phỏng vấn

## Mô tả ngắn

BookApp là ứng dụng fullstack đọc sách và truyện theo chương, có ghi chú theo nội dung nguồn, đồng bộ tiến độ giữa phiên đọc, trợ lý AI và nghe đọc. Dự án tập trung vào tính đúng của dữ liệu, xử lý lỗi dịch vụ và kiểm thử các luồng người dùng.

## Bullet CV tiếng Việt

**BookApp — Nền tảng đọc sách và truyện có trợ lý AI**  
React, FastAPI, MySQL, SQLAlchemy Async, Redis, Gemini API, Edge TTS, Docker, Playwright

- Xây dựng ứng dụng fullstack hỗ trợ sách PDF, truyện theo chương, tủ sách, ghi chú và quản trị với phân quyền JWT; triển khai tìm kiếm, phân trang và xếp hạng theo dữ liệu thật ở phía server.
- Thiết kế đồng bộ tiến độ đọc bằng server revision, khóa hàng trong transaction và mutation ID; trả HTTP 409 để người dùng giải quyết xung đột giữa các phiên đọc.
- Tích hợp hỏi đáp AI có kiểm tra trích dẫn theo nội dung nguồn và TTS có cache, tải trước, hủy phát khi chuyển trang và giới hạn tác vụ đồng thời.
- Bổ sung thu hồi JWT sau logout/reset mật khẩu, OTP dùng Redis với giới hạn thử sai, migration Alembic và cấu hình Docker Compose; xây dựng kiểm thử API/MySQL và E2E bằng Playwright.

Chọn 3–4 bullet phù hợp vị trí ứng tuyển. Nếu là dự án nhóm, chỉ ghi phần trực tiếp thực hiện. Thêm URL repository và URL demo thực tế sau khi đã có; repository chưa chứa URL hosting đã xác minh.

## English version

**BookApp — Full-stack reading platform with an AI assistant**  
React, FastAPI, MySQL, async SQLAlchemy, Redis, Docker, Playwright

- Built a reading platform for PDFs and serialized stories with annotations, personal libraries, role-based administration, and server-side search, pagination, and popularity ranking.
- Implemented reading-progress synchronization using server revisions, transactional row locks, and mutation IDs, with explicit conflict resolution across reading sessions.
- Integrated source-checked AI citations and text-to-speech with content-based caching, segment prefetching, playback cancellation, and bounded synthesis concurrency.
- Added server-side JWT revocation, Redis-backed single-use OTPs, versioned database migrations, Docker Compose configuration, and API/MySQL/browser tests.

## Demo trong khoảng 3 phút

1. **0:00–0:30:** đăng nhập reader, tìm sách theo tên/tác giả, mở chi tiết. Chỉ ra mục yêu thích dùng số lượt thật.
2. **0:30–1:15:** đọc sách, chọn một đoạn, lưu ghi chú; chuyển trang rồi reload để cho thấy tiến độ và ghi chú được giữ.
3. **1:15–2:00:** mở hai browser context riêng cùng tài khoản. Tải cùng vị trí ban đầu, ghi từ context thứ nhất rồi context thứ hai để tạo xung đột; giải thích lựa chọn server/local. Hai tab chung localStorage có thể phản ánh dữ liệu khác với hai thiết bị, nên Playwright dùng context riêng.
4. **2:00–2:30:** trình diễn AI/TTS khi dịch vụ đã cấu hình và thử trước. Nếu chưa có key/kết nối, trình bày thông báo lỗi thực tế và test mock; không tạo kết quả giả để thay thế.
5. **2:30–3:00:** mở dashboard admin, giới thiệu test, migration và cấu hình triển khai. Nêu rõ phần đã kiểm chứng cục bộ và phần cần chạy trên hosting/CI.

## Câu hỏi phỏng vấn nên chuẩn bị

| Câu hỏi | Nội dung cần giải thích |
| --- | --- |
| Vì sao không so sánh timestamp client? | Đồng hồ thiết bị lệch; revision server xác định phiên bản dữ liệu một cách nhất quán. |
| Vì sao cần cả khóa hàng và revision? | Khóa ngăn cập nhật cạnh tranh trong transaction; revision phát hiện client đang dựa trên dữ liệu cũ. |
| Vì sao có mutation ID? | Request có thể được gửi lại khi kết nối gián đoạn; mutation gần nhất không tăng revision lần nữa. |
| Logout JWT hoạt động thế nào? | Token vẫn có chữ ký hợp lệ nhưng version không còn khớp DB; logout hiện thu hồi mọi phiên của tài khoản. |
| Vì sao OTP dùng Redis Lua? | Giới hạn thử sai và thao tác consume cần nguyên tử, có hiệu lực giữa các worker. |
| AI có phải RAG không? | Chưa có retrieval bằng embedding/vector; hiện lấy ngữ cảnh từ nội dung sách và kiểm tra chuỗi trích dẫn. |
| Cache thay đổi khi sửa nội dung thế nào? | HTML dùng mtime/size; TTS dùng hash nội dung/giọng, nên sửa nguồn tạo khóa âm thanh mới. |
| Điều gì chưa chứng minh được? | Chưa có load test production, SLA, độ chính xác AI định lượng hoặc kết quả Docker/GitHub Actions chạy thực tế trong môi trường này. |

## Số liệu có thể sử dụng

Số lượng test và kết quả local được ghi trong [verification.md](verification.md). Báo cáo [benchmark-local.json](benchmark-local.json) có môi trường, phương pháp và dữ liệu đo thật. Phép đo dùng ASGI trong cùng process với MySQL local, không gồm network/TLS hay tải đồng thời; không chuyển số này thành tuyên bố độ trễ production hoặc số người dùng phục vụ được.

Không ghi “production-ready”, “AI recommendation”, “RAG”, “hàng nghìn người dùng” hoặc “CI xanh” khi chưa có bằng chứng tương ứng. Điểm mạnh của dự án là xử lý nghiệp vụ và kiểm chứng có giới hạn rõ ràng.
