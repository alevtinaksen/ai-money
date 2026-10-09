"""Opening balances survive response loss and independent-session retries exactly once."""
import asyncio
from decimal import Decimal
import pytest
import pytest_asyncio
from app.core.database import Base, create_engine_and_session
from app.domain.errors import ConflictError
from app.schemas.finance import AccountCreate, CategoryCreate
from app.services.finance_svc import FinanceService as F


@pytest_asyncio.fixture
async def factory(tmp_path):
    engine, sessions = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'retry.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield sessions
    await engine.dispose()


@pytest.mark.asyncio
async def test_account_lost_response_retry_and_archive_preserve_one_opening_balance(factory):
    payload = AccountCreate(name="Synthetic", balance="1000.00", client_id="lost-response")
    async with factory() as db:
        first = await F.create_account(db, 1, payload)
    async with factory() as db:
        retry = await F.create_account(db, 1, payload)
        assert retry.id == first.id
        assert len(await F.get_accounts(db, 1)) == 1
        assert (await F.get_dashboard_summary(db, 1)).total_balance == 1000
        await F.delete_account(db, 1, first.id)
    async with factory() as db:
        replay = await F.create_account(db, 1, payload)
        assert replay.id == first.id and replay.is_archived
        assert await F.get_accounts(db, 1) == []
        assert (await F.get_dashboard_summary(db, 1)).total_balance == 1000


@pytest.mark.asyncio
async def test_account_parallel_retry_owner_scope_and_intentional_equal_accounts(factory):
    payload = AccountCreate(name="Synthetic", balance=1000, client_id="same-attempt")
    async def save():
        async with factory() as db:
            return (await F.create_account(db, 1, payload)).id
    ids = await asyncio.gather(save(), save(), save())
    assert len(set(ids)) == 1
    async with factory() as db:
        foreign = await F.create_account(db, 2, payload)
        distinct = await F.create_account(db, 1, payload.model_copy(update={"client_id": "new-attempt"}))
        assert foreign.id != ids[0] and distinct.id != ids[0]
        assert (await F.get_dashboard_summary(db, 1)).total_balance == 2000
        assert (await F.get_dashboard_summary(db, 2)).total_balance == 1000


@pytest.mark.asyncio
async def test_creation_key_rejects_changed_payload_and_normalizes_decimal(factory):
    async with factory() as db:
        original = await F.create_account(db, 1, AccountCreate(name="Synthetic", balance="10", client_id="key"))
        same = await F.create_account(db, 1, AccountCreate(name="Synthetic", balance=Decimal("10.00"), client_id="key"))
        assert original.id == same.id
        with pytest.raises(ConflictError):
            await F.create_account(db, 1, AccountCreate(name="Changed", balance="20", client_id="key"))
        assert (await F.get_dashboard_summary(db, 1)).total_balance == 10


@pytest.mark.asyncio
async def test_category_retry_survives_archive_and_changed_parent_conflicts(factory):
    async with factory() as db:
        parent = await F.create_category(db, 1, CategoryCreate(name="Parent"))
        payload = CategoryCreate(name="Child", parent_id=parent.id, client_id="category-key")
        original = await F.create_category(db, 1, payload)
        same = await F.create_category(db, 1, payload)
        assert same.id == original.id
        await F.delete_category(db, 1, original.id)
        replay = await F.create_category(db, 1, payload)
        assert replay.id == original.id and replay.is_archived
        with pytest.raises(ConflictError):
            await F.create_category(db, 1, payload.model_copy(update={"parent_id": None}))
