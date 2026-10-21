from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.book import BookPublic
from app.schemas.common import ORMModel


class StoryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=255)
    author: str = Field(min_length=1, max_length=255)
    genre: str = Field(default="Truyện", max_length=100)
    summary: str = Field(default="", max_length=10000)
    status: Literal["ongoing", "completed"] = "ongoing"


class StoryPublic(BookPublic):
    status: str
    chapter_count: int = 0


class ChapterWrite(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    number: int = Field(ge=1, le=100000)
    title: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1, max_length=60000)


class ChapterMeta(ORMModel):
    id: int
    book_id: int
    number: int
    title: str
    page_count: int = 1
    created_at: datetime | None = None


class ChapterPublic(ChapterMeta):
    content: str


class AnnotationCreate(BaseModel):
    page: int = Field(ge=0)
    quote: str = Field(min_length=1, max_length=1800)
    start_offset: int = Field(ge=0, le=3600)
    end_offset: int = Field(ge=1, le=3600)
    note: str = Field(default="", max_length=10000)
    color: Literal["yellow", "green", "pink"] = "yellow"
    chapter_id: int | None = Field(default=None, gt=0)
    chapter_page: int | None = Field(default=None, ge=0)


class AnnotationUpdate(BaseModel):
    note: str = Field(max_length=10000)
    color: Literal["yellow", "green", "pink"] = "yellow"


class AnnotationPublic(ORMModel):
    id: int
    book_id: int
    page: int
    chapter_id: int | None = None
    chapter_page: int | None = None
    source_missing: bool = False
    quote: str
    start_offset: int
    end_offset: int
    note: str
    color: str
    created_at: datetime | None = None
