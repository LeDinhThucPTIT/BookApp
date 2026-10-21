from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.schemas.user import UserPublic, UserUpdateRequest
from app.services.storage_service import save_cover
from app.utils.exceptions import NotFoundError


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: int) -> User:
        user = await self.db.scalar(select(User).where(User.id == user_id))
        if not user:
            raise NotFoundError("Không tìm thấy người dùng!")
        return user

    async def update_profile(
        self,
        user: User,
        payload: UserUpdateRequest,
        avatar: UploadFile | None = None,
    ) -> UserPublic:
        if payload.username is not None:
            user.username = payload.username
        if payload.name is not None:
            user.name = payload.name
        if payload.ngaysinh is not None:
            user.ngaysinh = payload.ngaysinh
        if payload.sex is not None:
            user.sex = payload.sex
        if avatar is not None and avatar.filename:
            user.avatar = await save_cover(avatar)
            self.db.info.setdefault("new_uploads", []).append(user.avatar)
        await self.db.flush()
        return UserPublic.model_validate(user)
