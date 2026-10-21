"""Legacy Flask-shaped endpoints used by the existing frontend."""

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile
from fastapi.responses import JSONResponse

from app.config import settings
from app.middlewares.auth import get_current_user
from app.middlewares.rate_limit import limiter
from app.models import User
from app.schemas.auth import ForgotOTPRequest, LoginRequest, RegisterRequest, ResetPasswordRequest
from app.schemas.book import BookCreateForm
from app.schemas.interaction import BookIdBody, CommentCreate, HistoryCreate, RatingCreate
from app.schemas.user import UserPublic
from app.services import AuthService, BookService, InteractionService
from app.routes.deps import get_auth_service, get_book_service, get_interaction_service

router = APIRouter(include_in_schema=False)


def _set_token_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.jwt_cookie_name,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )


@router.post("/login")
@limiter.limit(settings.rate_limit_auth)
async def login(
    request: Request,
    payload: LoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    token, user = await service.login(payload)
    redirect = "/admin/dashboard" if user.role == "admin" else "/home"
    response = JSONResponse({"success": True, "redirect": redirect, "message": "Đăng nhập thành công!"})
    _set_token_cookie(response, token)
    return response


@router.post("/register")
@limiter.limit(settings.rate_limit_auth)
async def register(
    request: Request,
    payload: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
):
    await service.register(payload)
    return {"success": True, "message": "Đăng ký thành công!"}


@router.post("/forgot/send-otp")
@limiter.limit(settings.rate_limit_auth)
async def send_otp(
    request: Request,
    payload: ForgotOTPRequest,
    service: AuthService = Depends(get_auth_service),
):
    reset_token = await service.send_reset_otp(payload.email_or_phone)
    response = JSONResponse({"success": True, "message": "Mã OTP đã được gửi tới email!"})
    response.set_cookie("reset_token", reset_token, httponly=True, samesite="lax", max_age=600)
    return response


@router.post("/forgot/verify")
@limiter.limit(settings.rate_limit_auth)
async def verify_otp(
    request: Request,
    payload: ResetPasswordRequest,
    service: AuthService = Depends(get_auth_service),
):
    await service.reset_password(payload, request.cookies.get("reset_token"))
    return {"success": True, "message": "Cập nhật mật khẩu thành công!"}


@router.get("/api/books")
async def get_books(service: BookService = Depends(get_book_service)):
    books = await service.list_books()
    return [book.model_dump() for book in books]


@router.post("/api/upload-book")
async def upload_book(
    title: str = Form(...),
    author: str = Form(...),
    genre: str | None = Form(default=None),
    summary: str | None = Form(default=None),
    language: str | None = Form(default=None),
    book_file: UploadFile = File(...),
    cover_file: UploadFile | None = File(default=None),
    user: User = Depends(get_current_user),
    service: BookService = Depends(get_book_service),
):
    form = BookCreateForm(title=title, author=author, genre=genre, summary=summary, language=language)
    book = await service.upload_book(user, form, book_file, cover_file)
    return {"message": "Upload thành công!", "book_id": book.id, "html_path": f"/read/{book.id}"}


@router.get("/api/user-history")
async def user_history(
    user: User = Depends(get_current_user),
    service: BookService = Depends(get_book_service),
):
    return [book.model_dump() for book in await service.list_books(uploaded_by=user.id)]


@router.delete("/api/delete-book/{book_id}")
async def delete_book(
    book_id: int,
    user: User = Depends(get_current_user),
    service: BookService = Depends(get_book_service),
):
    await service.delete_book(user, book_id)
    return {"message": "Đã xoá sách thành công!"}


@router.post("/api/reading-history")
async def save_reading_history(
    payload: HistoryCreate,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    await service.save_history(user.id, payload.book_id)
    return {"success": True}


@router.get("/api/history")
async def get_history(
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    return [item.model_dump() for item in await service.list_history(user.id)]


@router.delete("/api/history/{book_id}")
async def delete_history(
    book_id: int,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    await service.delete_history(user.id, book_id)
    return {"success": True}


@router.api_route("/api/book/{book_id}/favorite", methods=["GET", "POST"])
async def favorite_book(
    book_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    if request.method == "GET":
        return {"favorite": await service.favorite_status(user.id, book_id)}
    favorite = await service.toggle_favorite(user.id, book_id)
    return JSONResponse({"favorite": favorite}, status_code=201 if favorite else 200)


@router.api_route("/api/book/{book_id}/save", methods=["GET", "POST"])
async def save_book(
    book_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    if request.method == "GET":
        return {"saved": await service.save_status(user.id, book_id)}
    saved = await service.toggle_save(user.id, book_id)
    return JSONResponse({"saved": saved}, status_code=201 if saved else 200)


@router.get("/api/saves")
async def get_saves(
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    return [item.model_dump() for item in await service.list_library(user.id)]


@router.post("/api/saves/remove")
async def remove_save(
    payload: BookIdBody,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    await service.remove_save(user.id, payload.book_id)
    return {"success": True, "message": "Đã xoá khỏi lưu trữ."}


@router.post("/api/favorites/remove")
async def remove_favorite(
    payload: BookIdBody,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    await service.remove_favorite(user.id, payload.book_id)
    return {"success": True, "message": "Đã xoá khỏi yêu thích."}


@router.api_route("/api/book/{book_id}/comments", methods=["GET", "POST"])
async def comments(
    book_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    if request.method == "GET":
        return [item.model_dump() for item in await service.list_comments(book_id)]
    body = await request.json()
    await service.add_comment(user.id, book_id, CommentCreate(**body).content)
    return JSONResponse({"success": True}, status_code=201)


@router.api_route("/api/book/{book_id}/rating", methods=["GET", "POST"])
async def ratings(
    book_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    if request.method == "GET":
        return (await service.get_rating(user.id, book_id)).model_dump()
    body = await request.json()
    stars = await service.upsert_rating(user.id, book_id, RatingCreate(**body).stars)
    return {"success": True, "stars": stars}


@router.get("/api/me")
async def me(user: User = Depends(get_current_user)):
    return UserPublic.model_validate(user).model_dump()
