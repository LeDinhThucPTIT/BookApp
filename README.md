# BookApp

Nền tảng đọc sách và truyện theo chương, xây dựng bằng **React, FastAPI và MySQL**. BookApp hỗ trợ ghi chú theo nội dung nguồn, đồng bộ tiến độ đọc, hỏi đáp AI và nghe đọc tiếng Việt.

[Kiến trúc](docs/architecture.md) · [Triển khai](docs/deployment.md) · [Kiểm chứng](docs/verification.md) · [Demo và CV](docs/portfolio.md)

![Thư viện BookApp](docs/images/home.png)

Xem thêm: [Trình đọc](docs/images/reader.png) · [Truyện theo chương](docs/images/stories.png) · [Dashboard quản trị](docs/images/admin.png)

## Tính năng chính

- **Tài khoản:** đăng ký, đăng nhập JWT, phân quyền người đọc/admin, cập nhật hồ sơ và đặt lại mật khẩu qua email OTP.
- **Thư viện:** tìm theo tên sách/tác giả, phân trang phía server, xếp hạng theo lượt yêu thích và đánh giá; lưu sách, bình luận và xem lịch sử đọc.
- **Nội dung:** tải lên PDF; tạo truyện, quản lý chương, trạng thái truyện và bản nháp chương tự lưu trên thiết bị.
- **Trình đọc:** mục lục, phân trang, tùy chỉnh phông/cỡ chữ và theme sáng/tối/sepia; khôi phục tiến độ, tô sáng và ghi chú.
- **Đồng bộ:** dùng revision phía server để phát hiện xung đột giữa các phiên đọc, cho người dùng chọn vị trí cần giữ.
- **AI và âm thanh:** hỏi đáp/tóm tắt bằng Gemini, kiểm tra đoạn trích theo nguồn; nghe bằng Edge TTS với cache, tải trước và tự chuyển trang.
- **Quản trị:** dashboard dữ liệu thật, bộ lọc thời gian và quản lý sách, tài khoản, bình luận.

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 8, Tailwind CSS 4, Axios |
| Backend | FastAPI, Pydantic, SQLAlchemy async, aiomysql, JWT, SlowAPI |
| Dữ liệu và migration | MySQL 8, Redis, Alembic |
| Xử lý nội dung | pypdf, Beautiful Soup, Pillow, Gemini API, edge-tts |
| Kiểm thử | unittest, HTTPX, Node.js test runner, Playwright, Oxlint |
| Vận hành | Docker Compose, Nginx, GitHub Actions |

Backend dùng kiến trúc phân lớp `routes → services → models`, với schema kiểm tra đầu vào và transaction dùng chung trong mỗi request. Chi tiết đồng bộ tiến độ, ghi chú, xác thực và cache nằm trong [tài liệu kiến trúc](docs/architecture.md).

## Chạy bằng Docker

Yêu cầu Docker Engine/Desktop có Compose và Python để tạo cấu hình cục bộ. Từ thư mục gốc:

```sh
python scripts/setup_demo.py
docker compose up --build -d
```

| Dịch vụ | Địa chỉ |
| --- | --- |
| Giao diện | http://localhost:8080 |
| Swagger | http://localhost:8080/docs |
| Readiness | http://localhost:8080/health/ready |

Compose dựng frontend/Nginx, backend, MySQL và Redis. Script tạo `.env` ở thư mục gốc với secret ngẫu nhiên, giữ nguyên file nếu đã tồn tại. SQL demo chỉ được import khi volume MySQL chưa có dữ liệu.

```sh
docker compose ps
docker compose logs --tail=100 backend
docker compose down
```

`down` giữ database và upload trong volume. Cấu hình mặc định chỉ mở cổng trên máy cá nhân. Xem [hướng dẫn triển khai](docs/deployment.md) để cấu hình HTTPS, domain và môi trường production.

## Chạy trực tiếp trên máy

Yêu cầu **Python 3.12**, **Node.js 22.12+**, **npm** và **MySQL 8.0+**. Redis tùy chọn trong development, bắt buộc khi chạy `APP_ENV=production`.

### 1. Chuẩn bị database demo

Tạo database riêng bằng MySQL Workbench hoặc MySQL CLI:

```sql
CREATE DATABASE bookapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Import `backend/bookapp.sql` vào database vừa tạo. Lệnh dưới đây dùng trong **Bash hoặc Windows Command Prompt**, từ thư mục gốc; PowerShell không hỗ trợ cú pháp chuyển hướng `<` này:

```sh
mysql -u root -p bookapp < backend/bookapp.sql
```

**SQL demo có lệnh `DROP TABLE`; chỉ import vào database demo riêng.** Nếu đang dùng database có dữ liệu cần giữ, sao lưu và chạy migration thay vì import lại SQL. Giữ thư mục `backend/app/static/seed/` vì dữ liệu demo tham chiếu các file này.

### 2. Khởi động backend

Windows PowerShell:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.lock
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Chỉnh `backend/.env`: điền kết nối MySQL và thay `JWT_SECRET_KEY` bằng secret ngẫu nhiên. Để `FLASK_SECRET_KEY` trống nếu không dùng cấu hình cũ.

```powershell
python migrate.py
python main.py
```

Linux/macOS dùng `python3.12 -m venv .venv` và `source .venv/bin/activate`. Sao chép `.env.example` thành `.env` nếu chưa có, sau đó chạy các lệnh cài dependency, migration và khởi động như trên.

`requirements.lock` khóa phiên bản dependency dùng để cài đặt; `requirements.txt` khai báo khoảng phiên bản để chủ động nâng cấp. Migration cần quyền CREATE/ALTER và có thể chạy lại.

### 3. Khởi động frontend

Mở terminal khác từ thư mục gốc:

```sh
cd frontend
npm ci
npm run dev
```

| Dịch vụ | Địa chỉ |
| --- | --- |
| Giao diện | http://localhost:5173 |
| Backend | http://127.0.0.1:5000 |
| Swagger | http://127.0.0.1:5000/docs |
| Readiness | http://127.0.0.1:5000/health/ready |

Vite chuyển tiếp `/api`, `/static` và `/health` tới backend. `npm run build` tạo frontend trong `frontend/dist`.

## Dữ liệu và tài khoản demo

Bộ demo gồm **6 sách, 4 truyện với 16 chương**, ảnh bìa, đánh giá, bình luận, tủ sách, ghi chú và tiến độ mẫu. Nội dung được biên soạn trong `backend/seed_catalog.py`.

| Email | Mật khẩu | Vai trò |
| --- | --- | --- |
| `admin@bookapp.vn` | `Admin@12345` | Quản trị |
| `reader@bookapp.vn` | `Reader@12345` | Người đọc có dữ liệu mẫu |
| `linh@bookapp.vn` | `Reader@12345` | Người đọc |

Đây là tài khoản công khai cho demo. Thay tài khoản và secret trước khi mở dịch vụ cho người dùng thật. Công cụ reset/xuất dữ liệu là `backend/reset_demo_data.py`; đọc `python reset_demo_data.py --help` trước khi sử dụng vì reset thay toàn bộ dữ liệu ứng dụng.

## Cấu hình môi trường

Docker dùng `.env` ở **thư mục gốc**; backend chạy trực tiếp dùng **`backend/.env`**. Hai file phục vụ hai cách chạy khác nhau và đều không được commit.

| Biến | Mục đích |
| --- | --- |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | Kết nối MySQL; Compose thiết lập host/database/user nội bộ |
| `JWT_SECRET_KEY` | Khóa ký JWT; production yêu cầu tối thiểu 32 ký tự |
| `APP_ENV`, `DEBUG`, `CORS_ORIGINS` | Môi trường chạy và nguồn frontend được phép |
| `REDIS_URL` | Chia sẻ OTP/rate limit; Compose thiết lập Redis nội bộ |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Hỏi đáp và tóm tắt; chọn model mà tài khoản truy cập được |
| `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_DEFAULT_SENDER` | Email OTP; backend chạy trực tiếp còn hỗ trợ cấu hình SMTP host/port trong settings |

Đọc sách cơ bản không cần Gemini hoặc SMTP. Edge TTS không cần API key nhưng cần Internet; nội dung đoạn đọc được gửi tới Microsoft để tạo âm thanh. Gemini/email/TTS trả lỗi khi thiếu cấu hình hoặc dịch vụ không phản hồi.

Trình duyệt dùng cookie `HttpOnly`, `SameSite=Lax`; production bật `Secure`. Đăng xuất hoặc đặt lại mật khẩu thu hồi **mọi phiên đăng nhập của tài khoản**. Production yêu cầu `DEBUG=false`, secret riêng, Redis và CORS HTTPS. Xem [deployment.md](docs/deployment.md) để cấu hình đầy đủ.

## Kiểm thử

Từ `frontend/`:

```sh
npm test
npm run lint
npm run build
```

Từ `backend/`, sau khi kích hoạt virtualenv:

```sh
python -m pip install -r requirements-dev.lock
python -m unittest discover -s tests -v
```

Để chạy MySQL integration và E2E trên **database tạm riêng**, cài Chromium một lần từ `frontend/`:

```sh
npx playwright install chromium
```

Sau đó chạy từ `backend/`, với kết nối MySQL có quyền tạo database:

```sh
python test_mysql.py --e2e
```

Runner tạo database tên ngẫu nhiên, import demo, kiểm tra migration hai lần, chạy test rồi xóa đúng database tạm đó. Các tùy chọn bổ sung:

| Lệnh trong `backend/` | Mục đích |
| --- | --- |
| `python test_mysql.py --benchmark` | Đo API trong process với MySQL local, lưu báo cáo vào `docs/benchmark-local.json` |
| `python test_mysql.py --screenshots` | Chụp lại ảnh giao diện demo trong `docs/images/` |

Kết quả đã ghi nhận: **20 test frontend, 34 test backend và 6 luồng E2E pass**; 2 test backend phụ thuộc Redis server thật/TTS trực tuyến được bỏ qua cục bộ. Gemini dùng mock. Xem [phạm vi và giới hạn kiểm chứng](docs/verification.md).

GitHub Actions có job frontend, backend/MySQL/Redis/E2E và Docker smoke test. Kết quả workflow trên GitHub và Docker stack thực tế chưa được xác nhận trong môi trường hiện tại.

## Cấu trúc repository

```text
backend/
  app/
    config/         Cấu hình môi trường
    middlewares/    Xác thực, rate limit, xử lý lỗi và request ID
    models/         SQLAlchemy models và database session
    routes/         REST API
    schemas/        Validation và response models
    services/       Nghiệp vụ, AI, TTS và lưu trữ
    static/seed/    Nội dung/ảnh bìa demo được theo dõi trên Git
    utils/          Tiện ích dùng chung
  migrations/       Phiên bản migration Alembic
  tests/            Kiểm thử backend
  bookapp.sql       Schema và dữ liệu demo
  migrate.py        Chạy migration đến phiên bản mới nhất
frontend/
  src/
    api/            HTTP client và API wrappers
    components/     Thành phần giao diện
    context/        Authentication và theme
    hooks/          Logic dùng lại: catalog, tiến độ, bản nháp
    pages/          Trang người đọc và admin
    styles/         CSS
    utils/          Tiện ích và unit tests
  e2e/              Kiểm thử trình duyệt và chụp ảnh demo
  public/           Asset giao diện
scripts/            Tạo cấu hình Docker và dọn file sinh tự động
docs/               Kiến trúc, triển khai, kiểm chứng và ảnh demo
.github/workflows/  CI
compose.yaml        Stack demo Docker
```

Schema API chi tiết nằm tại Swagger `/docs`. Các nhóm chính dưới `/api/v1`: `/auth`, `/users`, `/books`, `/stories`, `/library`, `/history`, `/admin` và `/ai`. Danh mục phân trang dùng `/books/catalog`; bình luận phân trang dùng `/books/{id}/comments/page`.

## Dọn file sinh tự động

Từ thư mục gốc:

```sh
python scripts/clean.py --dry-run
python scripts/clean.py
```

Script chỉ xóa bản build frontend, báo cáo/kết quả Playwright và Python bytecode trong mã nguồn. Dependency, virtualenv, `.env`, backup, upload và cache TTS được giữ nguyên. `.gitignore` loại các file cục bộ này khỏi Git.

## Giới hạn hiện tại

- Chưa hỗ trợ OCR cho PDF scan; trình xem PDF nhúng chưa theo dõi được vị trí trang bên trong.
- Bản nháp chỉ lưu trên thiết bị. Google/Facebook login chưa được triển khai.
- AI chỉ kiểm tra đoạn trích có trong nguồn, không đảm bảo kết luận đúng; chưa có vector search/RAG hoặc bộ đánh giá chất lượng AI chuẩn.
- Danh sách truyện, lịch sử và một số danh sách quản trị vẫn cần phân trang server khi quy mô tăng. Chưa có kiểm thử tải đồng thời hoặc cam kết uptime.
- Edge TTS phụ thuộc dịch vụ bên ngoài. Docker, hosting và CI cần được kiểm chứng trên môi trường triển khai thực tế.

Tài liệu bổ sung: [quyết định kỹ thuật](docs/architecture.md), [triển khai và vận hành](docs/deployment.md), [kết quả kiểm chứng](docs/verification.md), [kịch bản demo và mô tả CV](docs/portfolio.md).
