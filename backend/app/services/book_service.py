from fastapi import UploadFile
import asyncio
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book, Rating, User, Favorite
from app.schemas.book import BookCatalog, BookContent, BookCreateForm, BookPublic, ReaderPage, ReaderChapter
from app.models.reading_tools import Story, StoryChapter
from app.utils.reader import paginate_text
from app.services.storage_service import load_reader_content, save_cover, save_pdf_and_html, remove_static_uploads
from app.utils.exceptions import ForbiddenError, NotFoundError


def _rating_query():
    return (
        select(
            Rating.book_id.label("book_id"),
            func.round(func.avg(Rating.stars), 1).label("avg_rating"),
            func.count(Rating.id).label("total_ratings"),
        )
        .group_by(Rating.book_id)
        .subquery()
    )


class BookService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def catalog(self, page: int = 1, page_size: int = 12, search: str = "", sort: str = "newest") -> BookCatalog:
        ratings = _rating_query()
        favorites = select(Favorite.book_id, func.count(Favorite.id).label("count")).group_by(Favorite.book_id).subquery()
        avg = func.coalesce(ratings.c.avg_rating, 0)
        rating_count = func.coalesce(ratings.c.total_ratings, 0)
        favorite_count = func.coalesce(favorites.c.count, 0)
        filters = []
        if search.strip():
            filters.append(or_(Book.title.icontains(search.strip(), autoescape=True), Book.author.icontains(search.strip(), autoescape=True)))
        total = await self.db.scalar(select(func.count(Book.id)).where(*filters))
        ordering = {
            "newest": (Book.created_at.desc(), Book.id.desc()),
            "favorites": (favorite_count.desc(), Book.id.desc()),
            "rating": (avg.desc(), rating_count.desc(), Book.id.desc()),
        }[sort]
        rows = (await self.db.execute(select(Book, avg, rating_count, favorite_count)
            .outerjoin(ratings, ratings.c.book_id == Book.id)
            .outerjoin(favorites, favorites.c.book_id == Book.id)
            .where(*filters).order_by(*ordering).offset((page - 1) * page_size).limit(page_size))).all()
        return BookCatalog(items=[BookPublic.model_validate(book).model_copy(update={
            "avg_rating": float(avg_rating), "total_ratings": int(count), "favorite_count": int(favs),
        }) for book, avg_rating, count, favs in rows], total=total or 0, page=page, page_size=page_size)

    async def list_books(self, uploaded_by: int | None = None) -> list[BookPublic]:
        ratings = _rating_query()
        stmt = (
            select(
                Book,
                func.coalesce(ratings.c.avg_rating, 0),
                func.coalesce(ratings.c.total_ratings, 0),
            )
            .outerjoin(ratings, ratings.c.book_id == Book.id)
            .order_by(Book.created_at.desc())
        )
        if uploaded_by is not None:
            stmt = stmt.where(Book.uploaded_by == uploaded_by)

        rows = (await self.db.execute(stmt)).all()
        return [
            BookPublic.model_validate(book).model_copy(
                update={"avg_rating": float(avg or 0), "total_ratings": int(total or 0)}
            )
            for book, avg, total in rows
        ]

    async def get_book(self, book_id: int) -> Book:
        book = await self.db.scalar(select(Book).where(Book.id == book_id))
        if not book:
            raise NotFoundError("Không tìm thấy sách!")
        return book

    async def get_book_public(self, book_id: int) -> BookPublic:
        ratings = _rating_query()
        row = (
            await self.db.execute(
                select(
                    Book,
                    func.coalesce(ratings.c.avg_rating, 0),
                    func.coalesce(ratings.c.total_ratings, 0),
                )
                .outerjoin(ratings, ratings.c.book_id == Book.id)
                .where(Book.id == book_id)
            )
        ).first()
        if not row:
            raise NotFoundError("Không tìm thấy sách!")
        book, avg, total = row
        return BookPublic.model_validate(book).model_copy(
            update={"avg_rating": float(avg or 0), "total_ratings": int(total or 0)}
        )

    async def get_book_content(self, book_id: int, chapter_id: int | None = None) -> BookContent:
        public = await self.get_book_public(book_id)
        story = await self.db.get(Story, book_id)
        if story:
            rows = (await self.db.execute(select(StoryChapter.id, StoryChapter.number, StoryChapter.title, StoryChapter.page_count)
                    .where(StoryChapter.book_id == book_id).order_by(StoryChapter.number))).all()
            chapters, offset = [], 0
            for row in rows:
                chapters.append(ReaderChapter(id=row.id, number=row.number, title=row.title, page_count=row.page_count, start_page=offset))
                offset += row.page_count
            selected = next((chapter for chapter in chapters if chapter.id == chapter_id), None) if chapter_id else next(iter(chapters), None)
            if chapter_id and not selected:
                raise NotFoundError("Chương không còn tồn tại. Vui lòng mở lại mục lục.")
            pages = []
            if selected:
                content = await self.db.scalar(select(StoryChapter.content).where(StoryChapter.id == selected.id))
                pages = [ReaderPage(text=text, chapter_id=selected.id, chapter_title=selected.title, chapter_number=selected.number) for text in paginate_text(content)]
            return BookContent(**public.model_dump(), pages=pages, is_story=True, chapters=chapters, page_offset=selected.start_page if selected else 0, total_pages=offset)
        content, texts = await asyncio.to_thread(load_reader_content, public.html_path)
        pages = [ReaderPage(text=text) for text in texts]
        return BookContent(**public.model_dump(), content=content, pages=pages, total_pages=len(pages))

    async def upload_book(
        self,
        user: User,
        form: BookCreateForm,
        book_file: UploadFile,
        cover_file: UploadFile | None,
    ) -> BookPublic:
        created = []
        try:
            cover_path = await save_cover(cover_file)
            created.append(cover_path)
            file_path, html_path = await save_pdf_and_html(book_file)
            created.extend([file_path, html_path])
            book = Book(
                title=form.title,
                author=form.author,
                genre=form.genre,
                summary=form.summary,
                cover_image=cover_path,
                file_path=file_path,
                html_path=html_path,
                uploaded_by=user.id,
            )
            self.db.add(book)
            await self.db.flush()
            await self.db.refresh(book)
            self.db.info.setdefault("new_uploads", []).extend(created)
            return BookPublic.model_validate(book)
        except BaseException:
            remove_static_uploads(created)
            raise

    async def create_book_metadata(
        self,
        user: User,
        form: BookCreateForm,
        cover_file: UploadFile | None = None,
    ) -> BookPublic:
        cover_path = await save_cover(cover_file)
        self.db.info.setdefault("new_uploads", []).append(cover_path)
        book = Book(
            title=form.title,
            author=form.author,
            genre=form.genre,
            summary=form.summary,
            cover_image=cover_path,
            uploaded_by=user.id,
        )
        self.db.add(book)
        await self.db.flush()
        await self.db.refresh(book)
        return BookPublic.model_validate(book)

    async def create_or_upload(
        self,
        user: User,
        form: BookCreateForm,
        book_file: UploadFile | None,
        cover_file: UploadFile | None,
    ) -> BookPublic:
        if book_file is not None and book_file.filename:
            return await self.upload_book(user, form, book_file, cover_file)
        return await self.create_book_metadata(user, form, cover_file)

    async def delete_book(self, user: User, book_id: int) -> None:
        book = await self.get_book(book_id)
        if user.role != "admin" and book.uploaded_by != user.id:
            raise ForbiddenError("Bạn không có quyền xoá sách này!")
        await self.db.delete(book)
        await self.db.flush()
