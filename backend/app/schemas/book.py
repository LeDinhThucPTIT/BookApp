from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class BookPublic(ORMModel):
    id: int
    title: str
    author: str | None = None
    genre: str | None = None
    summary: str | None = None
    cover_image: str | None = None
    file_path: str | None = None
    html_path: str | None = None
    created_at: datetime | None = None
    uploaded_by: int | None = None
    avg_rating: float = 0
    total_ratings: int = 0
    favorite_count: int = 0


class BookCatalog(BaseModel):
    items: list[BookPublic]
    total: int
    page: int
    page_size: int


class ReaderPage(BaseModel):
    text: str
    chapter_id: int | None = None
    chapter_title: str | None = None
    chapter_number: int | None = None


class ReaderChapter(BaseModel):
    id: int
    number: int
    title: str
    page_count: int
    start_page: int


class BookContent(BookPublic):
    content: str | None = None
    pages: list[ReaderPage] = Field(default_factory=list)
    is_story: bool = False
    chapters: list[ReaderChapter] = Field(default_factory=list)
    page_offset: int = 0
    total_pages: int = 0


class BookCreateForm(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=255)
    genre: str | None = Field(default=None, max_length=100)
    summary: str | None = None
    language: str | None = None
