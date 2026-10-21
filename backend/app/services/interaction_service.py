from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book, Comment, Favorite, Rating, ReadingHistory, Save, User
from app.schemas.interaction import (
    CommentPublic,
    HistoryItem,
    LibraryItem,
    RatingPublic,
)
from app.utils.exceptions import NotFoundError
from app.models.reading_progress import ReadingProgress
from app.schemas.interaction import ProgressUpdate
from sqlalchemy.dialects.mysql import insert as mysql_insert


class InteractionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_progress(self, user_id: int, book_id: int):
        await self._ensure_book(book_id)
        return await self.db.get(ReadingProgress, (user_id, book_id))

    async def save_progress(self, user_id: int, book_id: int, payload: ProgressUpdate):
        await self._ensure_book(book_id)
        # Atomically create/lock a row. Server revisions, not device clocks,
        # determine whether an edit is allowed to replace a saved position.
        import time
        from app.schemas.interaction import ProgressPublic
        from app.utils.exceptions import AppError

        values = payload.model_dump(exclude={"base_revision", "mutation_id", "updated_at_ms"})
        statement = mysql_insert(ReadingProgress).values(
            user_id=user_id, book_id=book_id, **values, updated_at_ms=int(time.time() * 1000), revision=0
        )
        await self.db.execute(statement.on_duplicate_key_update(user_id=ReadingProgress.user_id))
        current = await self.db.scalar(select(ReadingProgress).where(
            ReadingProgress.user_id == user_id, ReadingProgress.book_id == book_id
        ).with_for_update().execution_options(populate_existing=True))
        if payload.mutation_id and current.mutation_id == payload.mutation_id:
            return current
        if (payload.base_revision or 0) != current.revision:
            raise AppError("Vị trí đọc đã thay đổi ở một phiên khác. Hãy chọn vị trí bạn muốn giữ.", 409, "PROGRESS_CONFLICT", ProgressPublic.model_validate(current).model_dump())
        for key, value in values.items():
            setattr(current, key, value)
        current.revision += 1
        current.mutation_id = payload.mutation_id
        current.updated_at_ms = int(time.time() * 1000)
        await self.db.flush()
        return current

    async def _ensure_book(self, book_id: int) -> Book:
        book = await self.db.scalar(select(Book.id).where(Book.id == book_id))
        if not book:
            raise NotFoundError("Không tìm thấy sách!")
        return book

    async def favorite_status(self, user_id: int, book_id: int) -> bool:
        row = await self.db.scalar(
            select(Favorite.id).where(Favorite.user_id == user_id, Favorite.book_id == book_id)
        )
        return row is not None

    async def toggle_favorite(self, user_id: int, book_id: int) -> bool:
        await self._ensure_book(book_id)
        existing = await self.db.scalar(
            select(Favorite).where(Favorite.user_id == user_id, Favorite.book_id == book_id)
        )
        if existing:
            await self.db.delete(existing)
            await self.db.flush()
            return False
        self.db.add(Favorite(user_id=user_id, book_id=book_id))
        await self.db.flush()
        return True

    async def save_status(self, user_id: int, book_id: int) -> bool:
        row = await self.db.scalar(
            select(Save.id).where(Save.user_id == user_id, Save.book_id == book_id)
        )
        return row is not None

    async def toggle_save(self, user_id: int, book_id: int) -> bool:
        await self._ensure_book(book_id)
        existing = await self.db.scalar(
            select(Save).where(Save.user_id == user_id, Save.book_id == book_id)
        )
        if existing:
            await self.db.delete(existing)
            await self.db.flush()
            return False
        self.db.add(Save(user_id=user_id, book_id=book_id))
        await self.db.flush()
        return True

    async def remove_save(self, user_id: int, book_id: int) -> None:
        await self.db.execute(
            delete(Save).where(Save.user_id == user_id, Save.book_id == book_id)
        )

    async def remove_favorite(self, user_id: int, book_id: int) -> None:
        await self.db.execute(
            delete(Favorite).where(Favorite.user_id == user_id, Favorite.book_id == book_id)
        )

    async def list_library(self, user_id: int) -> list[LibraryItem]:
        saves = (
            await self.db.execute(
                select(
                    Save.id,
                    Book.id,
                    Book.title,
                    Book.author,
                    Book.genre,
                    Book.cover_image,
                    Book.summary,
                    Save.created_at,
                )
                .join(Book, Save.book_id == Book.id)
                .where(Save.user_id == user_id)
            )
        ).all()
        favorites = (
            await self.db.execute(
                select(
                    Favorite.id,
                    Book.id,
                    Book.title,
                    Book.author,
                    Book.genre,
                    Book.cover_image,
                    Book.summary,
                    Favorite.created_at,
                )
                .join(Book, Favorite.book_id == Book.id)
                .where(Favorite.user_id == user_id)
            )
        ).all()

        items: list[LibraryItem] = []
        for row, kind in ((saves, "save"), (favorites, "favorite")):
            for relation_id, book_id, title, author, genre, cover, summary, created_at in row:
                items.append(
                    LibraryItem(
                        relation_id=relation_id,
                        book_id=book_id,
                        title=title,
                        author=author,
                        genre=genre,
                        cover_image=cover,
                        summary=summary,
                        type=kind,
                        created_at=created_at,
                    )
                )
        def _sort_key(item: LibraryItem):
            value = item.created_at or datetime.min
            return value.replace(tzinfo=None) if getattr(value, "tzinfo", None) else value

        items.sort(key=_sort_key, reverse=True)
        unique: list[LibraryItem] = []
        seen: set[int] = set()
        for item in items:
            if item.book_id in seen:
                continue
            seen.add(item.book_id)
            unique.append(item)
        return unique

    async def list_comments(self, book_id: int) -> list[CommentPublic]:
        rows = (
            await self.db.execute(
                select(Comment, User.username, User.avatar)
                .join(User, Comment.user_id == User.id)
                .where(Comment.book_id == book_id)
                .order_by(Comment.created_at.desc())
            )
        ).all()
        return [
            CommentPublic(
                id=comment.id,
                content=comment.content,
                created_at=comment.created_at,
                username=username,
                avatar=avatar,
            )
            for comment, username, avatar in rows
        ]

    async def add_comment(self, user_id: int, book_id: int, content: str) -> None:
        await self._ensure_book(book_id)
        self.db.add(Comment(user_id=user_id, book_id=book_id, content=content.strip()))
        await self.db.flush()

    async def get_rating(self, user_id: int, book_id: int) -> RatingPublic:
        stats = (
            await self.db.execute(
                select(func.avg(Rating.stars), func.count(Rating.id)).where(Rating.book_id == book_id)
            )
        ).one()
        user_rating = await self.db.scalar(
            select(Rating.stars).where(Rating.user_id == user_id, Rating.book_id == book_id)
        )
        avg, total = stats
        return RatingPublic(
            average=round(float(avg or 0), 1),
            total=int(total or 0),
            user_rating=int(user_rating or 0),
        )

    async def upsert_rating(self, user_id: int, book_id: int, stars: int) -> int:
        await self._ensure_book(book_id)
        rating = await self.db.scalar(
            select(Rating).where(Rating.user_id == user_id, Rating.book_id == book_id)
        )
        if rating:
            rating.stars = stars
        else:
            self.db.add(Rating(user_id=user_id, book_id=book_id, stars=stars))
        await self.db.flush()
        return stars

    async def save_history(self, user_id: int, book_id: int) -> None:
        await self._ensure_book(book_id)
        history = await self.db.scalar(
            select(ReadingHistory).where(
                ReadingHistory.user_id == user_id,
                ReadingHistory.book_id == book_id,
            )
        )
        if history:
            history.last_read_at = datetime.now(timezone.utc)
        else:
            self.db.add(ReadingHistory(user_id=user_id, book_id=book_id))
        await self.db.flush()

    async def list_history(self, user_id: int) -> list[HistoryItem]:
        ratings = (
            select(
                Rating.book_id.label("book_id"),
                func.round(func.avg(Rating.stars), 1).label("avg_rating"),
                func.count(Rating.id).label("total_ratings"),
            )
            .group_by(Rating.book_id)
            .subquery()
        )
        rows = (
            await self.db.execute(
                select(
                    ReadingHistory.id,
                    Book,
                    func.coalesce(ratings.c.avg_rating, 0),
                    func.coalesce(ratings.c.total_ratings, 0),
                    ReadingHistory.last_read_at,
                )
                .join(Book, ReadingHistory.book_id == Book.id)
                .outerjoin(ratings, ratings.c.book_id == Book.id)
                .where(ReadingHistory.user_id == user_id)
                .order_by(ReadingHistory.last_read_at.desc())
            )
        ).all()
        return [
            HistoryItem(
                history_id=history_id,
                book_id=book.id,
                title=book.title,
                author=book.author,
                genre=book.genre,
                cover_image=book.cover_image,
                summary=book.summary,
                file_path=book.file_path,
                html_path=book.html_path,
                created_at=book.created_at,
                avg_rating=float(avg or 0),
                total_ratings=int(total or 0),
                last_read_at=last_read_at,
            )
            for history_id, book, avg, total, last_read_at in rows
        ]

    async def delete_history(self, user_id: int, book_id: int) -> None:
        await self.db.execute(
            delete(ReadingHistory).where(
                ReadingHistory.user_id == user_id,
                ReadingHistory.book_id == book_id,
            )
        )
