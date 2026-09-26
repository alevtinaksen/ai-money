"""Balances never exceed the exact-cent financial domain."""

from decimal import Decimal
import pytest
from test_finance import db_session as db_session
from app.schemas.finance import AccountCreate, TransactionCreate
from app.services.finance_svc import FinanceService as F

MAX = Decimal("999999999999.99")


@pytest.mark.asyncio
@pytest.mark.parametrize("balance,kind", [(MAX, "income"), (-MAX, "expense")])
async def test_balance_overflow_rejects_whole_operation(db_session, balance, kind):
    account = await F.create_account(db_session, 1, AccountCreate(name="Bound", balance=balance))
    aid = account.id
    with pytest.raises(ValueError):
        await F.create_transaction(
            db_session, 1, TransactionCreate(account_id=aid, amount="0.01", type=kind)
        )
    assert (await F.get_accounts(db_session, 1))[0].balance == balance
    assert await F.list_transactions(db_session, 1) == []


@pytest.mark.asyncio
async def test_transfer_destination_overflow_restores_both_accounts(db_session):
    source = await F.create_account(db_session, 1, AccountCreate(name="Source", balance=100))
    target = await F.create_account(db_session, 1, AccountCreate(name="Target", balance=MAX))
    sid, tid = source.id, target.id
    with pytest.raises(ValueError):
        await F.create_transaction(
            db_session,
            1,
            TransactionCreate(account_id=sid, to_account_id=tid, amount="0.01", type="transfer"),
        )
    balances = {a.id: a.balance for a in await F.get_accounts(db_session, 1)}
    assert balances == {sid: Decimal("100"), tid: MAX}
    assert await F.list_transactions(db_session, 1) == []


@pytest.mark.asyncio
async def test_edit_uses_net_delta_without_temporary_overflow(db_session):
    account = await F.create_account(db_session, 1, AccountCreate(name="Bound", balance=MAX))
    aid = account.id
    expense = await F.create_transaction(
        db_session, 1, TransactionCreate(account_id=aid, amount="1.00")
    )
    tid = expense.id
    await F.create_transaction(
        db_session, 1, TransactionCreate(account_id=aid, amount="1.00", type="income")
    )
    edited = await F.update_transaction(
        db_session, 1, tid, {"revision": 1, "note": "Same financial effect"}
    )
    assert edited.revision == 2
    assert (await F.get_accounts(db_session, 1))[0].balance == MAX
    with pytest.raises(ValueError):
        await F.update_transaction(db_session, 1, tid, {"revision": 2, "amount": "0.99"})
    assert (await F.get_accounts(db_session, 1))[0].balance == MAX
    record = next(t for t in await F.list_transactions(db_session, 1) if t.id == tid)
    assert record.revision == 2 and record.amount == 1
