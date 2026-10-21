from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    sdt: Mapped[str] = mapped_column(String(11), unique=True, nullable=False, default="")
    ngaysinh: Mapped[date | None] = mapped_column(Date, nullable=True)
    sex: Mapped[str | None] = mapped_column(String(10), nullable=True)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    role: Mapped[str] = mapped_column(String(10), default="user")
    avatar: Mapped[str] = mapped_column(
        String(255),
        default="/images/Logo/Avatar.png",
    )

    books = relationship("Book", back_populates="uploader")
    comments = relationship("Comment", back_populates="user")
    ratings = relationship("Rating", back_populates="user")
    favorites = relationship("Favorite", back_populates="user")
    saves = relationship("Save", back_populates="user")
    reading_history = relationship("ReadingHistory", back_populates="user")
