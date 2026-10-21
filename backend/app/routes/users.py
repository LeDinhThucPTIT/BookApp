from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.middlewares.auth import get_current_user
from app.models import User
from app.schemas.common import APIResponse
from app.schemas.user import UserPublic, UserUpdateRequest
from app.services import UserService
from app.routes.deps import get_user_service
from app.utils.responses import success

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=APIResponse[UserPublic])
async def get_profile(user: User = Depends(get_current_user)):
    return success(UserPublic.model_validate(user))


@router.put("/me", response_model=APIResponse[UserPublic])
async def update_profile(
    username: str | None = Form(default=None),
    name: str | None = Form(default=None),
    ngaysinh: date | None = Form(default=None),
    sex: str | None = Form(default=None),
    avatar: UploadFile | None = File(default=None),
    user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
):
    payload = UserUpdateRequest(username=username, name=name, ngaysinh=ngaysinh, sex=sex)
    updated = await service.update_profile(user, payload, avatar)
    return success(updated, "Cập nhật hồ sơ thành công!")
