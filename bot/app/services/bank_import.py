"""Review then atomic confirmation of canonical CSV imports."""

from copy import deepcopy
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from app.models.models import Account
from app.models.imports import ImportBatch, ImportIdentity
from app.schemas.finance import TransactionCreate
from app.domain.errors import ConflictError
from app.services.finance_transactions import owned, create_transaction
from app.services.bank_import_csv import parse_csv


async def get_batch(db, user_id: int, batch_id: str):
    return await db.scalar(
        select(ImportBatch)
        .where(ImportBatch.id == batch_id, ImportBatch.user_id == user_id)
        .execution_options(populate_existing=True)
    )


def result(batch) -> dict:
    rows = [
        {k: v for k, v in row.items() if k not in ("source_key", "signed_amount")}
        for row in batch.rows
    ]
    return {
        "id": batch.id,
        "account_id": batch.account_id,
        "revision": batch.revision,
        "status": batch.status,
        "rows": rows,
        "transaction_ids": batch.transaction_ids,
    }


async def preview(db, user_id: int, account_id: str, content: bytes) -> dict:
    account = await owned(db, Account, user_id, account_id)
    if account is None:
        raise ValueError("Счёт не найден")
    rows = parse_csv(content, account_id, account.currency)
    keys = set(
        (
            await db.scalars(
                select(ImportIdentity.source_key).where(
                    ImportIdentity.user_id == user_id, ImportIdentity.account_id == account_id
                )
            )
        ).all()
    )
    for row in rows:
        row["duplicate"] = row["source_key"] in keys
        if row["duplicate"]:
            row["include"] = False
        keys.add(row["source_key"])
    batch = ImportBatch(user_id=user_id, account_id=account_id, rows=rows)
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    return result(batch)


async def review(
    db, user_id: int, batch_id: str, row_id: str, revision: int, changes: dict
) -> dict | None:
    batch = await get_batch(db, user_id, batch_id)
    if batch is None:
        return None
    if batch.status != "draft" or revision != batch.revision:
        raise ConflictError("Пакет уже изменён или подтверждён")
    rows = deepcopy(batch.rows)
    row = next((row for row in rows if row["id"] == row_id), None)
    if row is None:
        return None
    allowed = {"include", "type", "category_id", "note", "force_duplicate"}
    if set(changes) - allowed:
        raise ValueError("Исходные данные CSV менять нельзя")
    row.update(changes)
    if row["type"] not in ("income", "expense") or not all(
        isinstance(row[key], bool) for key in ("include", "force_duplicate")
    ):
        raise ValueError("Неверный тип или флаг операции")
    if row["force_duplicate"] and (not row["duplicate"] or row["source_id"]):
        raise ValueError("Повтор допустим только для совпадения без банковского ID")
    if row["include"] and (
        row["error"] or (row["duplicate"] and (row["source_id"] or not row["force_duplicate"]))
    ):
        raise ValueError("Ошибочная или повторная строка не может быть включена")
    changed = await db.execute(
        update(ImportBatch)
        .where(
            ImportBatch.id == batch_id,
            ImportBatch.user_id == user_id,
            ImportBatch.revision == revision,
            ImportBatch.status == "draft",
        )
        .values(rows=rows, revision=revision + 1)
        .execution_options(synchronize_session=False)
    )
    if changed.rowcount != 1:
        await db.rollback()
        raise ConflictError("Пакет уже изменён")
    await db.commit()
    await db.refresh(batch)
    return result(batch)


async def confirm(
    db, user_id: int, batch_id: str, revision: int, row_ids: list[str]
) -> dict | None:
    try:
        batch = await get_batch(db, user_id, batch_id)
        if batch is None:
            return None
        selected = sorted(set(row_ids))
        if batch.status == "confirmed":
            if selected == batch.selected_ids:
                return result(batch)
            raise ConflictError("Пакет подтверждён с другим набором строк")
        if batch.revision != revision:
            raise ConflictError("Пакет уже изменён")
        rows = [row for row in batch.rows if row["id"] in selected]
        if (
            not selected
            or len(rows) != len(selected)
            or any(not r["include"] or r["error"] for r in rows)
        ):
            raise ValueError("Выберите проверенные включённые строки")
        claimed = await db.execute(
            update(ImportBatch)
            .where(
                ImportBatch.id == batch_id,
                ImportBatch.user_id == user_id,
                ImportBatch.revision == revision,
                ImportBatch.status == "draft",
            )
            .values(status="confirming", revision=revision + 1)
            .execution_options(synchronize_session=False)
        )
        if claimed.rowcount != 1:
            raise ConflictError("Пакет уже изменён")
        tx_ids = []
        for row in rows:
            tx_ids.append(await import_row(db, user_id, batch, row))
        await db.execute(
            update(ImportBatch)
            .where(ImportBatch.id == batch_id)
            .values(status="confirmed", selected_ids=selected, transaction_ids=tx_ids)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        await db.refresh(batch)
        return result(batch)
    except IntegrityError:
        await db.rollback()
        raise ConflictError("Операция уже импортирована; обновите предпросмотр") from None
    except Exception:
        await db.rollback()
        raise


async def import_row(db, user_id: int, batch, row: dict) -> str:
    key = row["source_key"]
    if not row["source_id"] and row["force_duplicate"]:
        key = "forced:" + row["id"]
    elif row["duplicate"]:
        raise ConflictError("Повторная строка требует проверки")
    tx = await create_transaction(
        db,
        user_id,
        TransactionCreate(
            account_id=batch.account_id,
            amount=row["amount"],
            type=row["type"],
            category_id=row["category_id"],
            note=row["note"],
            created_at=row["date"],
            client_id="import:" + row["id"],
        ),
        commit=False,
    )
    db.add(
        ImportIdentity(
            user_id=user_id, account_id=batch.account_id, source_key=key, transaction_id=tx.id
        )
    )
    await db.flush()
    return tx.id
