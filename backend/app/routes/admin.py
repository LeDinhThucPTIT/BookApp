from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.middlewares.auth import require_admin
from app.models import User
from app.schemas.admin import AdminComment, AdminStats
from app.schemas.book import BookCreateForm, BookPublic
from app.schemas.common import APIResponse
from app.schemas.user import UserPublic
from app.services import AdminService, BookService
from app.routes.deps import get_admin_service, get_book_service
from app.utils.responses import success

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=APIResponse[AdminStats])
async def stats(
    days: int = Query(default=14, ge=7, le=90),
    _: User = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
):
    return success(await service.stats(days))


@router.get("/books", response_model=APIResponse[list[BookPublic]])
async def list_books(
    _: User = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
):
    return success(await service.list_books())


@router.post("/books", response_model=APIResponse[BookPublic], status_code=201)
async def add_book(
    title: str = Form(...),
    author: str = Form(...),
    genre: str | None = Form(default=None),
    summary: str | None = Form(default=None),
    book_file: UploadFile | None = File(default=None),
    cover: UploadFile | None = File(default=None),
    user: User = Depends(require_admin),
    books: BookService = Depends(get_book_service),
):
    form = BookCreateForm(title=title, author=author, genre=genre, summary=summary)
    created = await books.create_or_upload(user, form, book_file, cover)
    return success(created, "Thêm sách thành công!", 201)


@router.delete("/books/{book_id}", response_model=APIResponse[None])
async def delete_book(
    book_id: int,
    user: User = Depends(require_admin),
    books: BookService = Depends(get_book_service),
):
    await books.delete_book(user, book_id)
    return success(None, "Đã xoá sách!")


@router.get("/users", response_model=APIResponse[list[UserPublic]])
async def list_users(
    _: User = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
):
    return success(await service.list_users())


@router.delete("/users/{user_id}", response_model=APIResponse[None])
async def delete_user(
    user_id: int,
    user: User = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
):
    await service.delete_user(user_id, user.id)
    return success(None, "Đã xoá người dùng!")


@router.get("/comments", response_model=APIResponse[list[AdminComment]])
async def list_comments(
    _: User = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
):
    return success(await service.list_comments())


@router.delete("/comments/{comment_id}", response_model=APIResponse[None])
async def delete_comment(
    comment_id: int,
    _: User = Depends(require_admin),
    service: AdminService = Depends(get_admin_service),
):
    await service.delete_comment(comment_id)
    return success(None, "Đã xoá bình luận!")
