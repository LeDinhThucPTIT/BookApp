from fastapi import APIRouter, Depends, Query

from app.middlewares.auth import get_current_user
from app.models import User
from app.schemas.common import APIResponse, Page, PaginationParams
from app.schemas.interaction import (
    BookIdBody,
    CommentCreate,
    CommentPublic,
    HistoryCreate,
    HistoryItem,
    LibraryItem,
    RatingCreate,
    RatingPublic,
    ProgressUpdate,
    ProgressPublic,
)
from app.services import InteractionService
from app.routes.deps import get_interaction_service
from app.utils.responses import success

router = APIRouter(tags=["Library"])


@router.get("/library", response_model=APIResponse[Page[LibraryItem]])
async def library_page(
    pagination: PaginationParams = Depends(), search: str = Query(default="", max_length=200),
    user: User = Depends(get_current_user), service: InteractionService = Depends(get_interaction_service),
):
    return success(await service.library_page(user.id, pagination.page, pagination.page_size, search))


@router.get("/books/{book_id}/comments/page", response_model=APIResponse[Page[CommentPublic]])
async def comments_page(
    book_id: int, pagination: PaginationParams = Depends(),
    user: User = Depends(get_current_user), service: InteractionService = Depends(get_interaction_service),
):
    return success(await service.comments_page(book_id, pagination.page, pagination.page_size))


@router.get("/books/{book_id}/progress", response_model=APIResponse[ProgressPublic | None])
async def get_progress(
    book_id: int,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    return success(await service.get_progress(user.id, book_id))


@router.put("/books/{book_id}/progress", response_model=APIResponse[ProgressPublic])
async def save_progress(
    book_id: int,
    payload: ProgressUpdate,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    return success(await service.save_progress(user.id, book_id, payload))


@router.get("/books/{book_id}/favorite", response_model=APIResponse[dict])
async def get_favorite(
    book_id: int,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    return success({"favorite": await service.favorite_status(user.id, book_id)})


@router.post("/books/{book_id}/favorite", response_model=APIResponse[dict])
async def toggle_favorite(
    book_id: int,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    favorite = await service.toggle_favorite(user.id, book_id)
    return success({"favorite": favorite}, status_code=201 if favorite else 200)


@router.get("/books/{book_id}/save", response_model=APIResponse[dict])
async def get_save(
    book_id: int,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    return success({"saved": await service.save_status(user.id, book_id)})


@router.post("/books/{book_id}/save", response_model=APIResponse[dict])
async def toggle_save(
    book_id: int,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    saved = await service.toggle_save(user.id, book_id)
    return success({"saved": saved}, status_code=201 if saved else 200)


@router.get("/saves", response_model=APIResponse[list[LibraryItem]])
async def list_saves(
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    return success(await service.list_library(user.id))


@router.post("/saves/remove", response_model=APIResponse[None])
async def remove_save(
    payload: BookIdBody,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    await service.remove_save(user.id, payload.book_id)
    return success(None, "Đã xoá khỏi lưu trữ.")


@router.post("/favorites/remove", response_model=APIResponse[None])
async def remove_favorite(
    payload: BookIdBody,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    await service.remove_favorite(user.id, payload.book_id)
    return success(None, "Đã xoá khỏi yêu thích.")


@router.get("/books/{book_id}/comments", response_model=APIResponse[list[CommentPublic]])
async def list_comments(
    book_id: int,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    return success(await service.list_comments(book_id))


@router.post("/books/{book_id}/comments", response_model=APIResponse[None], status_code=201)
async def add_comment(
    book_id: int,
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    await service.add_comment(user.id, book_id, payload.content)
    return success(None, "Đã thêm bình luận!", 201)


@router.get("/books/{book_id}/rating", response_model=APIResponse[RatingPublic])
async def get_rating(
    book_id: int,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    return success(await service.get_rating(user.id, book_id))


@router.post("/books/{book_id}/rating", response_model=APIResponse[dict])
async def upsert_rating(
    book_id: int,
    payload: RatingCreate,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    stars = await service.upsert_rating(user.id, book_id, payload.stars)
    return success({"stars": stars})


@router.post("/history", response_model=APIResponse[None])
async def save_history(
    payload: HistoryCreate,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    await service.save_history(user.id, payload.book_id)
    return success(None)


@router.get("/history", response_model=APIResponse[list[HistoryItem]])
async def list_history(
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    return success(await service.list_history(user.id))


@router.delete("/history/{book_id}", response_model=APIResponse[None])
async def delete_history(
    book_id: int,
    user: User = Depends(get_current_user),
    service: InteractionService = Depends(get_interaction_service),
):
    await service.delete_history(user.id, book_id)
    return success(None)
