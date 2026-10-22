import logging
import time
from uuid import uuid4

from fastapi import FastAPI, Request

from app.config import settings
from app.utils.responses import failure

logger = logging.getLogger("bookapp.requests")


def register_request_context(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_context(request: Request, call_next):
        request_id = uuid4().hex
        request.state.request_id = request_id
        started = time.perf_counter()
        # Same-origin deployment + SameSite cookies; reject browser writes from untrusted origins.
        origin = request.headers.get("origin")
        if request.method not in {"GET", "HEAD", "OPTIONS"} and origin and origin not in settings.cors_origin_list:
            response = failure("Nguồn yêu cầu không được phép.", 403, "ORIGIN_FORBIDDEN")
        else:
            response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        # Never log headers, query strings, request bodies, passwords or tokens.
        logger.info("request_id=%s method=%s path=%s status=%s duration_ms=%.1f", request_id,
            request.method, request.url.path, response.status_code, (time.perf_counter() - started) * 1000)
        return response
