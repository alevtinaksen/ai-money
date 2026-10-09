"""Database lifecycle; unavailable configured storage fails closed."""
from collections.abc import AsyncGenerator
import ssl
from sqlalchemy import MetaData, event, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from app.core.config import settings

Base = declarative_base(metadata=MetaData(schema=settings.DATABASE_SCHEMA))
SCHEMA_VERSION = 2


def create_engine_and_session(url: str):
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    target = make_url(url)
    connect_args = {}
    if target.get_backend_name() == "postgresql":
        mode = target.query.get("sslmode")
        if mode not in (None, "require", "verify-full"):
            raise ValueError("PostgreSQL requires verified TLS")
        target = target.difference_update_query(["sslmode"])
        tls = ssl.create_default_context()
        if settings.DATABASE_SSL_CA_FILE:
            tls.load_verify_locations(cafile=settings.DATABASE_SSL_CA_FILE)
        connect_args["ssl"] = tls
    elif settings.DATABASE_SCHEMA:
        raise ValueError("DATABASE_SCHEMA requires PostgreSQL")
    eng = create_async_engine(target, pool_pre_ping=True, connect_args=connect_args)
    if target.get_backend_name() == "sqlite":
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
    from app.models import models, imports, creations  # noqa: F401
    from app.services import bot_drafts  # noqa: F401
    async with engine.begin() as connection:
        schema = Base.metadata.schema
        tables = await connection.run_sync(lambda conn: inspect(conn).get_table_names(schema=schema))
        qualifier = connection.dialect.identifier_preparer.quote_schema(schema) + "." if schema else ""
        version_table = qualifier + "schema_version"
        if tables and "schema_version" not in tables:
            raise RuntimeError("Legacy database: export and reconcile before migration; see docs/MIGRATION.md")
        if "schema_version" in tables:
            versions = (await connection.execute(text(f"SELECT version FROM {version_table}"))).scalars().all()
            if versions != [SCHEMA_VERSION]:
                raise RuntimeError("Unsupported database version; explicit migration required")
        await connection.run_sync(Base.metadata.create_all)
        if "schema_version" not in tables:
            await connection.execute(text(f"CREATE TABLE {version_table} (version INTEGER NOT NULL)"))
            await connection.execute(text(f"INSERT INTO {version_table} VALUES (2)"))
