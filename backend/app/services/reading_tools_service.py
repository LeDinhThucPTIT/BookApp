from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book, User
from app.models.reading_tools import Annotation, Story, StoryChapter
from app.schemas.reading_tools import AnnotationCreate, AnnotationUpdate, AnnotationPublic, ChapterWrite, StoryCreate, StoryPublic
from app.schemas.book import BookPublic
from app.services.book_service import BookService
from app.utils.exceptions import AppError, ForbiddenError, NotFoundError
from app.utils.reader import utf16_slice, paginate_text, locate_quote, page_fingerprint


class ReadingToolsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def owner(self, user: User, book_id: int):
        book = await BookService(self.db).get_book(book_id)
        if user.role != "admin" and book.uploaded_by != user.id:
            raise ForbiddenError("Chỉ tác giả đăng truyện hoặc quản trị viên được chỉnh sửa.")
        return book

    async def list_stories(self):
        rows = (await self.db.execute(select(Book, Story.status, func.count(StoryChapter.id))
                .join(Story, Story.book_id == Book.id)
                .outerjoin(StoryChapter, StoryChapter.book_id == Book.id)
                .group_by(Book.id, Story.status).order_by(Book.created_at.desc()))).all()
        return [StoryPublic(**BookPublic.model_validate(book).model_dump(), status=status, chapter_count=count) for book, status, count in rows]

    async def create_story(self, user: User, payload: StoryCreate):
        book = Book(**payload.model_dump(exclude={"status"}), uploaded_by=user.id)
        self.db.add(book)
        await self.db.flush()
        self.db.add(Story(book_id=book.id, status=payload.status))
        await self.db.flush()
        await self.db.refresh(book)
        return StoryPublic(**BookPublic.model_validate(book).model_dump(), status=payload.status)

    async def get_story(self, book_id: int):
        story = await self.db.get(Story, book_id)
        if not story:
            raise NotFoundError("Không tìm thấy truyện.")
        book = await BookService(self.db).get_book_public(book_id)
        count = await self.db.scalar(select(func.count(StoryChapter.id)).where(StoryChapter.book_id == book_id))
        return StoryPublic(**book.model_dump(), status=story.status, chapter_count=count)

    async def update_story(self, user: User, book_id: int, payload: StoryCreate):
        book = await self.owner(user, book_id)
        story = await self.db.get(Story, book_id)
        if not story:
            raise NotFoundError("Không tìm thấy truyện.")
        for key, value in payload.model_dump(exclude={"status"}).items():
            setattr(book, key, value)
        story.status = payload.status
        await self.db.flush()
        return await self.get_story(book_id)

    async def chapters(self, book_id: int):
        if not await self.db.get(Story, book_id):
            raise NotFoundError("Không tìm thấy truyện.")
        return (await self.db.execute(select(StoryChapter.id, StoryChapter.book_id, StoryChapter.number, StoryChapter.title, StoryChapter.page_count, StoryChapter.created_at)
                .where(StoryChapter.book_id == book_id).order_by(StoryChapter.number))).mappings().all()

    async def chapter(self, book_id: int, chapter_id: int):
        chapter = await self.db.get(StoryChapter, chapter_id)
        if not chapter or chapter.book_id != book_id:
            raise NotFoundError("Không tìm thấy chương.")
        return chapter

    async def write_chapter(self, user: User, book_id: int, payload: ChapterWrite, chapter_id: int | None = None):
        await self.owner(user, book_id)
        if not await self.db.get(Story, book_id):
            raise NotFoundError("Không tìm thấy truyện.")
        chapter = await self.db.get(StoryChapter, chapter_id) if chapter_id else None
        if chapter_id and (not chapter or chapter.book_id != book_id):
            raise NotFoundError("Không tìm thấy chương.")
        duplicate = await self.db.scalar(select(StoryChapter.id).where(StoryChapter.book_id == book_id, StoryChapter.number == payload.number))
        if duplicate and duplicate != chapter_id:
            raise AppError("Số chương này đã tồn tại. Hãy chọn số khác.", 409, "CHAPTER_EXISTS")
        if chapter:
            for key, value in payload.model_dump().items():
                setattr(chapter, key, value)
        else:
            chapter = StoryChapter(book_id=book_id, **payload.model_dump())
            self.db.add(chapter)
        await self.db.flush()
        chapter.page_count = max(1, len(paginate_text(chapter.content)))
        await self.db.flush()
        await self.db.refresh(chapter)
        return chapter

    async def delete_chapter(self, user: User, book_id: int, chapter_id: int):
        await self.owner(user, book_id)
        chapter = await self.db.get(StoryChapter, chapter_id)
        if not chapter or chapter.book_id != book_id:
            raise NotFoundError("Không tìm thấy chương.")
        await self.db.delete(chapter)
        await self.db.flush()

    async def list_annotations(self, user_id: int, book_id: int):
        notes = (await self.db.scalars(select(Annotation).where(Annotation.user_id == user_id, Annotation.book_id == book_id).order_by(Annotation.page, Annotation.start_offset))).all()
        if not notes:
            return []
        metadata = await BookService(self.db).get_book_content(book_id)
        starts = {item.id: item.start_page for item in metadata.chapters}
        cache = {}
        result = []
        for note in notes:
            public = AnnotationPublic.model_validate(note)
            if note.chapter_id:
                if note.chapter_id not in cache:
                    chapter = await self.chapter(book_id, note.chapter_id)
                    cache[note.chapter_id] = paginate_text(chapter.content)
                texts = cache[note.chapter_id]
                preferred = note.chapter_page
                if preferred is None:
                    preferred = note.page - starts.get(note.chapter_id, 0)
                if note.source_hash != page_fingerprint(texts):
                    preferred = None
                located = locate_quote(texts, note.quote, preferred, note.start_offset, note.end_offset)
                if located:
                    chapter_page, start, end = located
                    public = public.model_copy(update={"page": starts[note.chapter_id] + chapter_page, "chapter_page": chapter_page, "start_offset": start, "end_offset": end})
                else:
                    public.source_missing = True
            else:
                texts = [item.text for item in metadata.pages]
                located = locate_quote(texts, note.quote, note.page if note.source_hash == page_fingerprint(texts) else None, note.start_offset, note.end_offset)
                if located:
                    page, start, end = located
                    public = public.model_copy(update={"page": page, "start_offset": start, "end_offset": end})
                else:
                    public.source_missing = True
            result.append(public)
        return result

    async def create_annotation(self, user_id: int, book_id: int, payload: AnnotationCreate):
        service = BookService(self.db)
        book = await service.get_book_content(book_id, payload.chapter_id)
        if book.is_story and not payload.chapter_id:
            target = next((item for item in book.chapters if item.start_page <= payload.page < item.start_page + item.page_count), None)
            if target:
                book = await service.get_book_content(book_id, target.id)
        page_index = payload.page - book.page_offset
        if page_index < 0 or page_index >= len(book.pages):
            raise AppError("Trang không còn tồn tại. Vui lòng tải lại sách.", 409, "SOURCE_CHANGED")
        source = book.pages[page_index]
        if payload.end_offset <= payload.start_offset or utf16_slice(source.text, payload.start_offset, payload.end_offset) != payload.quote:
            raise AppError("Đoạn trích không khớp với trang sách. Vui lòng chọn lại.", 409, "SOURCE_CHANGED")
        annotation = Annotation(user_id=user_id, book_id=book_id, chapter_id=source.chapter_id, chapter_page=page_index if source.chapter_id else None, source_hash=page_fingerprint([item.text for item in book.pages]), **payload.model_dump(exclude={"chapter_id", "chapter_page"}))
        self.db.add(annotation)
        await self.db.flush()
        await self.db.refresh(annotation)
        return annotation

    async def annotation(self, user_id: int, annotation_id: int):
        annotation = await self.db.get(Annotation, annotation_id)
        if not annotation or annotation.user_id != user_id:
            raise NotFoundError("Không tìm thấy ghi chú.")
        return annotation

    async def update_annotation(self, user_id: int, annotation_id: int, payload: AnnotationUpdate):
        annotation = await self.annotation(user_id, annotation_id)
        annotation.note, annotation.color = payload.note, payload.color
        await self.db.flush()
        return annotation

    async def delete_annotation(self, user_id: int, annotation_id: int):
        await self.db.delete(await self.annotation(user_id, annotation_id))
        await self.db.flush()
