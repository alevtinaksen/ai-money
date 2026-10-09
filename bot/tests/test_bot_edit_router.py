"""Real Telegram router tests: voice -> choice -> category -> amount -> confirm."""
import json
from decimal import Decimal
from unittest.mock import AsyncMock
import httpx
import pytest
from aiogram.types import CallbackQuery, Message
from sqlalchemy import select
from app.bot.handlers import safe_flow
from app.core.config import settings
from app.models.models import Account, Transaction
from app.schemas.finance import CategoryCreate
from app.services.bot_drafts import BotDraft
from app.services.finance_svc import FinanceService
from test_bot_audio import audio_context as audio_context, audio_message, OGG


def text_message(bot, text, message_id=9, user_id=1):
    return Message.model_validate({"message_id": message_id, "date": 1,
        "from": {"id": user_id, "is_bot": False, "first_name": "Synthetic"},
        "chat": {"id": user_id, "type": "private"}, "text": text}).as_(bot)


def callback(bot, data, user_id=1, query_id="synthetic-query"):
    query = CallbackQuery.model_validate({"id": query_id, "chat_instance": "synthetic",
        "from": {"id": user_id, "is_bot": False, "first_name": "Synthetic"}, "data": data,
        "message": {"message_id": 8, "date": 1, "from": {"id": 123456, "is_bot": True,
        "first_name": "SyntheticBot"}, "chat": {"id": user_id, "type": "private"},
        "text": "Synthetic preview"}}).as_(bot)
    query.message.as_(bot)
    return query


def ui_calls(bot):
    return [call.args[1] for call in bot.session.await_args_list
            if isinstance(getattr(call.args[1], "text", None), str)]


def current_button(bot, text):
    for method in reversed(ui_calls(bot)):
        if method.reply_markup:
            for row in method.reply_markup.inline_keyboard:
                for item in row:
                    if text in item.text:
                        return item.callback_data
    raise AssertionError(f"Button {text} missing")


async def click(bot, data, user_id=1):
    await safe_flow.router.propagate_event("callback_query", callback(bot, data, user_id), bot=bot)


async def dotted_voice(bot, monkeypatch, *, failure=False):
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic")
    monkeypatch.setattr(settings, "GEMINI_AUDIO_MODE", "transcribe")
    requests = []
    async def download(file, destination, **kwargs):
        destination.write(OGG)
    async def provider(request):
        requests.append(request)
        assert "gemini-3.5-transcribe" in request.url.path
        if failure:
            return httpx.Response(429, text="synthetic-private-provider-key")
        return httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {
            "parts": [{"audioTranscription": {"text": "Расход 5.000 руб. кофе."}}]}}]})
    original = httpx.AsyncClient
    monkeypatch.setattr(bot, "download", download)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    await safe_flow.router.propagate_event("message", audio_message(bot), bot=bot)
    return requests


@pytest.mark.asyncio
async def test_voice_choice_category_amount_and_confirmation_use_one_cloud_call(audio_context, monkeypatch, caplog):
    bot, factory = audio_context
    async with factory() as db:
        target = await FinanceService.create_category(db, 1, CategoryCreate(name="Покупки"))
        await FinanceService.create_category(db, 2, CategoryCreate(name="Foreign private category"))
        category_id = target.id
    requests = await dotted_voice(bot, monkeypatch)
    assert len(requests) == 1
    assert "5 000,00 ₽" in [btn.text for row in ui_calls(bot)[-1].reply_markup.inline_keyboard for btn in row]
    async with factory() as db:
        assert (await db.scalar(select(BotDraft))).status == "clarifying"
        assert await db.scalar(select(Transaction.id)) is None
    await click(bot, current_button(bot, "5 000,00"))
    await click(bot, current_button(bot, "Выбрать категорию"))
    assert "Foreign private category" not in str(ui_calls(bot)[-1].reply_markup)
    await click(bot, current_button(bot, "Покупки"))
    stale_confirm = current_button(bot, "Сохранить")
    await click(bot, current_button(bot, "Изменить сумму"))
    await safe_flow.router.propagate_event("message", text_message(bot, "250,50"), bot=bot)
    assert "250,50 RUB" in ui_calls(bot)[-1].text
    assert "Кофе" in ui_calls(bot)[-1].text and "Покупки" in ui_calls(bot)[-1].text
    await click(bot, stale_confirm)
    async with factory() as db:
        row = json.loads((await db.scalar(select(BotDraft))).payload)[0]
        assert row["category_id"] == category_id and row["type"] == "expense" and row["note"] == "Кофе"
        assert await db.scalar(select(Transaction.id)) is None
        assert (await db.scalar(select(Account))).balance == 1000
    confirm = current_button(bot, "Сохранить")
    await click(bot, confirm)
    await click(bot, confirm)
    async with factory() as db:
        transactions = list(await db.scalars(select(Transaction)))
        assert len(transactions) == 1 and transactions[0].amount == Decimal("250.50")
        assert transactions[0].category_id == category_id
        assert (await db.scalar(select(Account))).balance == Decimal("749.50")
    assert len(requests) == 1
    assert "Расход 5.000" not in caplog.text


@pytest.mark.asyncio
async def test_numeric_reply_5000_continues_voice_instead_of_requesting_operation_type(audio_context, monkeypatch):
    bot, factory = audio_context
    requests = await dotted_voice(bot, monkeypatch)
    await safe_flow.router.propagate_event("message", text_message(bot, "5000"), bot=bot)
    assert "5 000,00 RUB" in ui_calls(bot)[-1].text and "Кофе" in ui_calls(bot)[-1].text
    assert "💸 Расход" in ui_calls(bot)[-1].text and len(requests) == 1
    async with factory() as db:
        assert (await db.scalar(select(BotDraft))).status == "pending"
        assert await db.scalar(select(Transaction.id)) is None


@pytest.mark.asyncio
async def test_failed_speech_has_manual_income_path_without_repeating_cloud(audio_context, monkeypatch, caplog):
    bot, factory = audio_context
    requests = await dotted_voice(bot, monkeypatch, failure=True)
    async with factory() as db:
        assert await db.scalar(select(BotDraft.id)) is None
    await click(bot, current_button(bot, "Ввести доход"))
    await safe_flow.router.propagate_event("message", text_message(bot, "250,50"), bot=bot)
    assert "💰 Доход" in ui_calls(bot)[-1].text and "250,50 RUB" in ui_calls(bot)[-1].text
    async with factory() as db:
        draft = await db.scalar(select(BotDraft))
        assert draft.status == "pending" and json.loads(draft.payload)[0]["type"] == "income"
        assert await db.scalar(select(Transaction.id)) is None
    assert len(requests) == 1 and "synthetic-private-provider-key" not in caplog.text


@pytest.mark.asyncio
async def test_foreign_buttons_and_cancelled_context_never_write(audio_context, monkeypatch):
    bot, factory = audio_context
    await dotted_voice(bot, monkeypatch)
    amount = current_button(bot, "5 000,00")
    await click(bot, amount, user_id=2)
    assert any("не найден" in method.text for method in ui_calls(bot))
    await click(bot, current_button(bot, "Отменить"))
    await click(bot, amount)
    async with factory() as db:
        assert (await db.scalar(select(BotDraft))).status == "cancelled"
        assert await db.scalar(select(Transaction.id)) is None
        assert (await db.scalar(select(Account))).balance == 1000


@pytest.mark.asyncio
async def test_category_pagination_callbacks_fit_telegram_limit(audio_context, monkeypatch):
    bot, factory = audio_context
    async with factory() as db:
        for index in range(12):
            await FinanceService.create_category(db, 1, CategoryCreate(name=f"Категория {index}"))
    await dotted_voice(bot, monkeypatch)
    await click(bot, current_button(bot, "5 000,00"))
    await click(bot, current_button(bot, "Выбрать категорию"))
    assert "1/2" in ui_calls(bot)[-1].text
    for method in ui_calls(bot):
        if method.reply_markup:
            assert all(len(item.callback_data.encode()) <= 64
                       for row in method.reply_markup.inline_keyboard for item in row)
    await click(bot, current_button(bot, "→"))
    assert "2/2" in ui_calls(bot)[-1].text


@pytest.mark.asyncio
async def test_telegram_edit_failure_recovers_persisted_amount_prompt(audio_context, monkeypatch):
    bot, factory = audio_context
    await dotted_voice(bot, monkeypatch)
    await click(bot, current_button(bot, "5 000,00"))
    amount_button = current_button(bot, "Изменить сумму")
    failed = False
    async def send(bot_instance, method, **kwargs):
        nonlocal failed
        if type(method).__name__ == "EditMessageText" and not failed:
            failed = True
            raise RuntimeError("synthetic-network-failure")
    bot.session = AsyncMock(side_effect=send)
    await click(bot, amount_button)
    assert failed and any("Пришлите новую сумму" in method.text for method in ui_calls(bot))
    await safe_flow.router.propagate_event("message", text_message(bot, "251"), bot=bot)
    async with factory() as db:
        draft = await db.scalar(select(BotDraft))
        assert draft.status == "pending" and json.loads(draft.payload)[0]["amount"] == "251"
        assert await db.scalar(select(Transaction.id)) is None


@pytest.mark.asyncio
async def test_opening_older_amount_editor_makes_it_current_for_numeric_reply(audio_context, monkeypatch):
    bot, factory = audio_context
    await dotted_voice(bot, monkeypatch)
    await click(bot, current_button(bot, "5 000,00"))
    old_edit = current_button(bot, "Изменить сумму")
    async with factory() as db:
        from app.schemas.finance import AIParsedTransaction
        from app.services.bot_drafts import make_draft
        old = await db.scalar(select(BotDraft))
        old_id = old.id
        newer = await make_draft(db, 1, "other", [AIParsedTransaction(amount=100, note="Другое")])
        newer_id = newer.id
    await click(bot, old_edit)
    await safe_flow.router.propagate_event("message", text_message(bot, "250"), bot=bot)
    async with factory() as db:
        old, newer = await db.get(BotDraft, old_id), await db.get(BotDraft, newer_id)
        assert json.loads(old.payload)[0]["amount"] == "250"
        assert json.loads(newer.payload)[0]["amount"] == "100"
        assert await db.scalar(select(Transaction.id)) is None


@pytest.mark.asyncio
async def test_numeric_delivery_failure_restores_context_and_retry_does_not_duplicate(audio_context, monkeypatch):
    bot, factory = audio_context
    requests = await dotted_voice(bot, monkeypatch)
    failed = False
    async def send(bot_instance, method, **kwargs):
        nonlocal failed
        if type(method).__name__ == "SendMessage" and "Черновик" in method.text and not failed:
            failed = True
            raise RuntimeError("synthetic-network-failure")
    bot.session.side_effect = send
    await safe_flow.router.propagate_event("message", text_message(bot, "5000"), bot=bot)
    assert failed and any("Пришлите новую сумму" in method.text for method in ui_calls(bot))
    async with factory() as db:
        draft = await db.scalar(select(BotDraft))
        assert draft.status == "editing_amount" and json.loads(draft.payload)["rows"][0]["note"] == "Кофе"
    await safe_flow.router.propagate_event("message", text_message(bot, "5000", message_id=10), bot=bot)
    async with factory() as db:
        drafts = list(await db.scalars(select(BotDraft)))
        assert len(drafts) == 1 and drafts[0].status == "pending"
        assert json.loads(drafts[0].payload)[0]["note"] == "Кофе"
        assert await db.scalar(select(Transaction.id)) is None
    assert len(requests) == 1


@pytest.mark.asyncio
async def test_same_manual_fallback_button_can_start_new_interaction_after_cancel(audio_context, monkeypatch):
    bot, factory = audio_context
    await dotted_voice(bot, monkeypatch, failure=True)
    manual = current_button(bot, "Ввести доход")
    await click(bot, manual)
    await click(bot, current_button(bot, "Отменить"))
    await safe_flow.router.propagate_event("callback_query", callback(bot, manual, query_id="second-click"), bot=bot)
    async with factory() as db:
        drafts = list(await db.scalars(select(BotDraft)))
        assert len(drafts) == 2 and sorted(draft.status for draft in drafts) == ["cancelled", "clarifying"]
    await safe_flow.router.propagate_event("message", text_message(bot, "250"), bot=bot)
    assert "💰 Доход" in ui_calls(bot)[-1].text
    async with factory() as db:
        assert await db.scalar(select(Transaction.id)) is None


@pytest.mark.asyncio
async def test_custom_amount_on_older_clarification_activates_its_context(audio_context, monkeypatch):
    bot, factory = audio_context
    await dotted_voice(bot, monkeypatch)
    custom = current_button(bot, "Указать другую сумму")
    async with factory() as db:
        from app.schemas.finance import AIParsedTransaction
        from app.services.bot_drafts import make_draft
        old_id = (await db.scalar(select(BotDraft))).id
        newer = await make_draft(db, 1, "newer", [AIParsedTransaction(amount=100, note="Другое")])
        newer_id = newer.id
    await click(bot, custom)
    assert "Пришлите только сумму" in ui_calls(bot)[-1].text
    await safe_flow.router.propagate_event("message", text_message(bot, "250"), bot=bot)
    async with factory() as db:
        assert json.loads((await db.get(BotDraft, old_id)).payload)[0]["note"] == "Кофе"
        assert json.loads((await db.get(BotDraft, newer_id)).payload)[0]["note"] == "Другое"


@pytest.mark.asyncio
async def test_received_money_remains_income_after_amount_choice_and_confirm(audio_context, monkeypatch):
    bot, factory = audio_context
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic")
    calls = []
    async def provider(request):
        calls.append(request)
        raw = {"transactions": [{"amount": 5000, "type": "income", "note": "От мамы"}]}
        return httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {
            "parts": [{"text": json.dumps(raw)}]}}]})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    await safe_flow.router.propagate_event("message", text_message(bot, "Получила 5.000 рублей от мамы"), bot=bot)
    assert "💰 Доход" in ui_calls(bot)[-1].text
    await click(bot, current_button(bot, "5 000,00"))
    await click(bot, current_button(bot, "Сохранить"))
    async with factory() as db:
        transaction = await db.scalar(select(Transaction))
        assert transaction.type == "income" and transaction.amount == 5000
        assert (await db.scalar(select(Account))).balance == 6000
    assert len(calls) == 1
