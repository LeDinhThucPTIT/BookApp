from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Đảm bảo thư mục backend luôn nằm trong sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
import uvicorn

from app.config import settings
from app.middlewares import register_cors, register_error_handlers, register_rate_limiting
from app.routes import register_routes
from app.utils.responses import success
from app.middlewares.request_context import register_request_context


@asynccontextmanager
async def lifespan(_: FastAPI):
    import logging
    request_logger = logging.getLogger("bookapp.requests")
    if not request_logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
        request_logger.addHandler(handler)
    request_logger.setLevel(logging.INFO)
    request_logger.propagate = False
    settings.upload_cover_dir.mkdir(parents=True, exist_ok=True)
    settings.upload_book_dir.mkdir(parents=True, exist_ok=True)
    settings.upload_html_dir.mkdir(parents=True, exist_ok=True)
    yield


def custom_openapi(app: FastAPI) -> dict:
    if app.openapi_schema:
        return app.openapi_schema
    schema = get_openapi(
        title=settings.app_name,
        version="2.0.0",
        description=(
            "BookApp REST API — Clean/Layered Architecture.\n\n"
            "Xác thực JWT: nhấn **Authorize** và dán `Bearer <token>` "
            "lấy từ `POST /api/v1/auth/login`."
        ),
        routes=app.routes,
    )
    components = schema.setdefault("components", {})
    schemes = components.setdefault("securitySchemes", {})
    schemes["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
    }
    schema["servers"] = [{"url": "/", "description": "Current host"}]
    for path_item in schema.get("paths", {}).values():
        for operation in path_item.values():
            if not isinstance(operation, dict):
                continue
            params = operation.get("parameters") or []
            has_bearer = any(
                param.get("name") == "authorization" and param.get("in") == "header"
                for param in params
            )
            security = operation.get("security") or []
            if has_bearer or any("HTTPBearer" in item or "BearerAuth" in item for item in security):
                operation["security"] = [{"BearerAuth": []}]
    app.openapi_schema = schema
    return schema


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
        swagger_ui_parameters={"persistAuthorization": True},
        openapi_tags=[
            {"name": "Auth", "description": "Đăng ký, đăng nhập JWT, OTP"},
            {"name": "Users", "description": "Hồ sơ người dùng"},
            {"name": "Books", "description": "Sách, nội dung HTML, upload"},
            {"name": "Library", "description": "Yêu thích, lưu, bình luận, đánh giá, lịch sử"},
            {"name": "Admin", "description": "Thống kê và quản trị"},
            {"name": "AI Assistant", "description": "Tóm tắt chương sách và hỏi đáp với Google Gemini AI"},
            {"name": "Health", "description": "Kiểm tra trạng thái API"},
        ],
    )
    register_cors(app)
    register_rate_limiting(app)
    register_request_context(app)
    register_error_handlers(app)
    register_routes(app)

    @app.get("/health", tags=["Health"], include_in_schema=True)
    async def health():
        return success({"status": "ok"}, "BookApp API is running")

    @app.get("/health/ready", tags=["Health"])
    async def readiness():
        from sqlalchemy import text
        from app.models import SessionLocal
        from app.utils.responses import failure
        import asyncio
        try:
            async with asyncio.timeout(3):
                async with SessionLocal() as db:
                    await db.execute(text("SELECT 1"))
                if settings.redis_url:
                    from redis.asyncio import Redis
                    async with Redis.from_url(settings.redis_url) as redis:
                        await redis.ping()
        except Exception:
            return failure("Dịch vụ chưa sẵn sàng.", 503, "NOT_READY")
        return success({"status": "ready"})

    app.mount("/static", StaticFiles(directory=str(settings.static_dir)), name="static")
    app.openapi = lambda: custom_openapi(app)
    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
