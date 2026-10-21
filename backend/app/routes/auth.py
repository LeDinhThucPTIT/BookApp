from fastapi import APIRouter, Depends, Request, Response

from app.config import settings
from app.middlewares.auth import get_current_user
from app.middlewares.rate_limit import limiter
from app.models import User
from app.schemas.auth import (
    ForgotOTPRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.common import APIResponse
from app.schemas.user import UserPublic
from app.services import AuthService
from app.routes.deps import get_auth_service
from app.utils.responses import success

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_token_cookie(response: Response, token: str, remember: bool = True) -> None:
    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60 if remember else None,
        path="/",
    )


@router.post("/register", response_model=APIResponse[UserPublic], status_code=201)
@limiter.limit(settings.rate_limit_auth)
async def register(
    request: Request,
    payload: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
):
    user = await service.register(payload)
    return success(user, "Đăng ký thành công!", 201)


@router.post("/login", response_model=APIResponse[TokenResponse])
@limiter.limit(settings.rate_limit_auth)
async def login(
    request: Request,
    payload: LoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    token, user = await service.login(payload)
    redirect = "/admin" if user.role == "admin" else "/home"
    result = success(
        TokenResponse(access_token=token, role=user.role, redirect=redirect),
        "Đăng nhập thành công!",
    )
    _set_token_cookie(result, token, payload.remember)
    return result


@router.post("/logout", response_model=APIResponse[None])
async def logout():
    result = success(None, "Đã đăng xuất!")
    result.delete_cookie(settings.jwt_cookie_name, path="/")
    return result


@router.get("/me", response_model=APIResponse[UserPublic])
async def me(user: User = Depends(get_current_user)):
    return success(UserPublic.model_validate(user))


@router.post("/forgot/send-otp", response_model=APIResponse[dict])
@limiter.limit(settings.rate_limit_auth)
async def send_otp(
    request: Request,
    payload: ForgotOTPRequest,
    service: AuthService = Depends(get_auth_service),
):
    reset_token = await service.send_reset_otp(payload.email_or_phone)
    result = success({"reset_token": reset_token}, "Mã OTP đã được gửi tới email!")
    result.set_cookie("reset_token", reset_token, httponly=True, samesite="lax", max_age=600)
    return result


@router.post("/forgot/verify", response_model=APIResponse[None])
@limiter.limit(settings.rate_limit_auth)
async def verify_otp(
    request: Request,
    payload: ResetPasswordRequest,
    service: AuthService = Depends(get_auth_service),
):
    await service.reset_password(payload, request.cookies.get("reset_token"))
    return success(None, "Cập nhật mật khẩu thành công!")
