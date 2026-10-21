from datetime import date, datetime

from app.schemas.common import ORMModel
from app.schemas.user import UserPublic


class DailyStats(ORMModel):
    date: date
    books: int
    users: int


class GenreStats(ORMModel):
    name: str
    count: int


class PopularBook(ORMModel):
    id: int
    title: str
    readers: int


class AdminStats(ORMModel):
    total_books: int
    total_users: int
    total_comments: int
    total_reads: int
    daily: list[DailyStats]
    genres: list[GenreStats]
    popular_books: list[PopularBook]


class AdminComment(ORMModel):
    id: int
    content: str
    created_at: datetime | None = None
    username: str
    title: str


class AdminUser(UserPublic):
    pass
