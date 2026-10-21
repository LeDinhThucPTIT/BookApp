import secrets
import time
from dataclasses import dataclass

from app.utils.exceptions import AppError


@dataclass
class OTPRecord:
    user_id: int
    otp: str
    expires_at: float


class OTPStore:
    def __init__(self) -> None:
        self._items: dict[str, OTPRecord] = {}

    def create(self, user_id: int, ttl_seconds: int = 600) -> tuple[str, str]:
        token = secrets.token_urlsafe(24)
        otp = f"{secrets.randbelow(1_000_000):06d}"
        self._items[token] = OTPRecord(user_id, otp, time.time() + ttl_seconds)
        return token, otp

    def consume(self, token: str, otp: str) -> int:
        record = self._items.get(token)
        if not record:
            raise AppError("Không có mã OTP hợp lệ!", 400, "OTP_MISSING")
        if time.time() > record.expires_at:
            self._items.pop(token, None)
            raise AppError("Mã OTP đã hết hạn!", 400, "OTP_EXPIRED")
        if otp != record.otp:
            raise AppError("Mã OTP không chính xác!", 400, "OTP_INVALID")
        self._items.pop(token, None)
        return record.user_id


otp_store = OTPStore()
