from typing import Any

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse


def success(data: Any = None, message: str = "OK", status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "message": message, "data": jsonable_encoder(data)},
    )


def failure(
    message: str,
    status_code: int = 400,
    error_code: str = "ERROR",
    details: Any = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "error": message,
            "error_code": error_code,
            "details": jsonable_encoder(details),
        },
    )
