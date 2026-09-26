"""Database lifecycle; unavailable configured storage fails closed."""
from collections.abc import AsyncGenerator
from sqlalchemy import event, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from app.core.config import settings

Base = declarative_base()
SCHEMA_VERSION = 2


def create_engine_and_session(url: str):
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    eng = create_async_engine(url, pool_pre_ping=True)
    if url.startswith("sqlite"):
        @event.listens_for(eng.sync_engine, "connect")
        def configure_sqlite(connection, _record):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA busy_timeout=10000")
            cursor.close()
    return eng, async_sessionmaker(eng, class_=AsyncSession, expire_on_commit=False)


engine, AsyncSessionLocal = create_engine_and_session(settings.DATABASE_URL)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Initialize a fresh schema; never mutate unversioned legacy financial data."""
    from app.models import models, imports  # noqa: F401
    from app.services import bot_drafts  # noqa: F401
    async with engine.begin() as connection:
        tables = await connection.run_sync(lambda conn: inspect(conn).get_table_names())
        if tables and "schema_version" not in tables:
            raise RuntimeError("Legacy database: export and reconcile before migration; see docs/MIGRATION.md")
        if "schema_version" in tables:
            version = (await connection.execute(text("SELECT version FROM schema_version"))).scalar()
            if version != SCHEMA_VERSION:
                raise RuntimeError("Unsupported database version; explicit migration required")
        await connection.run_sync(Base.metadata.create_all)
        if "schema_version" not in tables:
            await connection.execute(text("CREATE TABLE schema_version (version INTEGER NOT NULL)"))
            await connection.execute(text("INSERT INTO schema_version VALUES (2)"))
