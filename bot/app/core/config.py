from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    BOT_TOKEN: str = "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
    WEBAPP_URL: str = "http://localhost:5173"
    
    # AI Keys (Free Tier)
    GROQ_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    
    # Database
    # Default to local SQLite for immediate zero-config development, or Supabase/PostgreSQL:
    DATABASE_URL: str = "sqlite+aiosqlite:///./finance.db"
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
