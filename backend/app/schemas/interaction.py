from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import ORMModel


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator('content', mode='before')
    @classmethod
    def trim_content(cls, value):
        return value.strip() if isinstance(value, str) else value


class CommentPublic(ORMModel):
    id: int
    content: str
    created_at: datetime | None = None
    username: str
    avatar: str | None = None


class RatingCreate(BaseModel):
    stars: int = Field(ge=1, le=5)


class RatingPublic(BaseModel):
    average: float
    total: int
    user_rating: int = 0


class ToggleState(BaseModel):
    favorite: bool | None = None
    saved: bool | None = None


class HistoryCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    book_id: int = Field(gt=0)


class ProgressUpdate(BaseModel):
    page: int = Field(ge=0, le=1000000)
    total_pages: int = Field(ge=1, le=1000000)
    updated_at_ms: int = Field(gt=0, le=9007199254740991)
    chapter_id: int | None = Field(default=None, gt=0)
    chapter_page: int | None = Field(default=None, ge=0, le=1000000)
    base_revision: int | None = Field(default=None, ge=0)
    mutation_id: str | None = Field(default=None, min_length=1, max_length=64)

    @model_validator(mode="after")
    def valid_page(self):
        if self.page >= self.total_pages:
            raise ValueError("page must be less than total_pages")
        return self


class ProgressPublic(ORMModel):
    page: int
    total_pages: int
    updated_at_ms: int
    chapter_id: int | None = None
    chapter_page: int | None = None
    revision: int = 0
    mutation_id: str | None = None


class HistoryItem(ORMModel):
    history_id: int
    book_id: int
    title: str
    author: str | None = None
    genre: str | None = None
    cover_image: str | None = None
    summary: str | None = None
    file_path: str | None = None
    html_path: str | None = None
    created_at: datetime | None = None
    avg_rating: float = 0
    total_ratings: int = 0
    last_read_at: datetime | None = None


class LibraryItem(ORMModel):
    relation_id: int
    book_id: int
    title: str
    author: str | None = None
    genre: str | None = None
    cover_image: str | None = None
    summary: str | None = None
    type: str
    created_at: datetime | None = None


class BookIdBody(BaseModel):
    book_id: int = Field(gt=0)
