import uuid
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from app.core.config import settings

logger = logging.getLogger("ai-money.database")

Base = declarative_base()

def create_engine_and_session(url: str):
    target_url = url
    if target_url.startswith("postgres://"):
        target_url = target_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif target_url.startswith("postgresql://") and "+asyncpg" not in target_url:
        target_url = target_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    connect_args = {}
    if target_url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}

    eng = create_async_engine(
        target_url,
        echo=False,
        connect_args=connect_args
    )
    sess_maker = async_sessionmaker(
        bind=eng,
        class_=AsyncSession,
        expire_on_commit=False
    )
    return eng, sess_maker

engine, AsyncSessionLocal = create_engine_and_session(settings.DATABASE_URL)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    global engine, AsyncSessionLocal
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database initialized successfully with primary DATABASE_URL")
    except Exception as e:
        logger.error(f"Primary database connection failed ({e}). Falling back to local SQLite to prevent startup crash.", exc_info=True)
        fallback_url = "sqlite+aiosqlite:///./finance.db"
        engine, AsyncSessionLocal = create_engine_and_session(fallback_url)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Fallback SQLite database initialized successfully.")

    # Safe migrations: run each in an isolated transaction so an existing column doesn't abort others
    for stmt in [
        "ALTER TABLE accounts ADD COLUMN bank_name VARCHAR(50)",
        "ALTER TABLE transactions ADD COLUMN client_id VARCHAR(36)",
    ]:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt))
        except Exception:
            pass


