# Kết quả kiểm chứng cục bộ

Ngày thực hiện: **22/10/2026**, múi giờ Việt Nam (UTC+7). Mã nguồn được kiểm tra trực tiếp trên Windows với Python 3.12, Node.js và MySQL 8. Các dependency Python được khóa trong `backend/requirements.lock`; công cụ kiểm thử bổ sung ở `requirements-dev.lock`.

## Các kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| Frontend utility tests | 20 test pass: reader, audio lifecycle, theme và draft |
| Oxlint | Không còn error/warning ở lần kiểm tra cuối |
| Frontend production build | Build Vite thành công |
| Backend/API/MySQL | 36 test được phát hiện; 34 pass, 2 skip có chủ đích |
| Alembic migration | Upgrade hai lần liên tiếp thành công trên database demo tạm |
| Playwright | 6/6 luồng chức năng pass, chạy bằng runner database tạm |
| Redis OTP | Lua được chạy bằng fakeredis + Lua runtime; test Redis server thực riêng được cấu hình cho CI |
| YAML | Đọc được Compose 4 service và workflow 3 job; chưa tương đương Docker build/Compose validation bằng Docker CLI |

Hai test backend bỏ qua cục bộ là Redis server thực và Microsoft TTS live. Các ca Gemini dùng mock, không xác minh tài khoản/model API thực tế. Test chụp ảnh là công cụ chạy riêng có cờ môi trường, được skip trong suite chức năng thông thường.

## Phạm vi kiểm thử

- Đăng ký, đăng nhập bằng cookie HttpOnly, ghi nhớ phiên, phân quyền và từ chối token sau logout/reset mật khẩu.
- Chặn mật khẩu plaintext/hash lỗi, cấu hình production sai, OTP hết hạn, nhập sai quá giới hạn, dùng lại và consume đồng thời.
- Tìm kiếm, phân trang, số lượt yêu thích thật, xếp hạng rating, tủ sách loại trùng và cách ly tài khoản, bình luận phân trang.
- Khôi phục tiến độ, stale writes, mutation gần nhất, ghi chú UTF-16, nguồn bị đổi và quyền sửa nội dung.
- Cache nội dung sách, invalidation sau chỉnh sửa và bỏ qua kết quả lớn hơn ngân sách cache.
- TTS cache, gộp yêu cầu, hủy phát, prefetch, lỗi mạng/autoplay và kiểm tra nguồn audio phía server.
- File giả định dạng, rỗng, quá lớn/hỏng và dọn file khi xử lý thất bại.
- Transaction commit trước khi gửi response thành công; commit thất bại trả lỗi thay vì báo lưu thành công.

Playwright chạy đăng nhập/logout/phân quyền, resume sau reload, ghi chú sau reload, xung đột hai browser context, tìm kiếm server và luồng tủ sách/bình luận. E2E có phát hiện lỗi vùng bấm nút bỏ lưu bằng 0; CSS đã bổ sung vùng bấm rõ ràng và focus outline.

## Cách chạy lại

```sh
# frontend
npm ci
npm test
npm run lint
npm run build
npx playwright install chromium

# backend, sau khi kích hoạt virtualenv
python -m pip install -r requirements-dev.lock
python test_mysql.py --e2e --benchmark
```

Runner sử dụng thông tin kết nối MySQL trong `backend/.env`, cần quyền tạo database. Nó tạo tên `bookapp_test_<uuid>`, import SQL chỉ vào database đó, chạy migration/test và dọn đúng database được tạo. Không import SQL hoặc reset database người dùng đang sử dụng. Nếu không có quyền tạo DB, dùng một database test được cấp riêng và quy trình CI trong `.github/workflows/ci.yml`.

## Đo hiệu năng

[benchmark-local.json](benchmark-local.json) lưu lần đo thực tế gần nhất: thêm 1.000 sách trong transaction, đọc danh mục với trang 12 mục qua HTTPX ASGI và MySQL local, có warmup rồi lấy p50/p95. Transaction sinh dữ liệu được rollback.

Đây là phép đo API trong process, tuần tự, không có network/TLS và không mô phỏng người dùng đồng thời. Dataset bổ sung chưa tạo thêm lượng lớn rating/favorite. Không có benchmark phiên bản trước để khẳng định phần trăm cải thiện. Số đo chỉ phục vụ tái lập và đặt nền cho load test sau này.

## Chưa xác minh

- Docker build và stack Compose thực tế: máy hiện tại không có Docker CLI/daemon; đã thêm job CI smoke test.
- GitHub Actions: workflow mới chưa được push/chạy và không có URL run đã xác minh.
- Hosting, domain, HTTPS và email thật: chưa cấu hình dịch vụ bên ngoài.
- Khả năng chịu tải đồng thời, độ chính xác AI, uptime và recovery từ backup: chưa được đo/diễn tập đầy đủ.
