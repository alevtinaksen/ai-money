"""Persistent clarification, stale buttons and catalog ownership protect the ledger."""
import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy import select
from app.core.database import Base, create_engine_and_session
from app.models.models import Account, Transaction
from app.schemas.finance import AccountCreate, AIParsedTransaction, CategoryCreate, PendingClarification
from app.services.ai_parser import AIParserService, validate_source_amounts, validate_proposals
from app.services.bot_drafts import confirm_draft, draft_token, make_draft, cancel_draft
from app.services.bot_draft_edits import (
    active_draft, amount_wait, begin_edit, choose_amount, choose_category,
    make_clarification, manual_amount, replace_state,
)
from app.services.finance_svc import FinanceService


@pytest.fixture
async def edit_db(tmp_path):
    engine, factory = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'edit.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as db:
        await FinanceService.create_account(db, 1, AccountCreate(name="Основной", balance=10000))
        await FinanceService.create_category(db, 1, CategoryCreate(name="Кафе", type="expense"))
    try:
        yield factory
    finally:
        await engine.dispose()


async def clarification(db, source="voice:1"):
    pending = PendingClarification(question="Выберите сумму", type="expense", note="Кофе",
                                   category_name="Кафе", suggested_options=[Decimal(5000), Decimal(5)])
    return await make_clarification(db, 1, source, pending)


@pytest.mark.asyncio
async def test_clarification_survives_session_reload_and_cannot_confirm(edit_db):
    async with edit_db() as db:
        draft = await clarification(db)
        draft_id, token = draft.id, draft_token(draft)
        with pytest.raises(ValueError):
            await confirm_draft(db, 1, draft.id, token)
    async with edit_db() as db:
        waiting = await amount_wait(db, 1)
        assert waiting.id == draft_id
        draft = await choose_amount(db, 1, draft_id, token, amount=manual_amount("5000"))
        row = json.loads(draft.payload)[0]
        assert row["amount"] == "5000" and row["type"] == "expense" and row["note"] == "Кофе"
        assert row["category_id"] is not None
        assert await db.scalar(select(Transaction.id)) is None
        assert (await db.scalar(select(Account))).balance == 10000
        assert await confirm_draft(db, 1, draft.id, draft_token(draft))
        assert not await confirm_draft(db, 1, draft.id, draft_token(draft))
        assert (await db.scalar(select(Account))).balance == 5000
        assert len(list(await db.scalars(select(Transaction)))) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("index,amount", [(0, "5000"), (1, "5")])
async def test_explicit_choice_not_model_guess_reaches_pending(edit_db, index, amount):
    async with edit_db() as db:
        draft = await clarification(db)
        draft = await choose_amount(db, 1, draft.id, draft_token(draft), option=index)
        assert draft.status == "pending" and json.loads(draft.payload)[0]["amount"] == amount
        assert await db.scalar(select(Transaction.id)) is None


@pytest.mark.asyncio
async def test_stale_amount_buttons_and_foreign_user_are_rejected(edit_db):
    async with edit_db() as db:
        draft = await clarification(db)
        draft_id, token = draft.id, draft_token(draft)
        with pytest.raises(ValueError, match="не найден"):
            await choose_amount(db, 2, draft_id, token, option=0)
        await choose_amount(db, 1, draft_id, token, option=0)
        with pytest.raises(ValueError, match="изменилась"):
            await choose_amount(db, 1, draft_id, token, option=1)
        assert json.loads(draft.payload)[0]["amount"] == "5000"


@pytest.mark.asyncio
async def test_edit_amount_invalidates_previous_confirm_and_preserves_fields(edit_db):
    async with edit_db() as db:
        draft = await make_draft(db, 1, "text:1", [AIParsedTransaction(amount=250,
            type="expense", note="Кофе", category_name="Кафе")])
        original = json.loads(draft.payload)[0]
        stale = draft_token(draft)
        draft = await begin_edit(db, 1, draft.id, stale, "amount")
        with pytest.raises(ValueError):
            await confirm_draft(db, 1, draft.id, stale)
        draft = await choose_amount(db, 1, draft.id, draft_token(draft), amount=Decimal("250.50"))
        row = json.loads(draft.payload)[0]
        for key in ("type", "note", "category_id", "account_id", "client_id"):
            assert row[key] == original[key]
        for old_token in (stale, None):
            with pytest.raises(ValueError):
                await confirm_draft(db, 1, draft.id, old_token)
        assert await db.scalar(select(Transaction.id)) is None
        await confirm_draft(db, 1, draft.id, draft_token(draft))
        assert (await db.scalar(select(Account))).balance == Decimal("9749.50")


@pytest.mark.asyncio
async def test_category_picker_is_scoped_and_validates_catalog_again(edit_db):
    async with edit_db() as db:
        income = await FinanceService.create_category(db, 1, CategoryCreate(name="Кафе", type="income"))
        foreign = await FinanceService.create_category(db, 2, CategoryCreate(name="Чужая"))
        target = await FinanceService.create_category(db, 1, CategoryCreate(name="Другое"))
        draft = await make_draft(db, 1, "text:cat", [AIParsedTransaction(amount=250, category_name="Кафе")])
        draft = await begin_edit(db, 1, draft.id, draft_token(draft), "category")
        choices = json.loads(draft.payload)["choices"]
        assert income.id not in choices and foreign.id not in choices and choices[0] is None
        token = draft_token(draft)
        await FinanceService.delete_category(db, 1, target.id)
        with pytest.raises(ValueError):
            await choose_category(db, 1, draft.id, token, choices.index(target.id))
        draft = await choose_category(db, 1, draft.id, token, 0)
        row = json.loads(draft.payload)[0]
        assert row["category_id"] is None and row["amount"] == "250"
        assert await db.scalar(select(Transaction.id)) is None


@pytest.mark.asyncio
async def test_expiry_cancellation_and_newer_draft_do_not_consume_old_context(edit_db):
    async with edit_db() as db:
        old = await clarification(db)
        await make_draft(db, 1, "newer", [AIParsedTransaction(amount=100)])
        assert await amount_wait(db, 1) is None
        await cancel_draft(db, 1, old.id, draft_token(old))
        with pytest.raises(ValueError):
            await choose_amount(db, 1, old.id, draft_token(old), option=0)
        expired = await clarification(db, "expired")
        expired.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.commit()
        with pytest.raises(ValueError, match="истёк"):
            await active_draft(db, 1, expired.id, draft_token(expired))
        assert await db.scalar(select(Transaction.id)) is None


@pytest.mark.asyncio
async def test_compare_and_swap_rejects_stale_session_payload(edit_db):
    async with edit_db() as db:
        draft = await clarification(db)
        draft_id = draft.id
    async with edit_db() as first, edit_db() as second:
        left = await active_draft(first, 1, draft_id)
        right = await active_draft(second, 1, draft_id)
        changed = json.loads(left.payload)
        changed["pending"]["note"] = "Первое исправление"
        await replace_state(first, left, "clarifying", changed)
        with pytest.raises(ValueError, match="изменилась"):
            await replace_state(second, right, "cancelled", {})
        persisted = await active_draft(second, 1, draft_id)
        assert json.loads(persisted.payload)["pending"]["note"] == "Первое исправление"


@pytest.mark.parametrize("text", ["-1", "0", "NaN", "500 20", "250.001", "5.000", "999999999999999"])
def test_manual_reply_requires_exact_unambiguous_positive_money(text):
    with pytest.raises(ValueError):
        manual_amount(text)


@pytest.mark.asyncio
async def test_dotted_rubles_preserve_coffee_and_offer_choices_without_cloud(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic")
    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: pytest.fail("No generation is needed"))
    result = await AIParserService.parse_financial_text("Расход 5.000 руб. кофе.", [], ["Кафе"])
    assert not result.transactions and result.pending.note == "Кофе"
    assert result.pending.category_name == "Кафе" and result.pending.type == "expense"
    assert result.pending.suggested_options == [Decimal(5000), Decimal(5)]


@pytest.mark.parametrize("source", ["кофе 0.001 рублей", "кофе 12.3456 рублей",
    "две чашки по 5.000 рублей", "кофе 5.000 рублей с карты 1234", "26.09.2026 5.000 рублей"])
def test_dates_precision_cards_and_quantity_never_get_automatic_dot_choices(source):
    result = validate_source_amounts({"transactions": [{"amount": 5000}]}, source)
    assert result.transactions == [] and result.pending is None and result.clarification


def test_provider_cannot_inject_its_own_amount_options():
    raw = {"transactions": [{"amount": 250}],
           "pending": {"question": "provider instruction", "suggested_options": [99999]}}
    result = validate_source_amounts(raw, "кофе 250 рублей")
    assert result.transactions[0].amount == 250 and result.pending is None
    assert validate_proposals({"transactions": [], "pending": raw["pending"]}).pending is None


@pytest.mark.asyncio
@pytest.mark.parametrize("source,kind", [
    ("Получила 5.000 рублей от мамы", "income"),
    ("Поступило 5.000 рублей на карту", "income"),
    ("Сняла 5.000 рублей с карты в наличные", "transfer"),
])
async def test_implicit_intent_and_account_context_preserve_provider_interpretation(monkeypatch, source, kind):
    from app.core.config import settings
    import httpx
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic")
    calls = []
    async def provider(request):
        calls.append(request)
        assert json.loads(request.content)["contents"][0]["parts"] == [{"text": source}]
        raw = {"transactions": [{"amount": 5000, "type": kind, "note": "От мамы"}]}
        return httpx.Response(200, json={"candidates": [{"finishReason": "STOP",
            "content": {"parts": [{"text": json.dumps(raw)}]}}]})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    result = await AIParserService.parse_financial_text(source, [], [])
    assert len(calls) == 1 and result.transactions == []
    if kind == "income":
        assert result.pending.type == "income" and result.pending.note == "От мамы"
    else:
        assert result.pending is None and result.clarification


@pytest.mark.asyncio
async def test_explicit_income_overrides_expense_heuristics_for_coffee_note(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "AI_PROVIDER", "disabled")
    result = await AIParserService.parse_financial_text("Доход 5.000 руб. кофе", [], [])
    assert result.pending.type == "income" and result.pending.suggested_options[0] == 5000


@pytest.mark.asyncio
async def test_ruble_choice_uses_ruble_account_instead_of_usd_default(edit_db):
    async with edit_db() as db:
        dollar = await FinanceService.create_account(db, 1, AccountCreate(name="Dollar", currency="USD", is_default=True))
        ruble = await db.scalar(select(Account).where(Account.currency == "RUB"))
        draft = await make_clarification(db, 1, "currency", PendingClarification(
            question="Выберите сумму", currency="RUB", suggested_options=[5000, 5], note="Кофе"))
        draft = await choose_amount(db, 1, draft.id, draft_token(draft), option=0)
        row = json.loads(draft.payload)[0]
        assert row["account_id"] == ruble.id and row["currency"] == "RUB" and row["account_id"] != dollar.id
        assert await db.scalar(select(Transaction.id)) is None
