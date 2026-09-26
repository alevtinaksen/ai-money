"""Offline finance audit probe; takes the extracted archive source directory.

Run: python -B finance_probe.py --source /path/to/extracted/ai-money
Requires installed sqlalchemy, aiosqlite and pydantic. Does not install packages.
Uses only in-memory SQLite, with app.core.database replaced in-process by Base.
Does not import production configuration or connect to external services.
Not a PostgreSQL, HTTP authorization or full application integration test.
The seed probes use constants in the supplied source; logs omit their contents.
"""

import argparse
import asyncio
import importlib.metadata
import json
import sys
import types
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base


def emit(name: str, **values: object) -> None:
    """Print sanitized synthetic results as one reproducible record."""
    print(json.dumps({"probe": name, **values}, ensure_ascii=False))


async def run_probes(base, account_model, transaction_model, create_schema, service, to_dec):
    """Exercise original financial code without loading its configured database."""
    emit("ROUND", float_input=str(to_dec(2.675)),
         decimal_input=str(to_dec(Decimal("2.675"))), invalid=str(to_dec("bad")))
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as session:
        source = account_model(user_id=1, name="Synthetic A", balance=100, currency="RUB")
        foreign = account_model(user_id=2, name="Synthetic B", balance=100, currency="RUB")
        session.add_all([source, foreign])
        await session.commit()
        tx = await service.update_transaction(session, 1, "synthetic-foreign", {
            "account_id": foreign.id, "amount": 10, "type": "expense"})
        emit("FOREIGN_ACCOUNT_PUT", owner=foreign.user_id, caller=1,
             balance=str(foreign.balance), tx_user=tx.user_id)
        tx = await service.create_transaction(session, 1, create_schema(
            account_id=source.id, amount=-5, type="expense"))
        emit("NEGATIVE_EXPENSE", balance=str(source.balance), amount=str(tx.amount))
        tx = await service.update_transaction(session, 1, "synthetic-transfer", {
            "account_id": source.id, "amount": 10, "type": "transfer"})
        emit("TRANSFER_NO_DEST", balance=str(source.balance), destination=tx.to_account_id)
        destination = account_model(user_id=1, name="Synthetic USD", balance=0, currency="USD")
        session.add(destination)
        await session.commit()
        await service.create_transaction(session, 1, create_schema(
            account_id=source.id, to_account_id=destination.id, amount=10, type="transfer"))
        emit("FX_TRANSFER", rub_balance=str(source.balance), usd_balance=str(destination.balance))
    async with sessions() as session:
        await service.ensure_user_seeded(session, 3)
        tx = (await session.execute(select(transaction_model).where(
            transaction_model.user_id == 3))).scalars().first()
        tx_id = tx.id
        await service.delete_transaction(session, 3, tx_id)
        await service.get_accounts(session, 3)
        restored = (await session.execute(select(transaction_model).where(
            transaction_model.id == tx_id))).scalar_one_or_none()
        emit("DELETED_SEED_RESTORED", restored=restored is not None)
    async with sessions() as session:
        try:
            await service.ensure_user_seeded(session, 4)
            emit("SECOND_SEEDED_USER", result="no_error")
        except Exception as exc:
            emit("SECOND_SEEDED_USER", result=type(exc).__name__)
            await session.rollback()
    async with sessions() as session:
        current = await service.get_dashboard_summary(session, 3, 0)
        previous = await service.get_dashboard_summary(session, 3, -12)
        emit("MONTH_OFFSET_IGNORED", same=current == previous,
             label=current.period_label, recent_count=len(current.recent_transactions))
    await engine.dispose()

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as session:
        account = account_model(user_id=1, name="Synthetic concurrent", balance=100)
        session.add(account)
        await session.commit()
        account_id = account.id
    async with sessions() as first, sessions() as second:
        # Strong references deliberately preserve both stale ORM identity-map reads.
        first_account = (await first.execute(select(account_model).where(
            account_model.id == account_id))).scalar_one()
        second_account = (await second.execute(select(account_model).where(
            account_model.id == account_id))).scalar_one()
        assert first_account.balance == second_account.balance
        await service.create_transaction(first, 1, create_schema(account_id=account_id, amount=10))
        await service.create_transaction(second, 1, create_schema(account_id=account_id, amount=20))
    async with sessions() as session:
        account = (await session.execute(select(account_model).where(
            account_model.id == account_id))).scalar_one()
        transactions = (await session.execute(select(transaction_model))).scalars().all()
        emit("STALE_READ_LOST_UPDATE", expected=70, actual=str(account.balance),
             tx_total=sum(float(tx.amount) for tx in transactions))
        try:
            await service.delete_account(session, 1, account_id)
            emit("DELETE_ACCOUNT_WITH_TRANSACTIONS", result="no_error")
        except Exception as exc:
            emit("DELETE_ACCOUNT_WITH_TRANSACTIONS", result=type(exc).__name__)
            await session.rollback()
    await engine.dispose()


def main() -> None:
    """Load only original models, schemas and service, then run isolated probes."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve()
    if not (source / "bot/app/services/finance_svc.py").is_file():
        parser.error("--source must contain bot/app/services/finance_svc.py")
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(source / "bot"))
    database_stub = types.ModuleType("app.core.database")
    database_stub.Base = declarative_base()
    sys.modules["app.core.database"] = database_stub
    from app.models.models import Account, Transaction
    from app.schemas.finance import TransactionCreate
    from app.services.finance_svc import FinanceService, to_dec

    emit("ENVIRONMENT", python=sys.version.split()[0], packages={
        name: importlib.metadata.version(name)
        for name in ("sqlalchemy", "aiosqlite", "pydantic")},
        database="sqlite :memory:", config="in-process Base stub; production config not imported")
    asyncio.run(run_probes(database_stub.Base, Account, Transaction,
                          TransactionCreate, FinanceService, to_dec))


if __name__ == "__main__":
    main()
