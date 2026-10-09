"""Storage namespace and TLS boundaries; synthetic inputs only."""
import json
import os
from pathlib import Path
import ssl
import subprocess
import sys

import pytest
from pydantic import ValidationError
from sqlalchemy import inspect, text

from app.core import database
from app.core.config import Settings


@pytest.mark.parametrize("name", ["bad;drop", "Uppercase", "pg_catalog", "information_schema", "x" * 64, "app\n"])
def test_invalid_schema_identifier_is_rejected(name):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, DATABASE_URL="postgresql://synthetic:password@db.invalid/test", DATABASE_SCHEMA=name)


def test_sqlite_cannot_silently_reuse_a_production_namespace():
    with pytest.raises(ValidationError, match="requires PostgreSQL"):
        Settings(_env_file=None, DATABASE_URL="sqlite+aiosqlite:///synthetic.db", DATABASE_SCHEMA="ai_money_v2")
    assert Settings(_env_file=None, DATABASE_SCHEMA="").DATABASE_SCHEMA is None


def test_invalid_configuration_does_not_echo_credentials():
    with pytest.raises(ValidationError) as failure:
        Settings(_env_file=None, BOT_TOKEN="synthetic-secret-marker", DATABASE_SCHEMA="ai_money_v2",
                 DATABASE_URL="sqlite+aiosqlite:///synthetic.db")
    assert "synthetic-secret-marker" not in str(failure.value)


def test_postgresql_always_receives_hostname_verified_tls(monkeypatch):
    captured = {}
    def record(url, **kwargs):
        captured.update(url=url, **kwargs)
        return object()
    monkeypatch.setattr(database, "create_async_engine", record)
    monkeypatch.setattr(database.settings, "DATABASE_SSL_CA_FILE", None)
    database.create_engine_and_session("postgres://synthetic:password@db.invalid/test?sslmode=require")
    tls = captured["connect_args"]["ssl"]
    assert tls.check_hostname is True
    assert tls.verify_mode == ssl.CERT_REQUIRED
    assert captured["url"].drivername == "postgresql+asyncpg"
    assert "sslmode" not in captured["url"].query


@pytest.mark.parametrize("mode", ["disable", "allow", "prefer", "verify-ca"])
def test_postgresql_url_cannot_weaken_tls(mode):
    with pytest.raises(ValueError, match="verified TLS"):
        database.create_engine_and_session(f"postgresql://synthetic:password@db.invalid/test?sslmode={mode}")


def test_orm_and_foreign_keys_use_the_prepared_namespace():
    script = """
import json
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable
from app.core.database import Base
from app.models import models, imports
from app.services import bot_drafts
ddl = str(CreateTable(models.Transaction.__table__).compile(dialect=postgresql.dialect()))
print(json.dumps({'schemas': sorted(set(t.schema for t in Base.metadata.tables.values())),
                  'target_table': 'CREATE TABLE ai_money_v2.transactions' in ddl,
                  'target_fk': 'REFERENCES ai_money_v2.accounts' in ddl}))
"""
    root = Path(__file__).resolve().parents[2]
    env = {**os.environ, "PYTHONPATH": str(root / "bot"), "DATABASE_SCHEMA": "ai_money_v2",
           "DATABASE_URL": "postgresql://synthetic:password@db.invalid/test", "DATABASE_SSL_CA_FILE": ""}
    result = subprocess.run([sys.executable, "-c", script], cwd=root / "work", env=env,
                            capture_output=True, text=True, check=True)
    assert json.loads(result.stdout) == {"schemas": ["ai_money_v2"], "target_table": True, "target_fk": True}


@pytest.mark.asyncio
async def test_fresh_storage_versions_itself_and_reopens(tmp_path, monkeypatch):
    engine, _ = database.create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'fresh.db'}")
    monkeypatch.setattr(database, "engine", engine)
    await database.init_db()
    await database.init_db()
    async with engine.connect() as conn:
        assert (await conn.execute(text("SELECT version FROM schema_version"))).scalars().all() == [2]
        assert "accounts" in await conn.run_sync(lambda c: inspect(c).get_table_names())
    await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("versions", [None, [], [1], [2, 2]])
async def test_legacy_or_ambiguous_version_is_never_mutated(tmp_path, monkeypatch, versions):
    engine, _ = database.create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'legacy.db'}")
    monkeypatch.setattr(database, "engine", engine)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE TABLE sentinel (value TEXT NOT NULL)"))
        await conn.execute(text("INSERT INTO sentinel VALUES ('synthetic-preserved')"))
        if versions is not None:
            await conn.execute(text("CREATE TABLE schema_version (version INTEGER NOT NULL)"))
            for value in versions:
                await conn.execute(text("INSERT INTO schema_version VALUES (:value)"), {"value": value})
    with pytest.raises(RuntimeError):
        await database.init_db()
    async with engine.connect() as conn:
        assert (await conn.execute(text("SELECT value FROM sentinel"))).scalar() == "synthetic-preserved"
        assert "accounts" not in await conn.run_sync(lambda c: inspect(c).get_table_names())
    await engine.dispose()


@pytest.mark.asyncio
async def test_supported_schema_adds_creation_registry_without_changing_balance(tmp_path, monkeypatch):
    from app.models.creations import EntityCreation
    from app.schemas.finance import AccountCreate
    from app.services.finance_svc import FinanceService
    engine, factory = database.create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'additive.db'}")
    monkeypatch.setattr(database, 'engine', engine)
    await database.init_db()
    async with factory() as db:
        account = await FinanceService.create_account(db, 1, AccountCreate(name='Synthetic', balance='1000'))
        account_id = account.id
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: EntityCreation.__table__.drop(c))
    await database.init_db()
    async with factory() as db:
        rows = await FinanceService.get_accounts(db, 1)
        assert len(rows) == 1 and rows[0].id == account_id and rows[0].balance == 1000
        assert (await db.execute(text('SELECT count(*) FROM entity_creations'))).scalar() == 0
    await engine.dispose()
