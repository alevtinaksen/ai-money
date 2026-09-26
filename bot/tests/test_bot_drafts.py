import json
import pytest
import pytest_asyncio
from decimal import Decimal
from sqlalchemy import select
from app.core.database import Base, create_engine_and_session
from app.services.finance_svc import FinanceService
from app.services.bot_drafts import BotDraft, make_draft, confirm_draft
from app.schemas.finance import AIParsedTransaction, AccountCreate
from app.models.models import Transaction


@pytest_asyncio.fixture
async def session(tmp_path):
    engine, factory = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'draft.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as db:
        yield db
    await engine.dispose()


@pytest.mark.asyncio
async def test_confirmation_once_and_foreign_user_rejected(session):
    await FinanceService.create_account(session, 1, AccountCreate(name="Test", balance=100))
    draft = await make_draft(session, 1, "message:1", [AIParsedTransaction(amount="10.25")])
    draft_id = draft.id
    assert await session.scalar(select(Transaction.id)) is None
    with pytest.raises(ValueError, match="не найден"):
        await confirm_draft(session, 2, draft_id)
    assert await confirm_draft(session, 1, draft_id)
    assert not await confirm_draft(session, 1, draft_id)
    accounts = await FinanceService.get_accounts(session, 1)
    assert accounts[0].balance == Decimal("89.75")


@pytest.mark.asyncio
async def test_batch_failure_rolls_back_every_operation(session):
    await FinanceService.create_account(session, 1, AccountCreate(name="Test", balance=100))
    draft = await make_draft(session, 1, "message:2",
        [AIParsedTransaction(amount=10), AIParsedTransaction(amount=20)])
    draft_id = draft.id
    payload = json.loads(draft.payload)
    payload[1]["account_id"] = "nonexistent"
    draft.payload = json.dumps(payload)
    await session.commit()
    with pytest.raises(ValueError):
        await confirm_draft(session, 1, draft_id)
    assert await session.scalar(select(Transaction.id)) is None
    assert (await FinanceService.get_accounts(session, 1))[0].balance == 100
    assert (await session.get(BotDraft, draft_id)).status == "pending"


@pytest.mark.asyncio
async def test_expired_draft_never_applies(session):
    from datetime import datetime, timedelta, timezone
    await FinanceService.create_account(session, 1, AccountCreate(name="Test", balance=100))
    draft = await make_draft(session, 1, "message:3", [AIParsedTransaction(amount=10)])
    draft.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    draft_id = draft.id
    await session.commit()
    with pytest.raises(ValueError):
        await confirm_draft(session, 1, draft_id)
    assert await session.scalar(select(Transaction.id)) is None
