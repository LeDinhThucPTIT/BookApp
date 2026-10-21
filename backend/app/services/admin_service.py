from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Book, Comment, Favorite, Rating, ReadingHistory, Save, User
from app.schemas.admin import AdminComment, AdminStats
from app.schemas.book import BookPublic
from app.schemas.user import UserPublic
from app.utils.exceptions import AppError, NotFoundError


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def stats(self, days: int = 14) -> AdminStats:
        total_books = await self.db.scalar(select(func.count(Book.id)))
        total_users = await self.db.scalar(select(func.count(User.id)))
        total_comments = await self.db.scalar(select(func.count(Comment.id)))
        total_reads = await self.db.scalar(select(func.count(ReadingHistory.id)))
        # Daily buckets use UTC consistently with stored creation timestamps.
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=days - 1)
        end = today + timedelta(days=1)
        daily = {}
        for model, key in ((Book, "books"), (User, "users")):
            rows = (await self.db.execute(
                select(func.date(model.created_at), func.count(model.id))
                .where(model.created_at >= start, model.created_at < end)
                .group_by(func.date(model.created_at))
            )).all()
            daily[key] = {str(day): count for day, count in rows}
        genres = (await self.db.execute(
            select(Book.genre, func.count(Book.id)).group_by(Book.genre)
            .order_by(func.count(Book.id).desc(), Book.genre)
        )).all()
        readers = func.count(func.distinct(ReadingHistory.user_id))
        popular = (await self.db.execute(
            select(Book.id, Book.title, readers)
            .outerjoin(ReadingHistory, ReadingHistory.book_id == Book.id)
            .group_by(Book.id, Book.title).order_by(readers.desc(), Book.id.desc()).limit(5)
        )).all()
        return AdminStats(
            total_books=int(total_books or 0),
            total_users=int(total_users or 0),
            total_comments=int(total_comments or 0),
            total_reads=int(total_reads or 0),
            daily=[{
                "date": start + timedelta(days=i),
                "books": daily["books"].get(str(start + timedelta(days=i)), 0),
                "users": daily["users"].get(str(start + timedelta(days=i)), 0),
            } for i in range(days)],
            genres=[{"name": genre or "Chưa phân loại", "count": count} for genre, count in genres],
            popular_books=[{"id": id_, "title": title, "readers": count} for id_, title, count in popular],
        )

    async def list_users(self) -> list[UserPublic]:
        users = (await self.db.scalars(select(User).order_by(User.id.desc()))).all()
        return [UserPublic.model_validate(user) for user in users]

    async def delete_user(self, user_id: int, actor_id: int) -> None:
        if user_id == actor_id:
            raise AppError("Không thể tự xoá tài khoản đang đăng nhập!", 400, "SELF_DELETE")
        user = await self.db.scalar(select(User).where(User.id == user_id))
        if not user:
            raise NotFoundError("Không tìm thấy người dùng!")
        await self.db.execute(
            update(Book).where(Book.uploaded_by == user_id).values(uploaded_by=None)
        )
        await self.db.execute(delete(Comment).where(Comment.user_id == user_id))
        await self.db.execute(delete(Rating).where(Rating.user_id == user_id))
        await self.db.execute(delete(Favorite).where(Favorite.user_id == user_id))
        await self.db.execute(delete(Save).where(Save.user_id == user_id))
        await self.db.execute(delete(ReadingHistory).where(ReadingHistory.user_id == user_id))
        await self.db.delete(user)

    async def list_comments(self) -> list[AdminComment]:
        rows = (
            await self.db.execute(
                select(Comment.id, Comment.content, Comment.created_at, User.username, Book.title)
                .join(User, Comment.user_id == User.id)
                .join(Book, Comment.book_id == Book.id)
                .order_by(Comment.created_at.desc())
            )
        ).all()
        return [
            AdminComment(
                id=comment_id,
                content=content,
                created_at=created_at,
                username=username,
                title=title,
            )
            for comment_id, content, created_at, username, title in rows
        ]

    async def delete_comment(self, comment_id: int) -> None:
        comment = await self.db.scalar(select(Comment).where(Comment.id == comment_id))
        if not comment:
            raise NotFoundError("Không tìm thấy bình luận!")
        await self.db.delete(comment)

    async def list_books(self) -> list[BookPublic]:
        books = (await self.db.scalars(select(Book).order_by(Book.created_at.desc()))).all()
        return [BookPublic.model_validate(book) for book in books]
