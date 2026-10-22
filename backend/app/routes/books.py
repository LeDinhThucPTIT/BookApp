from typing import Literal
from fastapi import APIRouter, Depends, File, Form, UploadFile, Query

from app.middlewares.auth import get_current_user
from app.models import User
from app.schemas.book import BookCatalog, BookContent, BookCreateForm, BookPublic
from app.schemas.common import APIResponse
from app.services import BookService
from app.routes.deps import get_book_service
from app.utils.exceptions import AppError
from app.utils.responses import success

router = APIRouter(prefix="/books", tags=["Books"])


@router.get("", response_model=APIResponse[list[BookPublic]])
async def list_books(service: BookService = Depends(get_book_service)):
    books = await service.list_books()
    return success(books)


@router.get("/me", response_model=APIResponse[list[BookPublic]])
async def my_uploads(
    user: User = Depends(get_current_user),
    service: BookService = Depends(get_book_service),
):
    books = await service.list_books(uploaded_by=user.id)
    return success(books)


@router.get("/catalog", response_model=APIResponse[BookCatalog])
async def catalog(
    page: int = Query(default=1, ge=1, le=100000),
    page_size: int = Query(default=12, ge=1, le=100),
    search: str = Query(default="", max_length=200),
    sort: Literal["newest", "favorites", "rating"] = "newest",
    service: BookService = Depends(get_book_service),
):
    return success(await service.catalog(page, page_size, search, sort))


@router.get("/{book_id}", response_model=APIResponse[BookPublic])
async def get_book(book_id: int, service: BookService = Depends(get_book_service)):
    book = await service.get_book_public(book_id)
    return success(book)


@router.get("/{book_id}/content", response_model=APIResponse[BookContent])
async def get_book_content(book_id: int, chapter_id: int | None = None, service: BookService = Depends(get_book_service)):
    book = await service.get_book_content(book_id, chapter_id)
    return success(book)


@router.post("", response_model=APIResponse[BookPublic], status_code=201)
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
    if not title or not author:
        raise AppError("Thiếu dữ liệu bắt buộc", 400, "MISSING_FIELDS")
    form = BookCreateForm(title=title, author=author, genre=genre, summary=summary, language=language)
    book = await service.upload_book(user, form, book_file, cover_file)
    return success(book, "Upload thành công!", 201)


@router.delete("/{book_id}", response_model=APIResponse[None])
async def delete_book(
    book_id: int,
    user: User = Depends(get_current_user),
    service: BookService = Depends(get_book_service),
):
    await service.delete_book(user, book_id)
    return success(None, "Đã xoá sách thành công!")
