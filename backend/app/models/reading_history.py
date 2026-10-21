from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class ReadingHistory(Base):
    __tablename__ = "reading_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    book_id: Mapped[int | None] = mapped_column(
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    last_read_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="reading_history")
    book = relationship("Book", back_populates="reading_history")
