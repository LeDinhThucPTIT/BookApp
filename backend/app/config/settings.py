from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator, model_validator
from sqlalchemy.engine import URL

APP_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = APP_DIR.parent


class Settings(BaseSettings):
    """Environment-driven application configuration."""

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "BookApp API"
    app_env: str = "development"
    debug: bool = True

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug_mode(cls, value):
        # Some Windows development environments export DEBUG=release/debug.
        if isinstance(value, str) and value.lower() in {"release", "debug"}:
            return value.lower() == "debug"
        return value

    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = ""
    mysql_database: str = "bookapp"

    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = Field(default=60 * 24, ge=1, le=10080)
    jwt_cookie_name: str = "access_token"
    redis_url: str | None = None

    flask_secret_key: str | None = None

    cors_origins: str = "http://127.0.0.1:5000,http://localhost:5000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"
    rate_limit_default: str = "60/minute"
    rate_limit_auth: str = "10/minute"
    rate_limit_ai: str = "6/minute"

    mail_server: str = "smtp.gmail.com"
    mail_port: int = 587
    mail_username: str | None = None
    mail_password: str | None = None
    mail_default_sender: str | None = None

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-flash"

    @property
    def secret_key(self) -> str:
        return self.flask_secret_key or self.jwt_secret_key

    @property
    def production(self) -> bool:
        return self.app_env.lower() == "production"

    @model_validator(mode="after")
    def validate_production(self):
        if self.production:
            if self.debug:
                raise ValueError("DEBUG must be false in production")
            if len(self.secret_key) < 32 or self.secret_key.startswith(("change-me", "replace-with")):
                raise ValueError("Production requires a random secret of at least 32 characters")
            if not self.redis_url:
                raise ValueError("Production requires REDIS_URL for shared OTP and rate limits")
            if not self.cors_origin_list or any(not origin.startswith("https://") for origin in self.cors_origin_list):
                raise ValueError("Production CORS_ORIGINS must contain explicit HTTPS origins")
        return self

    @property
    def database_url(self) -> str:
        return URL.create(
            "mysql+aiomysql", username=self.mysql_user, password=self.mysql_password,
            host=self.mysql_host, port=self.mysql_port, database=self.mysql_database,
            query={"charset": "utf8mb4"},
        ).render_as_string(hide_password=False)

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def upload_cover_dir(self) -> Path:
        path = APP_DIR / "static" / "images" / "Book"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def upload_book_dir(self) -> Path:
        path = APP_DIR / "static" / "books"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def upload_html_dir(self) -> Path:
        path = APP_DIR / "static" / "book_html"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def static_dir(self) -> Path:
        return APP_DIR / "static"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
