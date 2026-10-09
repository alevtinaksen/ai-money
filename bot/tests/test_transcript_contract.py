"""Documented REST speech responses must reach guarded proposals without data leaks."""
import json

import httpx
import pytest
from sqlalchemy import select

from app.bot.handlers import safe_flow
from app.core.config import settings
from app.models.models import Transaction
from app.services.bot_drafts import BotDraft
from app.services.gemini_response import parse_response, parse_transcript_response
from test_bot_audio import audio_context as audio_context, audio_message, OGG


def speech(parts, finish="STOP"):
    return {"candidates": [{"finishReason": finish, "content": {"parts": parts}}]}


def annotations(text):
    return {"audioTranscription": {"speakerLabel": "spk_1", "words": [
        {"word": word, "startOffset": "0.100s", "endOffset": "0.450s"}
        for word in text.split()]}}


@pytest.mark.parametrize("text", [
    "расход пять тысяч рублей кофе",
    "расход двести пятьдесят рублей пятьдесят копеек кофе",
    "нет не пятьсот а пять тысяч рублей",
])
def test_documented_word_annotations_preserve_spoken_source(text):
    assert parse_transcript_response(speech([annotations(text)])) == text


def test_multiple_word_segments_preserve_order_and_ignore_thoughts():
    assert parse_transcript_response(speech([
        {"thought": True, "text": "private-provider-thought"},
        annotations("расход пять"), annotations("тысяч рублей кофе")
    ])) == "расход пять тысяч рублей кофе"


def test_empty_text_alongside_annotations_does_not_hide_valid_words():
    part = {**annotations("расход 250 рублей"), "text": ""}
    assert parse_transcript_response(speech([part])) == "расход 250 рублей"


@pytest.mark.parametrize("parts", [
    [{"audioTranscription": {}}],
    [{"audioTranscription": {"words": []}}],
    [{"audioTranscription": {"words": ["private-value"]}}],
    [{"audioTranscription": {"words": [{"word": 250}]}}],
    [{"audioTranscription": {"words": [{"word": " "}]}}],
    [annotations("расход 250 рублей"), {"text": "private-partial-transcript"}],
    [annotations("расход 250 рублей"), {"text": []}],
    [annotations("расход 250 рублей"), {}],
    [{"audioTranscription": {"words": [{"word": "x" * 10001}]}}],
])
def test_invalid_or_mixed_speech_fails_without_logging_response(parts, caplog):
    with pytest.raises(ValueError) as caught:
        parse_transcript_response(speech(parts))
    assert "private" not in caplog.text + str(caught.value)
    assert all(not record.exc_info for record in caplog.records)


@pytest.mark.parametrize("finish", ["MAX_TOKENS", "SAFETY", "UNKNOWN"])
def test_word_annotations_require_completed_candidate(finish):
    with pytest.raises(ValueError):
        parse_transcript_response(speech([annotations("расход 5000 рублей")], finish))


def test_financial_json_boundary_never_accepts_word_annotations():
    with pytest.raises(ValueError):
        parse_response(speech([annotations('{"transactions":[]}')]))


@pytest.mark.asyncio
@pytest.mark.parametrize("transcript,amount,accepted", [
    ("расход пять тысяч рублей кофе", "5000", True),
    ("расход двести пятьдесят рублей пятьдесят копеек кофе", "250.50", True),
    ("расход пять тысяч рублей кофе", "50", False),
])
async def test_router_word_annotations_to_guarded_pending_draft(
        audio_context, monkeypatch, transcript, amount, accepted):
    bot, factory = audio_context
    monkeypatch.setattr(settings, "AI_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "synthetic")
    monkeypatch.setattr(settings, "GEMINI_AUDIO_MODE", "transcribe")
    calls = []

    async def download(file, destination, **kwargs):
        destination.write(OGG)

    async def provider(request):
        calls.append(request)
        if "gemini-3.5-transcribe" in request.url.path:
            return httpx.Response(200, json=speech([annotations(transcript)]))
        assert json.loads(request.content)["contents"][0]["parts"] == [{"text": transcript}]
        result = {"transactions": [{"amount": amount, "type": "expense"}]}
        return httpx.Response(200, json=speech([{"text": json.dumps(result)}]))

    original = httpx.AsyncClient
    monkeypatch.setattr(bot, "download", download)
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(
        **kw, transport=httpx.MockTransport(provider)))
    await safe_flow.router.propagate_event("message", audio_message(bot), bot=bot)
    assert len(calls) == 2
    async with factory() as db:
        draft = await db.scalar(select(BotDraft))
        if accepted:
            assert draft.status == "pending"
            assert json.loads(draft.payload)[0]["amount"] == amount
        else:
            assert draft is None
        assert await db.scalar(select(Transaction.id)) is None
