from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class Book(Base):
    __tablename__ = "books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    genre: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    html_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), index=True)
    uploaded_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    uploader = relationship("User", back_populates="books")
    comments = relationship("Comment", back_populates="book", cascade="all, delete-orphan")
    ratings = relationship("Rating", back_populates="book", cascade="all, delete-orphan")
    favorites = relationship("Favorite", back_populates="book", cascade="all, delete-orphan")
    saves = relationship("Save", back_populates="book", cascade="all, delete-orphan")
    reading_history = relationship(
        "ReadingHistory",
        back_populates="book",
        cascade="all, delete-orphan",
    )
