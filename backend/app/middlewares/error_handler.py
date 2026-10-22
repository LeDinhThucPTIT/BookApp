import logging
import traceback

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.utils.exceptions import AppError
from app.utils.responses import failure

logger = logging.getLogger(__name__)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return failure(exc.message, exc.status_code, exc.error_code, exc.details)

    @app.exception_handler(RateLimitExceeded)
    async def handle_rate_limit(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return failure("Quá nhiều yêu cầu, vui lòng thử lại sau!", 429, "RATE_LIMITED")

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        return failure(
            "Dữ liệu không hợp lệ!",
            422,
            "VALIDATION_ERROR",
            exc.errors(),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "HTTP error"
        return failure(detail, exc.status_code, "HTTP_ERROR")

    @app.exception_handler(IntegrityError)
    async def handle_integrity(_: Request, exc: IntegrityError) -> JSONResponse:
        logger.warning("Database integrity constraint failed")
        return failure(
            "Dữ liệu bị trùng hoặc vi phạm ràng buộc!",
            409,
            "INTEGRITY_ERROR",
        )

    @app.exception_handler(SQLAlchemyError)
    async def handle_db(_: Request, exc: SQLAlchemyError) -> JSONResponse:
        # Stack trace without rendering SQLAlchemy exception text (it can include bound data).
        logger.error("Database operation failed: %s\n%s", type(exc).__name__, ''.join(traceback.format_tb(exc.__traceback__)))
        return failure("Lỗi cơ sở dữ liệu!", 500, "DATABASE_ERROR")

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.error("Unexpected server error: %s\n%s", type(exc).__name__, ''.join(traceback.format_tb(exc.__traceback__)))
        return failure("Lỗi server!", 500, "INTERNAL_ERROR")
