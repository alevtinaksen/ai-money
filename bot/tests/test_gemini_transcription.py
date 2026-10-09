"""Separate STT -> guarded proposals -> bot draft; no real cloud/data/credentials."""
import asyncio
import base64
import json
import logging
from types import SimpleNamespace

import httpx
import pytest
from sqlalchemy import select

from app.bot.handlers import safe_flow
from app.core.config import settings
from app.models.models import Account, Transaction
from app.services.ai_parser import AIParserService
from app.services import ai_parser
from app.services.bot_drafts import BotDraft
from app.services.gemini_transcription import transcribe_gemini
from test_bot_audio import audio_context as audio_context, audio_message, OGG, MP3, WAV, M4A


@pytest.fixture
def gemini_mode(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "gemini-3.5-flash-lite")
    monkeypatch.setattr(settings, "GEMINI_AUDIO_MODE", "transcribe")


def envelope(text, finish="STOP"):
    return {"candidates": [{"finishReason": finish, "content": {"parts": [{"text": text}]}}]}


@pytest.mark.asyncio
@pytest.mark.parametrize("data,mime,wire_mime", [
    (OGG, "audio/ogg", "audio/ogg"),
    (MP3, "audio/mpeg", "audio/mpeg"),
    (WAV, "audio/wav", "audio/wav"),
    (M4A, "audio/mp4", "audio/m4a"),
    (b"\x1a\x45\xdf\xa3" + bytes(100), "audio/webm;codecs=opus", "audio/webm"),
])
async def test_transcription_wire_preserves_audio_and_verbatim_numbers(gemini_mode, monkeypatch, data, mime, wire_mime):
    calls = []
    async def provider(request):
        calls.append(request)
        assert request.url.path == "/v1beta/models/gemini-3.5-transcribe:generateContent"
        assert request.headers["x-goog-api-key"] == "synthetic"
        payload = json.loads(request.content)
        assert "systemInstruction" not in payload
        assert payload["generationConfig"] == {"audioTranscriptionConfig": {
            "languageCodes": ["ru-RU"], "mode": "VERBATIM"}}
        inline = payload["contents"][0]["parts"][0]["inlineData"]
        assert inline["mimeType"] == wire_mime
        assert base64.b64decode(inline["data"]) == data
        return httpx.Response(200, json=envelope("расход пять тысяч рублей кофе"))
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    assert await transcribe_gemini(data, mime) == "расход пять тысяч рублей кофе"
    assert len(calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("transcript,amount,accepted", [
    ("расход пять тысяч рублей кофе", "5000", True),
    ("расход двести пятьдесят рублей пятьдесят копеек кофе", "250.50", True),
    ("расход 5000 рублей кофе", "50", False),
    ("расход 5000 рублей кофе", "0", False),
    ("расход 5000 рублей кофе", "55", False),
])
async def test_transcribed_money_router_draft_guards(audio_context, gemini_mode, monkeypatch, caplog,
                                                   transcript, amount, accepted):
    bot, factory = audio_context
    calls = []
    caplog.set_level(logging.INFO, logger="uvicorn.error")
    async def download(file, destination, **kw):
        destination.write(OGG)
    async def provider(request):
        calls.append(request)
        if "gemini-3.5-transcribe" in request.url.path:
            return httpx.Response(200, json=envelope(transcript))
        assert request.url.path == "/v1beta/models/gemini-3.5-flash-lite:generateContent"
        payload = json.loads(request.content)
        assert payload["contents"][0]["parts"] == [{"text": transcript}]
        assert "Основной" in payload["systemInstruction"]["parts"][0]["text"]
        raw = {"transactions": [{"amount": amount, "type": "expense", "note": "Кофе"}]}
        return httpx.Response(200, json=envelope(json.dumps(raw)))
    original = httpx.AsyncClient
    monkeypatch.setattr(bot, "download", download)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    await safe_flow.router.propagate_event("message", audio_message(bot), bot=bot)
    assert len(calls) == 2
    async with factory() as db:
        draft = await db.scalar(select(BotDraft))
        if accepted:
            assert json.loads(draft.payload)[0]["amount"] == amount
            assert draft.status == "pending"
        else:
            assert draft is None
        assert await db.scalar(select(Transaction.id)) is None
        assert (await db.scalar(select(Account))).balance == 1000
    assert "stage=gemini_transcribe" in caplog.text
    assert "stage=gemini" in caplog.text
    assert transcript not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize("failure", ["unfinished", "quota", "timeout", "empty", "oversize"])
async def test_failed_stt_never_calls_financial_model_or_logs_private_data(gemini_mode, monkeypatch, caplog, failure):
    calls = []
    private = "synthetic-private-provider-transcript-key"
    async def provider(request):
        calls.append(request)
        if failure == "timeout":
            raise httpx.ReadTimeout(private, request=request)
        if failure == "quota":
            return httpx.Response(429, text=private)
        text = " " if failure == "empty" else private
        if failure == "oversize":
            text *= 1000
        return httpx.Response(200, json=envelope(text, "MAX_TOKENS" if failure == "unfinished" else "STOP"))
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    with pytest.raises(ValueError) as caught:
        await AIParserService.parse_media(OGG, "audio/ogg", [], [])
    assert len(calls) == 1
    assert private not in str(caught.value) + caplog.text


@pytest.mark.asyncio
async def test_stt_obeys_consent_and_validates_before_network(gemini_mode, monkeypatch):
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: pytest.fail("Network should not be reached"))
    with pytest.raises(ValueError, match="повреждён"):
        await transcribe_gemini(b"bad audio", "audio/ogg")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", False)
    with pytest.raises(ValueError, match="согласия"):
        await transcribe_gemini(OGG, "audio/ogg")


@pytest.mark.asyncio
async def test_two_stage_requests_share_cloud_limit_without_nested_slot(gemini_mode, monkeypatch):
    active = peak = 0
    calls = 0
    async def provider(request):
        nonlocal active, peak, calls
        active += 1
        calls += 1
        peak = max(peak, active)
        await asyncio.sleep(0.02)
        active -= 1
        if "gemini-3.5-transcribe" in request.url.path:
            return httpx.Response(200, json=envelope("расход 250 рублей кофе"))
        return httpx.Response(200, json=envelope(json.dumps({"transactions": [{"amount": "250"}]})))
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    results = await asyncio.wait_for(asyncio.gather(*(
        AIParserService.parse_media(OGG, "audio/ogg", [], []) for _ in range(6))), timeout=1)
    assert peak == 4 and calls == 12
    assert all(result.transactions[0].amount == 250 for result in results)


@pytest.mark.asyncio
async def test_receipt_does_not_use_transcription(gemini_mode, monkeypatch):
    async def provider(request):
        assert "transcribe" not in request.url.path
        payload = json.loads(request.content)
        assert payload["contents"][0]["parts"][1]["inline_data"]["mime_type"] == "image/jpeg"
        return httpx.Response(200, json=envelope(json.dumps({"transactions": [{"amount": "250"}]})))
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    result = await AIParserService.parse_media(b"synthetic-receipt", "image/jpeg", [], [])
    assert result.transactions[0].amount == 250


@pytest.mark.asyncio
async def test_two_stages_have_one_overall_deadline(gemini_mode, monkeypatch):
    calls = []
    # Accelerate only the flow's deadline, leaving real shared cloud slots intact.
    def deadline(seconds):
        assert seconds == 45
        return asyncio.timeout(0.03)
    monkeypatch.setattr(ai_parser, "asyncio", SimpleNamespace(timeout=deadline))
    async def provider(request):
        calls.append(request)
        await asyncio.sleep(0.02)
        if "gemini-3.5-transcribe" in request.url.path:
            return httpx.Response(200, json=envelope("расход 250 рублей кофе"))
        return httpx.Response(200, json=envelope(json.dumps({"transactions": [{"amount": "250"}]})))
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    with pytest.raises(ValueError, match="Ничего не записано"):
        await AIParserService.parse_media(OGG, "audio/ogg", [], [])
    assert len(calls) == 2  # Deadline cancels financial generation after STT.
