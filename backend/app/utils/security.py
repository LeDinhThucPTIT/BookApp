from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from werkzeug.security import check_password_hash, generate_password_hash

from app.config import settings
from app.utils.exceptions import UnauthorizedError


def hash_password(password: str) -> str:
    return generate_password_hash(password, method="pbkdf2:sha256")


def verify_password(plain_password: str, stored_password: str) -> bool:
    if not stored_password:
        return False
    if not stored_password.startswith(("pbkdf2:", "scrypt:")):
        return False
    try:
        return check_password_hash(stored_password, plain_password)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, role: str, token_version: int = 0) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "role": role, "exp": expire, "ver": token_version}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm], options={"require_exp": True, "require_sub": True})
    except JWTError as exc:
        raise UnauthorizedError("Token không hợp lệ hoặc đã hết hạn!") from exc
