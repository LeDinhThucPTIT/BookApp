from pydantic import BaseModel, Field, ConfigDict
from typing import Literal


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=3000)


class SourceCitation(BaseModel):
    quote: str
    book_id: int | None = None
    page: int | None = None
    chapter_title: str | None = None


class AIRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)


class AISummarizeRequest(AIRequest):
    book_id: int | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, max_length=255)
    chapter_name: str | None = Field(default=None, max_length=255)
    content: str = Field(..., min_length=10, max_length=30000, description="Nội dung trang hoặc chương sách cần tóm tắt")
    page: int | None = Field(default=None, ge=0)
    selected_text: str | None = Field(default=None, min_length=1, max_length=1800)


class AISummarizeResponse(BaseModel):
    summary: str
    key_points: list[str] = Field(default_factory=list)
    characters: list[str] = Field(default_factory=list)
    takeaway: str | None = None
    is_mock: bool = False


class AIAskRequest(AIRequest):
    book_id: int | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, max_length=255)
    question: str = Field(..., min_length=2, max_length=2000, description="Câu hỏi của người đọc")
    context: str = Field(..., min_length=10, max_length=30000, description="Đoạn văn bản/chương đang đọc để làm ngữ cảnh")
    page: int | None = Field(default=None, ge=0)
    selected_text: str | None = Field(default=None, min_length=1, max_length=1800)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


class AIAskResponse(BaseModel):
    answer: str
    suggested_questions: list[str] = Field(default_factory=list)
    is_mock: bool = False
    citations: list[SourceCitation] = Field(default_factory=list)
