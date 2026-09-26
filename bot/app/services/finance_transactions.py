"""Atomic transaction mutations; all public writes own a commit unless disabled."""

from contextlib import asynccontextmanager
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select, update, literal
from sqlalchemy.exc import IntegrityError
from app.models.models import Account, Category, Transaction
from app.schemas.finance import TransactionCreate, persisted_utc
from app.domain.errors import ConflictError


async def owned(db, model, user_id, object_id, active=True):
    query = select(model).where(model.id == object_id, model.user_id == user_id)
    if active:
        query = query.where(model.is_archived.is_(False))
    return await db.scalar(query.execution_options(populate_existing=True))


async def validate_links(db, user_id, data):
    account = await owned(db, Account, user_id, data.account_id)
    if account is None:
        raise ValueError("Счёт не найден или архивирован")
    if data.type == "transfer":
        target = await owned(db, Account, user_id, data.to_account_id)
        if target is None or target.id == account.id or target.currency != account.currency:
            raise ValueError("Перевод требует два своих счёта в одной валюте")
        if data.category_id:
            raise ValueError("Перевод не имеет категории")
    elif data.to_account_id:
        raise ValueError("Счёт получателя допустим только для перевода")
    if data.category_id:
        category = await owned(db, Category, user_id, data.category_id)
        if category is None or category.type not in ("both", data.type):
            raise ValueError("Категория не найдена или не подходит для операции")


def fingerprint(data):
    payload = data.model_dump(mode="json", exclude={"client_id"})
    payload["amount"] = str(data.amount.quantize(Decimal("0.01")))
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


MAX_BALANCE = Decimal("999999999999.99")


def balance_changes(data, multiplier=1):
    amount = Decimal(data.amount) * multiplier
    changes = {data.account_id: amount if data.type == "income" else -amount}
    if data.type == "transfer":
        changes[data.to_account_id] = amount
    return changes


async def apply_changes(db, user_id, changes):
    for account_id in sorted(changes):
        next_balance = Account.balance + changes[account_id]
        result = await db.execute(
            update(Account)
            .where(
                Account.id == account_id,
                Account.user_id == user_id,
                next_balance.between(
                    literal(-MAX_BALANCE, type_=Account.balance.type),
                    literal(MAX_BALANCE, type_=Account.balance.type),
                ),
            )
            .values(balance=next_balance)
        )
        if result.rowcount != 1:
            raise ValueError("Счёт не найден или остаток выходит за допустимый предел")


async def apply_delta(db, user_id, data, multiplier=1):
    await apply_changes(db, user_id, balance_changes(data, multiplier))


def check_replay(existing, digest):
    if existing.is_deleted or existing.fingerprint != digest:
        raise ConflictError("Ключ операции уже использован с другим содержимым или удалён")
    return existing


@asynccontextmanager
async def transaction_scope(db, commit):
    if commit:
        yield
    else:
        if db.bind.dialect.name == "sqlite":
            # Python 3.11 SQLite legacy mode otherwise RELEASEs an outermost
            # SAVEPOINT as a commit; force an actual outer write transaction.
            await db.execute(
                update(Account).where(Account.id == "").values(balance=Account.balance)
            )
        async with db.begin_nested():
            yield


async def create_transaction(
    db: AsyncSession, user_id: int, data: TransactionCreate, commit: bool = True
) -> Transaction:
    data = TransactionCreate.model_validate(data.model_dump())
    digest = fingerprint(data)
    query = select(Transaction).where(
        Transaction.user_id == user_id, Transaction.client_id == data.client_id
    )
    if data.client_id:
        existing = await db.scalar(query.execution_options(populate_existing=True))
        if existing:
            return check_replay(existing, digest)
    try:
        async with transaction_scope(db, commit):
            await validate_links(db, user_id, data)
            values = data.model_dump()
            values["created_at"] = data.created_at or datetime.now(timezone.utc)
            values["amount"] = data.amount.quantize(Decimal("0.01"))
            tx = Transaction(user_id=user_id, fingerprint=digest, **values)
            db.add(tx)
            await db.flush()
            await apply_delta(db, user_id, data)
        if commit:
            await db.commit()
        await db.refresh(tx)
        return tx
    except IntegrityError:
        if commit:
            await db.rollback()
        existing = await db.scalar(query) if data.client_id else None
        if existing:
            return check_replay(existing, digest)
        raise ConflictError("Операция конфликтует с существующей записью") from None
    except Exception:
        if commit:
            await db.rollback()
        raise


async def get_transaction(db, user_id, tx_id):
    return await db.scalar(
        select(Transaction)
        .where(
            Transaction.id == tx_id,
            Transaction.user_id == user_id,
            Transaction.is_deleted.is_(False),
        )
        .execution_options(populate_existing=True)
    )


async def update_transaction(
    db: AsyncSession, user_id: int, tx_id: str, changes: dict[str, Any]
) -> Transaction | None:
    try:
        tx = await get_transaction(db, user_id, tx_id)
        if tx is None:
            return None
        revision = changes.get("revision")
        if revision != tx.revision:
            raise ConflictError("Операция уже изменена. Обновите список")
        values = {key: getattr(tx, key) for key in TransactionCreate.model_fields}
        values["created_at"] = persisted_utc(values["created_at"])
        values.update({key: value for key, value in changes.items() if key != "revision"})
        data = TransactionCreate(**values)
        await validate_links(db, user_id, data)
        result = await db.execute(
            update(Transaction)
            .where(
                Transaction.id == tx_id,
                Transaction.user_id == user_id,
                Transaction.revision == revision,
                Transaction.is_deleted.is_(False),
            )
            .values(revision=revision + 1)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount != 1:
            raise ConflictError("Операция уже изменена")
        changes = balance_changes(tx, -1)
        for account_id, delta in balance_changes(data).items():
            changes[account_id] = changes.get(account_id, Decimal(0)) + delta
        await apply_changes(db, user_id, changes)
        await db.execute(
            update(Transaction)
            .where(Transaction.id == tx_id)
            .values(**data.model_dump(exclude={"client_id"}), revision=revision + 1)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        await db.refresh(tx)
        return tx
    except Exception:
        await db.rollback()
        raise


async def delete_transaction(
    db: AsyncSession, user_id: int, tx_id: str, revision: int | None = None
) -> bool:
    try:
        tx = await get_transaction(db, user_id, tx_id)
        if tx is None:
            return False
        if revision != tx.revision:
            raise ConflictError("Операция уже изменена. Обновите список")
        result = await db.execute(
            update(Transaction)
            .where(
                Transaction.id == tx_id,
                Transaction.user_id == user_id,
                Transaction.revision == revision,
                Transaction.is_deleted.is_(False),
            )
            .values(is_deleted=True, revision=revision + 1)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount != 1:
            raise ConflictError("Операция уже изменена")
        await apply_delta(db, user_id, tx, -1)
        await db.commit()
        return True
    except Exception:
        await db.rollback()
        raise
