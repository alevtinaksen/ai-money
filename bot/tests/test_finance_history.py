"""Historical metadata can change without rewriting money or references."""
from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.core.database import Base, create_engine_and_session
from app.schemas.finance import AccountCreate, CategoryCreate, TransactionCreate
from app.services.finance_svc import FinanceService as F


@pytest_asyncio.fixture
async def db(tmp_path):
    engine, factory = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'history.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.parametrize("historical", ["account", "category", "category_type", "transfer"])
async def test_metadata_edits_preserve_historical_financial_refs(db, historical):
    account = await F.create_account(db, 1, AccountCreate(name="Source", balance=100))
    category = await F.create_category(db, 1, CategoryCreate(name="Food"))
    target = await F.create_account(db, 1, AccountCreate(name="Destination", balance=50))
    payload = TransactionCreate(
        account_id=account.id, category_id=category.id, amount=10, note="Old"
    )
    if historical == "transfer":
        payload = TransactionCreate(
            account_id=account.id, to_account_id=target.id, type="transfer", amount=10
        )
    tx = await F.create_transaction(db, 1, payload)
    aid, tid, cid, target_id = account.id, tx.id, category.id, target.id
    if historical == "category":
        await F.delete_category(db, 1, cid)
    elif historical == "category_type":
        await F.update_category(db, 1, cid, {"type": "income"})
    else:
        await F.delete_account(db, 1, aid)
        if historical == "transfer":
            await F.delete_account(db, 1, target_id)
    before = {a.id: a.balance for a in await F.get_accounts(db, 1, include_archived=True)}
    date = datetime(2025, 3, 1, tzinfo=timezone.utc)
    edited = await F.update_transaction(db, 1, tid, {
        "revision": 1, "note": "Corrected", "created_at": date,
        # Clients may send unchanged financial fields alongside their metadata.
        "account_id": aid, "amount": "10.00", "type": payload.type,
        "category_id": payload.category_id, "to_account_id": payload.to_account_id,
    })
    assert edited.note == "Corrected" and edited.revision == 2
    assert edited.account_id == aid and edited.category_id == payload.category_id
    assert edited.to_account_id == payload.to_account_id
    assert edited.created_at.replace(tzinfo=timezone.utc) == date
    assert {a.id: a.balance for a in await F.get_accounts(db, 1, True)} == before
    with pytest.raises(ValueError):
        await F.update_transaction(db, 1, tid, {"revision": 2, "amount": 11})
    with pytest.raises(ValueError):
        await F.create_transaction(db, 1, payload.model_copy(update={"client_id": "new"}))
    assert {a.id: a.balance for a in await F.get_accounts(db, 1, True)} == before
    assert (await F.list_transactions(db, 1))[0].revision == 2


async def test_metadata_does_not_allow_foreign_or_archived_new_links(db):
    account = await F.create_account(db, 1, AccountCreate(name="Owned", balance=100))
    tx = await F.create_transaction(db, 1, TransactionCreate(account_id=account.id, amount=10))
    tid = tx.id
    foreign = await F.create_account(db, 2, AccountCreate(name="Foreign"))
    archived = await F.create_category(db, 1, CategoryCreate(name="Archived"))
    archived_id = archived.id
    await F.delete_category(db, 1, archived_id)
    for change in [{"account_id": foreign.id}, {"category_id": archived_id}]:
        with pytest.raises(ValueError):
            await F.update_transaction(db, 1, tid, {"revision": 1, "note": "Edit"} | change)
    assert (await F.list_transactions(db, 1))[0].revision == 1
    assert (await F.get_accounts(db, 1))[0].balance == 90
