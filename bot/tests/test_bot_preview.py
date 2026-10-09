import json
import logging
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import Base, create_engine_and_session
from app.core.config import settings
from app.bot.handlers import safe_flow
from app.services.finance_svc import FinanceService
from app.services.bot_drafts import BotDraft
from app.models.models import Transaction
from app.schemas.finance import AccountCreate, CategoryCreate, AIParsedResult, AIParsedTransaction


@pytest.mark.parametrize('value,shown', [('5000', '5 000,00 RUB'),
    ('250.50', '250,50 RUB'), ('999999999999.99', '999 999 999 999,99 RUB')])
def test_bot_money_display_uses_exact_decimal_and_russian_separators(value, shown):
    assert safe_flow.format_money(value, 'RUB') == shown


@pytest.mark.asyncio
async def test_pending_usd_preview_and_edit_never_commit(tmp_path, monkeypatch):
    engine, factory = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'preview.db'}")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with factory() as db:
            await FinanceService.create_account(db, 1, AccountCreate(name='Dollar', currency='USD', balance=100))
            await FinanceService.create_category(db, 1, CategoryCreate(name='Food'))
        monkeypatch.setattr(safe_flow, 'AsyncSessionLocal', factory)
        monkeypatch.setattr(safe_flow, 'consume_preview', lambda uid: None)
        monkeypatch.setattr(settings, 'WEBAPP_URL', 'http://localhost')
        monkeypatch.setattr(safe_flow.AIParserService, 'parse_financial_text', AsyncMock(return_value=AIParsedResult(
            transactions=[AIParsedTransaction(amount=10, account_name='Dollar', category_name='Food')]
        )))
        message = SimpleNamespace(from_user=SimpleNamespace(id=1), chat=SimpleNamespace(id=1),
            message_id=1, text='synthetic', answer=AsyncMock())
        await safe_flow.preview(message)
        card = message.answer.await_args_list[0].args[0]
        assert 'Черновик' in card and 'Сейчас они не записаны' in card
        assert len(message.answer.await_args_list) == 1
        assert 'USD' in card and 'Food' in card and '₽' not in card
        keyboard = message.answer.await_args_list[-1].kwargs['reply_markup']
        assert keyboard.inline_keyboard[0][0].text == 'Сохранить'
        async with factory() as db:
            assert await db.scalar(select(Transaction.id)) is None
            draft_id = (await db.scalar(select(BotDraft))).id
        callback = SimpleNamespace(data=f'edit:{draft_id}', from_user=SimpleNamespace(id=1), answer=AsyncMock(),
            message=SimpleNamespace(edit_text=AsyncMock(), answer=AsyncMock()))
        await safe_flow.decide(callback)
        async with factory() as db:
            assert await db.scalar(select(Transaction.id)) is None
            assert (await db.get(BotDraft, draft_id)).status == 'cancelled'
            assert json.loads((await db.get(BotDraft, draft_id)).payload)[0]['amount'] == '10'
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_failed_draft_logs_only_exception_class(tmp_path, monkeypatch, caplog):
    engine, factory = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'draft-race.db'}")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with factory() as db:
            await FinanceService.create_account(db, 1, AccountCreate(name="Synthetic", balance=100))
        monkeypatch.setattr(safe_flow, "AsyncSessionLocal", factory)
        monkeypatch.setattr(safe_flow, "consume_preview", lambda uid: None)
        private_key = "SYNTHETIC_PRIVATE_KEY_SENTINEL"
        private_note = "SYNTHETIC_PRIVATE_NOTE_SENTINEL"
        monkeypatch.setattr(settings, "GROQ_API_KEY", private_key)
        monkeypatch.setattr(safe_flow.AIParserService, "parse_financial_text", AsyncMock(return_value=AIParsedResult(
            transactions=[AIParsedTransaction(amount="1234.56", note=f"{private_note} {private_key}")]
        )))
        original_commit = AsyncSession.commit
        injected = False

        async def race_commit(db):
            nonlocal injected
            if any(isinstance(obj, BotDraft) for obj in db.new) and not injected:
                injected = True
                async with factory() as other:
                    other.add(BotDraft(user_id=1, source_id="1:7", payload="[]",
                        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30)))
                    await original_commit(other)
            return await original_commit(db)

        monkeypatch.setattr(AsyncSession, "commit", race_commit)
        message = SimpleNamespace(from_user=SimpleNamespace(id=1), chat=SimpleNamespace(id=1),
            message_id=7, text="synthetic", answer=AsyncMock())
        with caplog.at_level(logging.ERROR, logger=safe_flow.logger.name):
            await safe_flow.preview(message)
        assert injected  # The real SQL UNIQUE failure contains financial parameters.
        assert "Не удалось подготовить запись" in message.answer.await_args.args[0]
        assert private_note not in caplog.text
        assert private_key not in caplog.text
        assert "1234.56" not in caplog.text
        records = [record for record in caplog.records if record.name == safe_flow.logger.name]
        assert len(records) == 1
        assert records[0].getMessage() == "Draft preparation failed (IntegrityError)"
        assert records[0].exc_info is None
        async with factory() as db:
            assert await db.scalar(select(Transaction.id)) is None
        # SQLAlchemy may truncate a long payload in its exception representation.
        # An untruncated adapter failure separately proves note/key redaction.
        caplog.clear()
        monkeypatch.setattr(safe_flow.AIParserService, "parse_financial_text", AsyncMock(
            side_effect=RuntimeError(f"{private_note} {private_key} 1234.56")))
        with caplog.at_level(logging.ERROR, logger=safe_flow.logger.name):
            await safe_flow.preview(message)
        assert private_note not in caplog.text
        assert private_key not in caplog.text
        assert "1234.56" not in caplog.text
        records = [record for record in caplog.records if record.name == safe_flow.logger.name]
        assert len(records) == 1
        assert records[0].getMessage() == "Draft preparation failed (RuntimeError)"
        assert records[0].exc_info is None
    finally:
        await engine.dispose()
