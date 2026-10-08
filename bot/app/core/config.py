"""Explicit, local-first runtime configuration."""
from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    BOT_TOKEN: str = ""
    WEBAPP_URL: str = "http://localhost:5173"
    GROQ_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-3.8-flash"
    AI_PROVIDER: Literal["auto", "disabled", "groq", "gemini"] = "auto"
    AI_UPLOAD_CONSENT: bool = False
    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR / 'finance.db'}"
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
        env_file=(BASE_DIR / ".env", ".env"), env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()

