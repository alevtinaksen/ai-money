"""Provider wire contract without contacting cloud services."""
import asyncio
import json
import httpx
import pytest
from app.core.config import settings
from app.services.ai_provider import transcribe_groq, provider_for
from app.services.ai_parser import AIParserService
from app.services import ai_limits


@pytest.mark.asyncio
@pytest.mark.parametrize("model,level,expected", [
    ("gemini-3.8-flash", "low", {"thinkingLevel": "LOW"}),
    ("gemini-3.8-flash", "default", None),
    ("gemini-2.5-flash", "low", None),
    ("gemini-3.1-flash-lite-image", "low", None),
])
async def test_low_thinking_is_limited_to_verified_model(monkeypatch, model, level, expected):
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", True)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic")
    monkeypatch.setattr(settings, "GEMINI_MODEL", model)
    monkeypatch.setattr(settings, "GEMINI_THINKING_LEVEL", level)
    async def provider(request):
        config = json.loads(request.content)["generationConfig"]
        assert config.get("thinkingConfig") == expected
        raw = json.dumps({"transactions": [{"amount": "250.50"}]})
        return httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": raw}]}}]})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    result = await AIParserService.parse_financial_text("расход 250 рублей 50 копеек кофе", [], [])
    assert str(result.transactions[0].amount) == "250.50"


@pytest.mark.asyncio
async def test_groq_audio_wire_and_no_fallback(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "groq")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "synthetic")
    seen = []
    async def handler(request):
        seen.append(request)
        assert request.url == "https://api.groq.com/openai/v1/audio/transcriptions"
        assert request.headers["Authorization"] == "Bearer synthetic"
        body = request.content
        assert b"whisper-large-v3-turbo" in body and b"audio.webm" in body
        return httpx.Response(200, json={"text": "кофе 10"})
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    assert await transcribe_groq(b"\x1a\x45\xdf\xa3" + bytes(100), "audio/webm") == "кофе 10"
    assert len(seen) == 1
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic")
    with pytest.raises(ValueError, match="не настроен"):
        provider_for("audio")
    assert len(seen) == 1


@pytest.mark.asyncio
async def test_six_parallel_transcriptions_share_four_cloud_slots(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "groq")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "synthetic")
    active = peak = 0

    async def handler(request):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.03)
        active -= 1
        return httpx.Response(200, json={"text": "расход 250 рублей кофе"})

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    results = await asyncio.gather(*(transcribe_groq(b"OggS" + bytes(100)) for _ in range(6)))
    assert results == ["расход 250 рублей кофе"] * 6
    assert peak == 4


@pytest.mark.asyncio
async def test_generation_and_transcription_share_slots_without_nested_lock(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "auto")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "synthetic")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic")
    active = peak = 0
    proposal = json.dumps({"transactions": [{"amount": 250, "type": "expense"}]})

    async def handler(request):
        nonlocal active, peak
        active += 1
        peak = max(peak, active)
        await asyncio.sleep(0.03)
        active -= 1
        if request.url.path.endswith("/audio/transcriptions"):
            return httpx.Response(200, json={"text": "расход 250 рублей кофе"})
        if request.url.host == "api.groq.com":
            return httpx.Response(200, json={"choices": [{"message": {"content": proposal}}]})
        return httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": proposal}]}}]})

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    calls = [AIParserService.parse_media(b"OggS" + bytes(100), "audio/ogg", [], []) for _ in range(3)]
    calls += [AIParserService._generate([{"text": "кофе 250"}], [], []) for _ in range(3)]
    results = await asyncio.wait_for(asyncio.gather(*calls), timeout=1)
    assert all(result.transactions[0].amount == 250 for result in results)
    assert peak == 4


@pytest.mark.asyncio
async def test_cloud_queue_timeout_and_cancellation_release_slots(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "groq")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "synthetic")
    monkeypatch.setattr(ai_limits, "CLOUD_WAIT_SECONDS", 0.02)
    started = asyncio.Event()
    release = asyncio.Event()
    count = 0

    async def handler(request):
        nonlocal count
        count += 1
        if count == 4:
            started.set()
        await release.wait()
        return httpx.Response(200, json={"text": "кофе 250"})

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    tasks = [asyncio.create_task(transcribe_groq(b"OggS" + bytes(100))) for _ in range(4)]
    await asyncio.wait_for(started.wait(), timeout=1)
    try:
        with pytest.raises(ValueError, match="занято"):
            await transcribe_groq(b"OggS" + bytes(100))
        assert count == 4
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
    release.set()
    assert await asyncio.gather(*(transcribe_groq(b"OggS" + bytes(100)) for _ in range(4))) == ["кофе 250"] * 4


@pytest.mark.asyncio
async def test_total_provider_timeout_releases_slot(monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "groq")
    monkeypatch.setattr(settings, "AI_UPLOAD_CONSENT", True)
    monkeypatch.setattr(settings, "GROQ_API_KEY", "synthetic")
    monkeypatch.setattr(ai_limits, "CLOUD_REQUEST_SECONDS", 0.02)
    release = asyncio.Event()

    async def handler(request):
        await release.wait()
        return httpx.Response(200, json={"text": "кофе 250"})

    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(handler)))
    with pytest.raises(ValueError, match="недоступно"):
        await transcribe_groq(b"OggS" + bytes(100))
    release.set()
    assert await transcribe_groq(b"OggS" + bytes(100)) == "кофе 250"
