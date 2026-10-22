from fastapi import Cookie, Depends, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import User, get_db
from app.utils.exceptions import ForbiddenError, UnauthorizedError
from app.utils.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False, scheme_name="BearerAuth")


def _extract_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
    cookie_token: str | None,
) -> str:
    if credentials and credentials.credentials:
        return credentials.credentials
    if cookie_token:
        return cookie_token
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header.split(" ", 1)[1]
    raise UnauthorizedError()


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    access_token: str | None = Cookie(default=None, alias=settings.jwt_cookie_name),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _extract_token(request, credentials, access_token)
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id.isascii() or not user_id.isdigit() or len(user_id) > 10 or not 1 <= int(user_id) <= 2147483647:
        raise UnauthorizedError()

    user = await db.scalar(select(User).where(User.id == int(user_id)))
    if not user:
        raise UnauthorizedError("Tài khoản không tồn tại!")
    if type(payload.get("ver")) is not int or payload["ver"] != user.token_version:
        raise UnauthorizedError("Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại!")
    return user


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme),
    access_token: str | None = Cookie(default=None, alias=settings.jwt_cookie_name),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    try:
        return await get_current_user(request, credentials, access_token, db)
    except UnauthorizedError:
        return None


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise ForbiddenError("Chỉ admin mới được phép truy cập!")
    return user
