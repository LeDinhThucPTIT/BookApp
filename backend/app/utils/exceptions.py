class AppError(Exception):
    """Domain error mapped to a JSON API response."""

    def __init__(
        self,
        message: str,
        status_code: int = 400,
        error_code: str = "BAD_REQUEST",
        details: object | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Chưa đăng nhập!") -> None:
        super().__init__(message, 401, "UNAUTHORIZED")


class ForbiddenError(AppError):
    def __init__(self, message: str = "Không có quyền thực hiện thao tác này!") -> None:
        super().__init__(message, 403, "FORBIDDEN")


class NotFoundError(AppError):
    def __init__(self, message: str = "Không tìm thấy dữ liệu!") -> None:
        super().__init__(message, 404, "NOT_FOUND")
