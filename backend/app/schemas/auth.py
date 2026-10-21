import re

from pydantic import BaseModel, EmailStr, Field, field_validator


def normalize_phone(value: str) -> str:
    phone = re.sub(r"[\s().-]", "", value.strip())
    if phone.startswith("+84"):
        phone = "0" + phone[3:]
    if phone and (not phone.isascii() or not phone.isdigit() or not 10 <= len(phone) <= 11):
        raise ValueError("Số điện thoại cần có 10–11 chữ số.")
    return phone


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember: bool = True

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    sdt: str = Field(default="", max_length=11)
    name: str | None = Field(default=None, max_length=100)

    @field_validator("sdt", mode="before")
    @classmethod
    def clean_phone(cls, value):
        return normalize_phone(value) if isinstance(value, str) else value

    @field_validator("email", "username", "name", mode="before")
    @classmethod
    def clean_profile(cls, value, info):
        if isinstance(value, str):
            value = value.strip()
            return value.lower() if info.field_name == "email" else value
        return value


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    redirect: str


class ForgotOTPRequest(BaseModel):
    email_or_phone: str = Field(min_length=1, max_length=100)


class ResetPasswordRequest(BaseModel):
    otp: str = Field(min_length=6, max_length=6)
    new_pass: str = Field(min_length=6, max_length=128)
    reset_token: str | None = None
