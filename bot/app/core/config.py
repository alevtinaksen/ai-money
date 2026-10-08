"""Explicit, local-first runtime configuration."""
from pathlib import Path
import re
from typing import Literal
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    BOT_TOKEN: str = ""
    WEBAPP_URL: str = "http://localhost:5173"
    GROQ_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_THINKING_LEVEL: Literal["default", "low"] = "low"
    AI_PROVIDER: Literal["auto", "disabled", "groq", "gemini"] = "auto"
    AI_UPLOAD_CONSENT: bool = False
    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR / 'finance.db'}"
    DATABASE_SCHEMA: str | None = None
    DATABASE_SSL_CA_FILE: str | None = None
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = False
    APP_ENV: str = "development"
    SQLITE_PERSISTENT_STORAGE: bool = False
    ALLOW_LOCAL_LOGIN: bool = False
    SERVER_URL: str | None = None
    TELEGRAM_MODE: Literal["disabled", "polling", "webhook"] = "polling"
    TELEGRAM_WEBHOOK_SECRET: str | None = None
    AUTH_MAX_AGE: int = 3600
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", ".env"), env_file_encoding="utf-8", extra="ignore",
        hide_input_in_errors=True,
    )

    @field_validator("DATABASE_SCHEMA", mode="before")
    @classmethod
    def database_schema_identifier(cls, value):
        if value in (None, ""):
            return None
        if (not isinstance(value, str)
                or re.fullmatch(r"[a-z][a-z0-9_]{0,62}", value) is None
                or value.startswith("pg_") or value == "information_schema"):
            raise ValueError("Use an application schema identifier, at most 63 lowercase characters")
        return value

    @model_validator(mode="after")
    def schema_requires_postgresql(self):
        if self.DATABASE_SCHEMA and not self.DATABASE_URL.startswith(("postgres:", "postgresql:", "postgresql+asyncpg:")):
            raise ValueError("DATABASE_SCHEMA requires PostgreSQL")
        return self


settings = Settings()

