from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from app.middlewares.auth import get_current_user
from app.middlewares.rate_limit import rate_limit
from app.routes.deps import get_book_service
from app.services.book_service import BookService
from app.services.tts_service import split_tts_text, tts_service
from app.utils.exceptions import AppError

router = APIRouter(prefix="/books", tags=["Books"], dependencies=[Depends(get_current_user)])


@router.get("/{book_id}/audio", response_class=Response)
@rate_limit("20/minute")
async def book_audio(
    request: Request,
    book_id: int,
    page: int = Query(default=0, ge=0),
    chapter_id: int | None = Query(default=None, gt=0),
    segment: int = Query(default=0, ge=0),
    voice: Literal["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"] = "vi-VN-HoaiMyNeural",
    service: BookService = Depends(get_book_service),
):
    # Resolve the text from our own book records, never accept arbitrary client text.
    book = await service.get_book_content(book_id, chapter_id)
    if book.is_story and chapter_id is None:
        target = next((c for c in book.chapters if c.start_page <= page < c.start_page + c.page_count), None)
        if target:
            book = await service.get_book_content(book_id, target.id)
    index = page - book.page_offset
    if not 0 <= index < len(book.pages):
        raise AppError("Không tìm thấy trang để nghe đọc. Hãy tải lại sách.", 409, "SOURCE_CHANGED")
    segments = split_tts_text(book.pages[index].text)
    if segment >= len(segments):
        raise AppError("Không tìm thấy đoạn để nghe đọc. Hãy tải lại sách.", 409, "SOURCE_CHANGED")
    audio = await tts_service.audio(segments[segment], voice)
    return Response(audio, media_type="audio/mpeg", headers={
        "Cache-Control": "private, no-store", "X-Audio-Segments": str(len(segments)),
    })
