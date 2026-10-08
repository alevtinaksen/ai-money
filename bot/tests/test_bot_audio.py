"""Real Telegram router -> provider wire -> durable draft, with synthetic bytes."""
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
import httpx
import pytest
from aiogram import Bot
from aiogram.types import Message
from sqlalchemy import select
from app.bot.handlers import safe_flow
from app.core.config import settings
from app.core.database import Base, create_engine_and_session
from app.models.models import Account, Transaction
from app.schemas.finance import AccountCreate, CategoryCreate
from app.services.bot_drafts import BotDraft
from app.services.finance_svc import FinanceService

OGG = b"OggS" + bytes(23) + b"OpusHead" + bytes(32)
MP3 = b"ID3" + bytes(40)
WAV = b"RIFF" + bytes(4) + b"WAVE" + bytes(40)
M4A = bytes(4) + b"ftypM4A " + bytes(40)


@pytest.fixture
async def audio_context(tmp_path, monkeypatch):
    engine, factory = create_engine_and_session(f"sqlite+aiosqlite:///{tmp_path / 'audio.db'}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with factory() as db:
        await FinanceService.create_account(db, 1, AccountCreate(name="Основной", balance=1000))
        await FinanceService.create_category(db, 1, CategoryCreate(name="Кафе"))
    monkeypatch.setattr(safe_flow, "AsyncSessionLocal", factory)
    monkeypatch.setattr(safe_flow, "consume_preview", lambda uid: None)
    monkeypatch.setattr(settings, "AI_PROVIDER", "groq")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "synthetic")
    bot = Bot("123456:synthetic", session=AsyncMock())
    try:
        yield bot, factory
    finally:
        await engine.dispose()


def audio_message(bot, kind="voice", mime="audio/ogg", filename="voice.ogg", size=len(OGG)):
    file = {"file_id": "synthetic", "file_unique_id": "synthetic", "file_size": size,
            "mime_type": mime, "duration": 1, "file_name": filename}
    return Message.model_validate({"message_id": 7, "date": 1,
        "from": {"id": 1, "is_bot": False, "first_name": "Synthetic"},
        "chat": {"id": 1, "type": "private"}, kind: file}).as_(bot)


@pytest.mark.asyncio
@pytest.mark.parametrize("kind,mime,filename,data,wire_name", [
    ("voice", "audio/ogg", "voice.ogg", OGG, "audio.ogg"),
    ("audio", "audio/mpeg", "clip.mp3", MP3, "audio.mp3"),
    ("audio", "audio/mp4", "clip.m4a", M4A, "audio.m4a"),
    ("audio", "audio/wav", "clip.wav", WAV, "audio.wav"),
    ("document", "application/octet-stream", "clip.mp3", MP3, "audio.mp3"),
    ("document", "audio/x-m4a", "clip.m4a", M4A, "audio.m4a"),
])
async def test_audio_router_cloud_draft_and_confirm_once(audio_context, monkeypatch,
        kind, mime, filename, data, wire_name):
    bot, factory = audio_context
    requests = []

    async def download(file, destination, **kwargs):
        assert kwargs["timeout"] == 30
        destination.write(data)

    async def provider(request):
        requests.append(request)
        if request.url.path.endswith("/audio/transcriptions"):
            assert wire_name.encode() in request.content
            assert data in request.content
            return httpx.Response(200, json={"text": "расход 250 рублей кофе"})
        assert "расход 250 рублей кофе" in json.loads(request.content)["messages"][1]["content"]
        result = {"transactions": [{"amount": 250, "type": "expense", "note": "Кофе",
            "account_name": "Основной", "category_name": "Кафе"}]}
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(result)}}]})

    monkeypatch.setattr(bot, "download", download)
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    message = audio_message(bot, kind, mime, filename, len(data))
    await safe_flow.router.propagate_event("message", message, bot=bot)
    assert len(requests) == 2  # STT and financial proposals, each owns one slot.
    texts = [call.args[1].text for call in bot.session.await_args_list]
    assert any("250,00" in text and "Черновик" in text for text in texts)
    async with factory() as db:
        assert await db.scalar(select(Transaction.id)) is None
        assert (await db.scalar(select(Account))).balance == 1000

        draft = await db.scalar(select(BotDraft))
        assert draft.status == "pending"
        draft_id = draft.id
    callback = SimpleNamespace(data=f"confirm:{draft_id}", from_user=SimpleNamespace(id=1),
        answer=AsyncMock(), message=SimpleNamespace(edit_text=AsyncMock(), answer=AsyncMock()))
    await safe_flow.decide(callback)
    await safe_flow.decide(callback)
    async with factory() as db:
        assert len(list(await db.scalars(select(Transaction)))) == 1
        assert (await db.scalar(select(Account))).balance == 750


@pytest.mark.asyncio
@pytest.mark.parametrize("transcript,wrong_amount", [
    ("расход 250 рублей 50 копеек кофе", "25.50"),
    ("расход 5000 рублей кофе", "50"),
    ("расход 5000 рублей кофе", "0"),
    ("расход 5000 рублей кофе", "55"),
    ("расход пять тысяч рублей кофе", "50"),
    ("расход полтора миллиона рублей", "1000000"),
    ("расход один миллиард рублей", "1"),
    ("расход две сотни рублей", "2"),
    ("покупка с карты №1234", "1234"),
    ("покупка с карты ****1234", "1234"),
])
async def test_correct_transcript_wrong_model_amount_never_becomes_draft(audio_context, monkeypatch, transcript, wrong_amount):
    bot, factory = audio_context

    async def download(file, destination, **kwargs):
        destination.write(OGG)

    async def provider(request):
        if request.url.path.endswith("/audio/transcriptions"):
            return httpx.Response(200, json={"text": transcript})
        wrong = {"transactions": [{"amount": wrong_amount, "type": "expense", "note": "Кофе"}]}
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(wrong)}}]})

    monkeypatch.setattr(bot, "download", download)
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    await safe_flow.router.propagate_event("message", audio_message(bot), bot=bot)
    texts = [call.args[1].text for call in bot.session.await_args_list]
    assert any("Уточните" in text or "не совпадает" in text for text in texts)
    assert all("Черновик" not in text for text in texts)
    assert any(transcript in text for text in texts)
    async with factory() as db:
        assert await db.scalar(select(BotDraft.id)) is None
        assert await db.scalar(select(Transaction.id)) is None
        assert (await db.scalar(select(Account))).balance == 1000


@pytest.mark.asyncio
@pytest.mark.parametrize('transcript,amount,shown', [
    ('расход пять тысяч рублей кофе', '5000', '5 000,00 RUB'),
    ('расход 250 рублей 50 копеек кофе', '250.50', '250,50 RUB'),
])
async def test_audio_amount_is_exact_in_draft_and_russian_message(audio_context, monkeypatch, transcript, amount, shown):
    bot, factory = audio_context
    async def download(file, destination, **kwargs):
        destination.write(OGG)
    async def provider(request):
        if request.url.path.endswith('/audio/transcriptions'):
            return httpx.Response(200, json={'text': transcript})
        content = json.dumps({'transactions': [{'amount': amount}]})
        return httpx.Response(200, json={'choices': [{'message': {'content': content}}]})
    monkeypatch.setattr(bot, 'download', download)
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, 'AsyncClient', lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    await safe_flow.router.propagate_event('message', audio_message(bot), bot=bot)
    assert any(shown in call.args[1].text for call in bot.session.await_args_list)
    async with factory() as db:
        draft = await db.scalar(select(BotDraft))
        assert json.loads(draft.payload)[0]['amount'] == amount
        assert await db.scalar(select(Transaction.id)) is None
        assert (await db.scalar(select(Account))).balance == 1000


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["empty", "invalid", "mismatch", "oversized", "network", "provider", "json", "unsupported"])
async def test_audio_errors_reply_and_never_write(audio_context, monkeypatch, failure):
    bot, factory = audio_context
    monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", 100)
    uploaded = []

    async def download(file, destination, **kwargs):
        if failure == "network":
            raise TimeoutError("synthetic")
        data = {"empty": b"", "invalid": b"not audio", "mismatch": WAV,
                "oversized": bytes(101)}.get(failure, OGG)
        destination.write(data)

    async def provider(request):
        uploaded.append(request)
        return httpx.Response(200, text="not JSON") if failure == "json" else httpx.Response(429)

    monkeypatch.setattr(bot, "download", download)
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    message = audio_message(bot, kind="document" if failure == "unsupported" else "voice",
        mime="application/pdf" if failure == "unsupported" else "audio/ogg", size=10)
    await safe_flow.router.propagate_event("message", message, bot=bot)
    assert bot.session.await_count >= 1
    assert all("Черновик" not in call.args[1].text for call in bot.session.await_args_list)
    assert len(uploaded) == (1 if failure in {"provider", "json"} else 0)
    async with factory() as db:
        assert await db.scalar(select(Transaction.id)) is None
        assert await db.scalar(select(BotDraft.id)) is None
        assert (await db.scalar(select(Account))).balance == 1000
