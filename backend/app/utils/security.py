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
    if stored_password.startswith(("pbkdf2:", "scrypt:", "argon2")):
        return check_password_hash(stored_password, plain_password)
    return stored_password == plain_password


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise UnauthorizedError("Token không hợp lệ hoặc đã hết hạn!") from exc
