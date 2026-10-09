from datetime import datetime, timezone

import pytest
import pytest_asyncio

from app.core.database import Base, create_engine_and_session
from app.schemas.finance import AccountCreate, CategoryCreate, TransactionCreate
from app.services.category_analytics import category_analytics
from app.services.finance_analytics import period_bounds
from app.services.finance_svc import FinanceService as F


@pytest_asyncio.fixture
async def db(tmp_path):
    engine, factory = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'category.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as session:
        yield session
    await engine.dispose()


async def test_complete_subtree_totals_are_independent_of_page_owner_currency_and_kind(db):
    account = await F.create_account(db, 1, AccountCreate(name="Owned"))
    other_currency = await F.create_account(db, 1, AccountCreate(name="USD", currency="USD"))
    foreign = await F.create_account(db, 2, AccountCreate(name="Foreign"))
    parent = await F.create_category(db, 1, CategoryCreate(name="Parent", type="both"))
    child = await F.create_category(db, 1, CategoryCreate(name="Child", parent_id=parent.id, type="both"))
    foreign_category = await F.create_category(db, 2, CategoryCreate(name="Foreign"))
    now = period_bounds(0)[0].replace(day=2)
    for index in range(60):
        await F.create_transaction(db, 1, TransactionCreate(account_id=account.id, category_id=parent.id,
                                                          amount="1.00", created_at=now, client_id=f"page-{index}"))
    await F.create_transaction(db, 1, TransactionCreate(account_id=account.id, category_id=child.id,
                                                      amount="2.50", created_at=now))
    await F.create_transaction(db, 1, TransactionCreate(account_id=account.id, category_id=child.id,
                                                      amount="100.00", type="income", created_at=now))
    await F.create_transaction(db, 1, TransactionCreate(account_id=other_currency.id, category_id=child.id,
                                                      amount="300.00", created_at=now))
    await F.create_transaction(db, 1, TransactionCreate(account_id=account.id, category_id=child.id,
                                                      amount="400.00", created_at=datetime(2020, 1, 1, tzinfo=timezone.utc)))
    await F.create_transaction(db, 2, TransactionCreate(account_id=foreign.id, category_id=foreign_category.id,
                                                      amount="500.00", created_at=now))
    deleted = await F.create_transaction(db, 1, TransactionCreate(account_id=account.id, category_id=child.id,
                                                                 amount="600.00", created_at=now))
    await F.delete_transaction(db, 1, deleted.id, deleted.revision)
    await F.delete_account(db, 1, account.id)
    result = await category_analytics(db, 1, parent.id, 0, "RUB", "expense")
    assert result.total_amount == 62.5 and result.transaction_count == 61
    assert len(result.transactions) == 50
    assert {s.id: s.total_amount for s in result.breakdown} == {parent.id: 60, child.id: 2.5}
    page = await category_analytics(db, 1, parent.id, 0, "RUB", "expense", offset=50)
    assert page.total_amount == result.total_amount and len(page.transactions) == 11
    assert not {tx.id for tx in result.transactions} & {tx.id for tx in page.transactions}
    assert (await category_analytics(db, 1, parent.id, 0, "RUB", "income")).total_amount == 100
    with pytest.raises(ValueError, match="Категория не найдена"):
        await category_analytics(db, 1, foreign_category.id, 0, "RUB", "expense")


async def test_uncategorized_and_empty_month(db):
    account = await F.create_account(db, 1, AccountCreate(name="Owned"))
    await F.create_transaction(db, 1, TransactionCreate(account_id=account.id, amount="250.50"))
    result = await category_analytics(db, 1, "uncategorized", 0, "RUB", "expense")
    assert result.total_amount == 250.5 and result.transaction_count == 1
    assert result.transactions[0].category_id is None
    empty = await category_analytics(db, 1, "uncategorized", -1, "RUB", "expense")
    assert empty.total_amount == 0 and empty.transactions == []


async def test_month_rollover_uses_one_resolved_period_for_totals_and_history(db, monkeypatch):
    from app.services import category_analytics as service
    from app.services import finance_analytics as history

    account = await F.create_account(db, 1, AccountCreate(name="Owned"))
    for month, amount in [(9, "10"), (10, "20")]:
        await F.create_transaction(db, 1, TransactionCreate(account_id=account.id, amount=amount,
            created_at=datetime(2026, month, 15, tzinfo=timezone.utc)))
    monkeypatch.setattr(service, "period_bounds", lambda offset: (
        datetime(2026, 9, 1, tzinfo=timezone.utc), datetime(2026, 10, 1, tzinfo=timezone.utc)))
    def changed_clock(offset):
        raise AssertionError("History must not resolve the clock for a second time")
    monkeypatch.setattr(history, "period_bounds", changed_clock)
    result = await service.category_analytics(db, 1, "uncategorized", 0, "RUB", "expense")
    assert result.period_label == "2026-09" and result.total_amount == 10
    assert [tx.amount for tx in result.transactions] == [10]
