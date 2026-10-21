from uuid import uuid4

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import User
from app.schemas.auth import LoginRequest, RegisterRequest, ResetPasswordRequest
from app.schemas.user import UserPublic
from app.services.mail_service import send_email
from app.utils.exceptions import AppError, NotFoundError, UnauthorizedError
from app.utils.otp import otp_store
from app.utils.security import create_access_token, hash_password, verify_password


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def register(self, payload: RegisterRequest) -> UserPublic:
        existing = await self.db.scalar(
            select(User.id).where(or_(User.email == payload.email, User.sdt == payload.sdt))
            if payload.sdt
            else select(User.id).where(User.email == payload.email)
        )
        if existing:
            raise AppError("Email hoặc số điện thoại đã tồn tại!", 409, "USER_EXISTS")

        phone = (payload.sdt or "").strip()
        if not phone:
            phone = f"u{uuid4().hex[:10]}"

        user = User(
            username=payload.username,
            email=payload.email,
            sdt=phone,
            password=hash_password(payload.password),
            name=payload.name,
            role="user",
            avatar="/images/Logo/Avatar.png",
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return UserPublic.model_validate(user)

    async def login(self, payload: LoginRequest) -> tuple[str, User]:
        user = await self.db.scalar(select(User).where(User.email == payload.email))
        if not user or not verify_password(payload.password, user.password):
            raise UnauthorizedError("Sai email hoặc mật khẩu!")

        if not user.password.startswith(("pbkdf2:", "scrypt:", "argon2")):
            user.password = hash_password(payload.password)
            await self.db.flush()

        token = create_access_token(user.id, user.role or "user")
        return token, user

    async def send_reset_otp(self, email_or_phone: str) -> str:
        user = await self.db.scalar(
            select(User).where(or_(User.email == email_or_phone, User.sdt == email_or_phone))
        )
        if not user:
            raise NotFoundError("Không tìm thấy tài khoản!")

        reset_token, otp = otp_store.create(user.id)
        try:
            await send_email(
                user.email,
                "[BookApp] Mã OTP đặt lại mật khẩu",
                (
                    f"Xin chào,\n\nMã OTP của bạn là: {otp}\n"
                    "Mã có hiệu lực trong 10 phút.\n\n"
                    "Nếu bạn không yêu cầu, hãy bỏ qua email này.\n\n- BookApp Team -"
                ),
            )
        except AppError:
            if not settings.debug:
                raise
            print(f"[DEV] OTP for {user.email}: {otp}")
        return reset_token

    async def reset_password(self, payload: ResetPasswordRequest, reset_token: str | None) -> None:
        token = payload.reset_token or reset_token
        if not token:
            raise AppError("Không có mã OTP hợp lệ!", 400, "OTP_MISSING")
        user_id = otp_store.consume(token, payload.otp)
        user = await self.db.scalar(select(User).where(User.id == user_id))
        if not user:
            raise NotFoundError("Không tìm thấy tài khoản!")
        user.password = hash_password(payload.new_pass)
        await self.db.flush()
