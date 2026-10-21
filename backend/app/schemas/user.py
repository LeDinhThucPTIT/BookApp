from datetime import date, datetime

from pydantic import EmailStr, Field

from app.schemas.common import ORMModel


class UserPublic(ORMModel):
    id: int
    username: str
    email: EmailStr
    sdt: str
    ngaysinh: date | None = None
    sex: str | None = None
    name: str | None = None
    role: str
    avatar: str
    created_at: datetime | None = None


class UserUpdateRequest(ORMModel):
    username: str | None = Field(default=None, min_length=2, max_length=50)
    name: str | None = Field(default=None, max_length=100)
    ngaysinh: date | None = None
    sex: str | None = Field(default=None, max_length=10)
