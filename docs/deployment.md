# Chạy demo và triển khai

## Docker trên máy cá nhân

```sh
python scripts/setup_demo.py
docker compose up --build -d
docker compose ps
```

Mở `http://localhost:8080`, kiểm tra `http://localhost:8080/health/ready`. Database và Redis không publish cổng ra host. Backend không mở cổng riêng; Nginx chuyển tiếp API/static và hỗ trợ SPA deep link. Volume riêng giữ MySQL, Redis, PDF, HTML, ảnh bìa và cache TTS. Container backend chạy bằng user không phải root.

Lệnh tạo cấu hình giữ nguyên `.env` hiện có. Nếu file đã có nhưng chưa chứa `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `JWT_SECRET_KEY`, cần điền các biến này bằng giá trị ngẫu nhiên. Secret được sinh vào file cục bộ, không in ra terminal.

SQL demo chỉ chạy khi MySQL khởi tạo volume lần đầu. Thay mật khẩu trong `.env` sau lần khởi tạo không tự đổi mật khẩu tài khoản MySQL đã nằm trong volume. Dùng quy trình đổi mật khẩu của MySQL khi cần thay secret. Không xóa volume để giải quyết lỗi khởi động nếu cần giữ dữ liệu.

```sh
docker compose logs --tail=100 backend
docker compose down
```

`down` giữ dữ liệu. Tránh thêm `-v` khi muốn giữ database/upload.

## HTTPS trên máy chủ

Đặt Caddy hoặc reverse proxy HTTPS trước cổng localhost 8080. Domain/hosting chưa được cấu hình sẵn trong repository. Trước khi khởi động chế độ production, sửa `.env` gốc:

```dotenv
APP_ENV=production
CORS_ORIGINS=https://books.example.com
```

Tên miền ở trên là ví dụ, cần thay bằng domain thực tế. Compose đã đặt `DEBUG=false` và Redis nội bộ; secret sinh bởi setup đủ độ dài. Production bật cookie Secure nên phải truy cập bằng HTTPS. Đăng nhập qua HTTP sẽ không giữ được cookie production.

Backend Docker tin proxy header trong network nội bộ vì cổng backend không publish; Nginx ghi đè X-Forwarded-For bằng địa chỉ client nó nhận được. Nếu thêm proxy khác phía trước Nginx, cấu hình danh sách proxy tin cậy/real IP để rate limit không gom tất cả người dùng thành một IP. Không mở cổng backend trực tiếp ra Internet khi dùng cấu hình tin proxy này.

Để dùng AI/email, điền `GEMINI_API_KEY`, `GEMINI_MODEL`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_DEFAULT_SENDER` vào `.env` gốc. Chọn model mà tài khoản API thực sự truy cập được; model mặc định không được kiểm chứng bằng lời gọi live trong đợt hoàn thiện này.

Demo chứa tài khoản admin công khai và cho phép upload. Nếu triển khai cho người dùng thật, thay/xóa tài khoản demo bằng quy trình quản trị riêng trước khi mở truy cập. Không coi việc đổi JWT secret là đổi mật khẩu tài khoản.

## Migration, backup và kiểm tra release

`python migrate.py` tương đương Alembic upgrade head, không import lại SQL demo. Sao lưu DB và các volume upload trước thay đổi schema. Chạy migration một lần trước rollout nhiều instance. Baseline chỉ hỗ trợ upgrade; không có downgrade tự động xóa cột/bảng.

`/health` kiểm tra API process. `/health/ready` truy vấn MySQL và ping Redis khi được cấu hình, timeout khoảng 3 giây. Healthcheck chưa xác nhận Gemini/SMTP/Microsoft hoạt động, quyền ghi volume hoặc toàn bộ tính đúng của schema.

Log request chứa request ID, method, path, status và thời gian; response có `X-Request-ID`. Log không ghi request body/query/headers xác thực. Dùng ID này để nối lỗi người dùng với log khi hỗ trợ.

Docker Compose hiện chạy một backend process. Trước khi tăng worker/replica cần quyết định storage dùng chung và giới hạn TTS tổng; Redis đã hỗ trợ OTP/rate limit dùng chung nhưng không thay thế hàng đợi TTS phân tán.

## Trạng thái xác minh

Máy thực hiện đợt hoàn thiện này không có Docker CLI/daemon. File Compose và Dockerfile đã được chuẩn bị; job GitHub Actions kiểm tra cấu hình, dựng stack và gọi readiness. Chưa khẳng định Docker build hoặc job trên GitHub thành công trước khi có kết quả chạy thực tế. Các test MySQL và trình duyệt được chạy trực tiếp trên Windows; xem `verification.md`.
