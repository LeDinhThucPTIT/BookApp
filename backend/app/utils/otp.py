"""Single-use OTPs; Redis shares state across workers in deployed environments."""
import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass

from redis.asyncio import Redis
from redis.exceptions import RedisError
from app.config import settings
from app.utils.exceptions import AppError

MAX_ATTEMPTS = 5
CREATE_SCRIPT = """
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
local old = redis.call('GET', KEYS[3])
if old then redis.call('DEL', old) end
redis.call('HSET', KEYS[1], 'user', ARGV[1], 'hash', ARGV[2], 'attempts', 0)
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('SET', KEYS[2], '1', 'EX', 60)
redis.call('SET', KEYS[3], KEYS[1], 'EX', ARGV[3])
return 1
"""
CONSUME_SCRIPT = """
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
if attempts > tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]); return -2 end
if redis.call('HGET', KEYS[1], 'hash') ~= ARGV[1] then
    if attempts >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]); return -2 end
    return -3
end
local user = redis.call('HGET', KEYS[1], 'user')
redis.call('DEL', KEYS[1])
return tonumber(user)
"""


@dataclass
class OTPRecord:
    user_id: int
    digest: str
    expires_at: float
    attempts: int = 0


class OTPStore:
    def __init__(self, redis_url: str | None = None) -> None:
        self.redis_url = redis_url
        self._items: dict[str, OTPRecord] = {}
        self._cooldowns: dict[int, float] = {}

    @staticmethod
    def _digest(token: str, otp: str) -> str:
        return hmac.new(settings.secret_key.encode(), f"{token}:{otp}".encode(), hashlib.sha256).hexdigest()

    @staticmethod
    def _key(token: str) -> str:
        return "bookapp:otp:" + hashlib.sha256(token.encode()).hexdigest()

    async def create(self, user_id: int, ttl_seconds: int = 600) -> tuple[str, str]:
        token, otp = secrets.token_urlsafe(24), f"{secrets.randbelow(1_000_000):06d}"
        digest = self._digest(token, otp)
        if self.redis_url:
            try:
                async with Redis.from_url(self.redis_url) as client:
                    created = await client.eval(CREATE_SCRIPT, 3, self._key(token),
                        f"bookapp:otp:cooldown:{user_id}", f"bookapp:otp:active:{user_id}", user_id, digest, ttl_seconds)
            except RedisError as exc:
                raise AppError("Dịch vụ xác thực tạm thời không khả dụng.", 503, "AUTH_UNAVAILABLE") from exc
            if not created:
                raise AppError("Vui lòng đợi 60 giây trước khi yêu cầu mã mới.", 429, "OTP_COOLDOWN")
        else:
            now = time.time()
            self._items = {key: value for key, value in self._items.items() if value.expires_at > now}
            self._cooldowns = {key: value for key, value in self._cooldowns.items() if value > now}
            if user_id in self._cooldowns:
                raise AppError("Vui lòng đợi 60 giây trước khi yêu cầu mã mới.", 429, "OTP_COOLDOWN")
            self._items = {key: value for key, value in self._items.items() if value.user_id != user_id}
            if len(self._items) >= 10000:
                raise AppError("Dịch vụ xác thực đang bận.", 503, "AUTH_UNAVAILABLE")
            self._items[self._key(token)] = OTPRecord(user_id, digest, now + ttl_seconds)
            self._cooldowns[user_id] = now + 60
        return token, otp

    async def consume(self, token: str, otp: str) -> int:
        digest = self._digest(token, otp)
        if self.redis_url:
            try:
                async with Redis.from_url(self.redis_url) as client:
                    result = await client.eval(CONSUME_SCRIPT, 1, self._key(token), digest, MAX_ATTEMPTS)
            except RedisError as exc:
                raise AppError("Dịch vụ xác thực tạm thời không khả dụng.", 503, "AUTH_UNAVAILABLE") from exc
        else:
            key = self._key(token)
            record = self._items.get(key)
            if not record or time.time() >= record.expires_at:
                self._items.pop(key, None)
                result = -1
            else:
                record.attempts += 1
                if hmac.compare_digest(record.digest, digest):
                    self._items.pop(key)
                    result = record.user_id
                elif record.attempts >= MAX_ATTEMPTS:
                    self._items.pop(key)
                    result = -2
                else:
                    result = -3
        if result > 0:
            return int(result)
        if result == -2:
            raise AppError("Mã OTP đã bị khóa. Vui lòng yêu cầu mã mới.", 400, "OTP_LOCKED")
        if result == -3:
            raise AppError("Mã OTP không chính xác!", 400, "OTP_INVALID")
        raise AppError("Mã OTP không hợp lệ hoặc đã hết hạn!", 400, "OTP_MISSING")


otp_store = OTPStore(settings.redis_url)
