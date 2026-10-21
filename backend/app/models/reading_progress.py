from sqlalchemy import BigInteger, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.database import Base


class ReadingProgress(Base):
    """One position per account/book; independent of deletable reading history."""

    __tablename__ = "reading_progress"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    book_id: Mapped[int] = mapped_column(ForeignKey("books.id", ondelete="CASCADE"), primary_key=True)
    page: Mapped[int] = mapped_column(Integer, nullable=False)
    total_pages: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at_ms: Mapped[int] = mapped_column(BigInteger, nullable=False)
    chapter_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chapter_page: Mapped[int | None] = mapped_column(Integer, nullable=True)
    revision: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    mutation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
