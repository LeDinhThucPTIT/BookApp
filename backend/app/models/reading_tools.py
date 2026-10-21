from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.mysql import MEDIUMTEXT

from app.models.database import Base


class Story(Base):
    __tablename__ = "stories"
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), default="ongoing")


class StoryChapter(Base):
    __tablename__ = "story_chapters"
    __table_args__ = (UniqueConstraint("book_id", "number", name="uq_story_chapter_number"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("stories.book_id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text().with_variant(MEDIUMTEXT(), "mysql"))
    page_count: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Annotation(Base):
    __tablename__ = "annotations"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), index=True)
    page: Mapped[int] = mapped_column(Integer)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("story_chapters.id", ondelete="CASCADE"), nullable=True)
    chapter_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    quote: Mapped[str] = mapped_column(Text)
    start_offset: Mapped[int] = mapped_column(Integer)
    end_offset: Mapped[int] = mapped_column(Integer)
    note: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(20), default="yellow")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
