"""Serialize each owner's category graph checks and mutations until commit."""
from contextlib import asynccontextmanager
import hashlib

from sqlalchemy import text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import FinanceUser


@asynccontextmanager
async def graph_mutation(db: AsyncSession, user_id: int):
    try:
        with db.no_autoflush:
            if db.bind.dialect.name == "sqlite":
                # A write statement acquires SQLite's writer lock even if the
                # owner has no onboarding row. SELECT alone does not do this.
                await db.execute(
                    update(FinanceUser)
                    .where(FinanceUser.user_id == user_id)
                    .values(user_id=FinanceUser.user_id)
                    .execution_options(synchronize_session=False)
                )
            elif db.bind.dialect.name == "postgresql":
                # No schema or onboarding changes: transaction-scoped locks work
                # for users with no row and release on both commit and rollback.
                key = int.from_bytes(
                    hashlib.sha256(f"ai-money:category-graph:{user_id}".encode()).digest()[:8],
                    byteorder="big", signed=True,
                )
                await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": key})
            else:
                raise RuntimeError("Category graph locking requires SQLite or PostgreSQL")
        yield
        await db.commit()
    except BaseException:
        await db.rollback()
        raise
