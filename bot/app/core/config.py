"""Explicit, local-first runtime configuration."""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    BOT_TOKEN: str = ""
    WEBAPP_URL: str = "http://localhost:5173"
    GROQ_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-1.5-flash"
    AI_PROVIDER: str = "auto"
    AI_UPLOAD_CONSENT: bool = True
    DATABASE_URL: str = f"sqlite+aiosqlite:///{BASE_DIR / 'finance.db'}"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = False
    APP_ENV: str = "development"
    ALLOW_LOCAL_LOGIN: bool = False
    AUTH_MAX_AGE: int = 3600
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", ".env"), env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()

