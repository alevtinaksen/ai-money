import os

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["BOT_TOKEN"] = ""
os.environ["OPENAI_API_KEY"] = ""
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select, func
from app.core.database import Base
from app.models.models import Transaction
from app.services.finance_svc import FinanceService as F
from app.schemas.finance import TransactionCreate
from decimal import Decimal
from datetime import datetime, timezone
from app.schemas.finance import AccountCreate, CategoryCreate
from app.domain.errors import ConflictError
from app.models.models import Account


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as c:
        await c.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_reads_do_not_seed(db_session):
    assert await F.get_accounts(db_session, 1) == []
    assert await F.get_categories(db_session, 1) == []


@pytest.mark.asyncio
async def test_onboarding_empty_and_no_resurrection(db_session):
    await F.ensure_user_seeded(db_session, 1)
    accounts = await F.get_accounts(db_session, 1)
    assert len(accounts) == 1 and accounts[0].balance == 0
    assert await db_session.scalar(select(func.count()).select_from(Transaction)) == 0
    await F.delete_account(db_session, 1, accounts[0].id)
    await F.ensure_user_seeded(db_session, 1)
    assert await F.get_accounts(db_session, 1) == []


@pytest.mark.asyncio
async def test_unknown_update_never_creates(db_session):
    assert (
        await F.update_transaction(db_session, 1, "missing", {"amount": 1, "revision": 1}) is None
    )


@pytest.mark.parametrize("amount", [0, -1, "NaN", "Infinity", "1.001", "1000000000000"])
def test_invalid_money(amount):
    with pytest.raises(ValueError):
        TransactionCreate(account_id="a", amount=amount)


async def account(db, user=1, currency="RUB"):
    return await F.create_account(
        db, user, AccountCreate(name="Test", currency=currency, balance=100)
    )


@pytest.mark.asyncio
async def test_ownership_and_invalid_transfer_unchanged(db_session):
    a = await account(db_session)
    b = await account(db_session, 2)
    foreign = await F.create_category(db_session, 2, CategoryCreate(name="Other"))
    c = await account(db_session, currency="USD")
    bid, cid = b.id, foreign.id
    for changes in [
        {"account_id": b.id},
        {"category_id": foreign.id},
        {"type": "transfer", "to_account_id": b.id},
        {"type": "transfer", "to_account_id": c.id},
        {"type": "transfer", "to_account_id": a.id},
    ]:
        with pytest.raises(ValueError):
            await F.create_transaction(
                db_session, 1, TransactionCreate(**({"account_id": a.id, "amount": 5} | changes))
            )
        await db_session.refresh(a)
        assert a.balance == 100
    tx = await F.create_transaction(db_session, 1, TransactionCreate(account_id=a.id, amount=5))
    for changes in [{"account_id": bid}, {"category_id": cid}]:
        with pytest.raises(ValueError):
            await F.update_transaction(db_session, 1, tx.id, {"revision": 1} | changes)
        await db_session.refresh(a)
        await db_session.refresh(tx)
        assert a.balance == 95 and tx.revision == 1


@pytest.mark.asyncio
async def test_edit_delete_revision_identity_and_replay(db_session):
    a = await account(db_session)
    aid = a.id
    payload = TransactionCreate(account_id=aid, amount="0.29", client_id="stable")
    tx = await F.create_transaction(db_session, 1, payload)
    tid = tx.id
    assert (await F.create_transaction(db_session, 1, payload)).id == tid
    with pytest.raises(ConflictError):
        await F.create_transaction(
            db_session, 1, payload.model_copy(update={"amount": Decimal("1.00")})
        )
    await F.update_transaction(db_session, 1, tid, {"revision": 1, "amount": "0.31"})
    with pytest.raises(ConflictError):
        await F.delete_transaction(db_session, 1, tid, 1)
    await F.delete_transaction(db_session, 1, tid, 2)
    with pytest.raises(ConflictError):
        await F.create_transaction(db_session, 1, payload)
    assert (await F.get_accounts(db_session, 1))[0].balance == 100
    assert await F.list_transactions(db_session, 1) == []


@pytest.mark.asyncio
async def test_period_full_totals_currency_and_archive(db_session):
    a = await account(db_session)
    b = await account(db_session, currency="USD")
    for _ in range(25):
        await F.create_transaction(db_session, 1, TransactionCreate(account_id=a.id, amount=1))
    await F.create_transaction(
        db_session,
        1,
        TransactionCreate(
            account_id=a.id, amount=99, created_at=datetime(2020, 1, 1, tzinfo=timezone.utc)
        ),
    )
    await F.create_transaction(db_session, 1, TransactionCreate(account_id=b.id, amount=3))
    await F.delete_account(db_session, 1, a.id)
    summary = await F.get_dashboard_summary(db_session, 1)
    assert summary.period_expense == 25
    assert summary.totals_by_currency["USD"]["expense"] == 3
    assert len(summary.recent_transactions) == 20
    assert summary.balances_by_currency == {"RUB": -24, "USD": 97}
    assert len(await F.list_transactions(db_session, 1, limit=100)) == 27


@pytest.mark.asyncio
async def test_independent_session_deltas_and_revision(tmp_path):
    import asyncio

    engine = create_async_engine("sqlite+aiosqlite:///" + str(tmp_path / "race.db"))
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as db:
        aid = (await account(db)).id

    async def create(key):
        async with factory() as db:
            return await F.create_transaction(
                db, 1, TransactionCreate(account_id=aid, amount="0.01", client_id=key)
            )

    await asyncio.gather(*(create(str(i)) for i in range(12)))
    async with factory() as db:
        assert (await F.get_accounts(db, 1))[0].balance == Decimal("99.88")
        tx = (await F.list_transactions(db, 1))[0]

    async def edit(amount):
        async with factory() as db:
            try:
                await F.update_transaction(db, 1, tx.id, {"revision": 1, "amount": amount})
                return "ok"
            except ConflictError:
                return "conflict"

    assert sorted(await asyncio.gather(edit("0.02"), edit("0.03"))) == ["conflict", "ok"]
    await engine.dispose()


@pytest.mark.asyncio
async def test_batch_rollback(db_session):
    aid = (await account(db_session)).id
    # Force a real outer write transaction before savepoints (SQLite legacy mode).
    from sqlalchemy import update

    await db_session.execute(update(Account).where(Account.id == aid).values(name="Batch"))
    await F.create_transaction(
        db_session, 1, TransactionCreate(account_id=aid, amount=10), commit=False
    )
    await db_session.rollback()
    assert (await F.get_accounts(db_session, 1))[0].balance == 100
    assert await F.list_transactions(db_session, 1) == []


@pytest.mark.asyncio
async def test_exact_max_cent_roundtrip_and_deltas(db_session):
    a = await F.create_account(db_session, 1, AccountCreate(name="Max", balance="999999999999.99"))
    aid = a.id
    tx = await F.create_transaction(
        db_session, 1, TransactionCreate(account_id=aid, amount="999999999999.99")
    )
    assert tx.amount == Decimal("999999999999.99")
    assert (await F.get_accounts(db_session, 1))[0].balance == 0
    for _ in range(101):
        await F.create_transaction(
            db_session, 1, TransactionCreate(account_id=aid, amount="0.01", type="income")
        )
    assert (await F.get_accounts(db_session, 1))[0].balance == Decimal("1.01")


@pytest.mark.asyncio
async def test_transfer_edit_and_delete_conserve_currency(db_session):
    a, b = await account(db_session), await account(db_session)
    aid, bid = a.id, b.id
    tx = await F.create_transaction(
        db_session,
        1,
        TransactionCreate(account_id=aid, to_account_id=bid, type="transfer", amount=10),
    )
    tid = tx.id
    await F.update_transaction(db_session, 1, tid, {"revision": 1, "amount": 25})
    balances = {a.id: a.balance for a in await F.get_accounts(db_session, 1)}
    assert balances == {aid: 75, bid: 125}
    await F.delete_transaction(db_session, 1, tid, 2)
    assert [a.balance for a in await F.get_accounts(db_session, 1)] == [100, 100]


@pytest.mark.asyncio
async def test_concurrent_idempotency_same_and_changed_payload(tmp_path):
    import asyncio

    engine = create_async_engine("sqlite+aiosqlite:///" + str(tmp_path / "idem.db"))
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as db:
        aid = (await account(db)).id

    async def create(amount):
        async with factory() as db:
            try:
                return (
                    await F.create_transaction(
                        db, 1, TransactionCreate(account_id=aid, amount=amount, client_id="once")
                    )
                ).id
            except ConflictError:
                return "conflict"

    first, second = await asyncio.gather(create(1), create(1))
    assert first == second
    assert await create(2) == "conflict"
    async with factory() as db:
        assert (await F.get_accounts(db, 1))[0].balance == 99
    await engine.dispose()


@pytest.mark.asyncio
async def test_category_parent_and_metadata_tenant_ownership(db_session):
    a = await account(db_session, 2)
    c = await F.create_category(db_session, 2, CategoryCreate(name="Private"))
    assert await F.update_account(db_session, 1, a.id, {"name": "Stolen"}) is None
    assert await F.update_category(db_session, 1, c.id, {"name": "Stolen"}) is None
    with pytest.raises(ValueError):
        await F.create_category(db_session, 1, CategoryCreate(name="Child", parent_id=c.id))
    parent = await F.create_category(db_session, 1, CategoryCreate(name="Parent", type="both"))
    child = await F.create_category(
        db_session, 1, CategoryCreate(name="Child", parent_id=parent.id)
    )
    with pytest.raises(ValueError):
        await F.update_category(db_session, 1, parent.id, {"parent_id": child.id})
    assert await F.delete_category(db_session, 1, child.id)
    assert await F.delete_category(db_session, 1, parent.id)
    assert await F.get_categories(db_session, 1) == []
