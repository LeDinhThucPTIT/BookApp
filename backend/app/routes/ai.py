from fastapi import APIRouter, Depends, Request
from app.middlewares.auth import get_current_user
from app.middlewares.rate_limit import rate_limit
from app.config import settings
from app.schemas.ai import AIAskRequest, AIAskResponse, AISummarizeRequest, AISummarizeResponse
from app.schemas.common import APIResponse
from app.services.ai_service import AIService
from app.utils.responses import success
from app.routes.deps import get_book_service
from app.services.book_service import BookService
from app.utils.exceptions import AppError

router = APIRouter(prefix="/ai", tags=["AI Assistant"], dependencies=[Depends(get_current_user)])


async def resolve_source(req, service):
    if req.book_id is None:
        return None
    book = await service.get_book_content(req.book_id)
    if book.is_story and req.page is not None:
        target = next((item for item in book.chapters if item.start_page <= req.page < item.start_page + item.page_count), None)
        if target:
            book = await service.get_book_content(req.book_id, target.id)
    index = (req.page - book.page_offset) if req.page is not None else -1
    if index < 0 or index >= len(book.pages):
        raise AppError("Không tìm thấy trang nguồn. Vui lòng tải lại sách.", 409, "SOURCE_CHANGED")
    source = book.pages[index]
    if req.selected_text and req.selected_text not in source.text:
        raise AppError("Đoạn trích không còn khớp với trang nguồn.", 409, "SOURCE_CHANGED")
    return book, source


@router.post("/summarize", response_model=APIResponse[AISummarizeResponse])
@rate_limit(settings.rate_limit_ai)
async def summarize_chapter(request: Request, req: AISummarizeRequest, service: BookService = Depends(get_book_service)):
    """Tóm tắt nội dung chương/trang sách với Gemini AI."""
    resolved = await resolve_source(req, service)
    result = await AIService.summarize_chapter(
        content=(req.selected_text or resolved[1].text) if resolved else req.content,
        title=resolved[0].title if resolved else req.title,
        chapter_name=resolved[1].chapter_title if resolved else req.chapter_name,
    )
    return success(result, "Tóm tắt chương sách thành công")


@router.post("/ask", response_model=APIResponse[AIAskResponse])
@rate_limit(settings.rate_limit_ai)
async def ask_question(request: Request, req: AIAskRequest, service: BookService = Depends(get_book_service)):
    """Hỏi đáp giải thích tình tiết, nhân vật và nội dung sách với Gemini AI."""
    resolved = await resolve_source(req, service)
    result = await AIService.ask_question(
        question=req.question,
        context=resolved[1].text if resolved else req.context,
        title=resolved[0].title if resolved else req.title,
        selected_text=req.selected_text,
        history=[turn.model_dump() for turn in req.history],
    )
    if resolved:
        for citation in result.get("citations", []):
            citation.update(book_id=req.book_id, page=req.page, chapter_title=resolved[1].chapter_title)
    return success(result, "Trả lời câu hỏi thành công")
