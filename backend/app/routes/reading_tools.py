from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.middlewares.auth import get_current_user
from app.models import User, get_db
from app.schemas.common import APIResponse
from app.schemas.reading_tools import AnnotationCreate, AnnotationPublic, AnnotationUpdate, ChapterPublic, ChapterMeta, ChapterWrite, StoryCreate, StoryPublic
from app.services.reading_tools_service import ReadingToolsService
from app.utils.responses import success

router = APIRouter(tags=["Reading tools"], dependencies=[Depends(get_current_user)])


def service(db: AsyncSession = Depends(get_db, scope="function")):
    return ReadingToolsService(db)


@router.get("/stories", response_model=APIResponse[list[StoryPublic]])
async def stories(tools: ReadingToolsService = Depends(service)):
    return success(await tools.list_stories())


@router.post("/stories", response_model=APIResponse[StoryPublic], status_code=201)
async def create_story(payload: StoryCreate, user: User = Depends(get_current_user), tools: ReadingToolsService = Depends(service)):
    return success(await tools.create_story(user, payload), "Đã tạo truyện.", 201)


@router.get("/stories/{book_id}/chapters", response_model=APIResponse[list[ChapterMeta]])
async def chapters(book_id: int, tools: ReadingToolsService = Depends(service)):
    return success(await tools.chapters(book_id))


@router.get("/stories/{book_id}/chapters/{chapter_id}", response_model=APIResponse[ChapterPublic])
async def chapter(book_id: int, chapter_id: int, tools: ReadingToolsService = Depends(service)):
    return success(await tools.chapter(book_id, chapter_id))


@router.get("/stories/{book_id}", response_model=APIResponse[StoryPublic])
async def story(book_id: int, tools: ReadingToolsService = Depends(service)):
    return success(await tools.get_story(book_id))


@router.put("/stories/{book_id}", response_model=APIResponse[StoryPublic])
async def update_story(book_id: int, payload: StoryCreate, user: User = Depends(get_current_user), tools: ReadingToolsService = Depends(service)):
    return success(await tools.update_story(user, book_id, payload))


@router.post("/stories/{book_id}/chapters", response_model=APIResponse[ChapterPublic], status_code=201)
async def add_chapter(book_id: int, payload: ChapterWrite, user: User = Depends(get_current_user), tools: ReadingToolsService = Depends(service)):
    return success(await tools.write_chapter(user, book_id, payload), "Đã thêm chương.", 201)


@router.put("/stories/{book_id}/chapters/{chapter_id}", response_model=APIResponse[ChapterPublic])
async def edit_chapter(book_id: int, chapter_id: int, payload: ChapterWrite, user: User = Depends(get_current_user), tools: ReadingToolsService = Depends(service)):
    return success(await tools.write_chapter(user, book_id, payload, chapter_id))


@router.delete("/stories/{book_id}/chapters/{chapter_id}", response_model=APIResponse[None])
async def delete_chapter(book_id: int, chapter_id: int, user: User = Depends(get_current_user), tools: ReadingToolsService = Depends(service)):
    await tools.delete_chapter(user, book_id, chapter_id)
    return success(None)


@router.get("/books/{book_id}/annotations", response_model=APIResponse[list[AnnotationPublic]])
async def annotations(book_id: int, user: User = Depends(get_current_user), tools: ReadingToolsService = Depends(service)):
    return success(await tools.list_annotations(user.id, book_id))


@router.post("/books/{book_id}/annotations", response_model=APIResponse[AnnotationPublic], status_code=201)
async def annotate(book_id: int, payload: AnnotationCreate, user: User = Depends(get_current_user), tools: ReadingToolsService = Depends(service)):
    return success(await tools.create_annotation(user.id, book_id, payload), "Đã lưu ghi chú.", 201)


@router.patch("/annotations/{annotation_id}", response_model=APIResponse[AnnotationPublic])
async def update_note(annotation_id: int, payload: AnnotationUpdate, user: User = Depends(get_current_user), tools: ReadingToolsService = Depends(service)):
    return success(await tools.update_annotation(user.id, annotation_id, payload))


@router.delete("/annotations/{annotation_id}", response_model=APIResponse[None])
async def delete_note(annotation_id: int, user: User = Depends(get_current_user), tools: ReadingToolsService = Depends(service)):
    await tools.delete_annotation(user.id, annotation_id)
    return success(None)
