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


def segment_text(text):
    return {"audioTranscription": {"text": text}}


@pytest.mark.parametrize("text", [
    "расход пять тысяч рублей кофе",
    "расход двести пятьдесят рублей пятьдесят копеек кофе",
    "нет не пятьсот а пять тысяч рублей",
])
def test_required_audio_transcription_text_without_optional_words(text):
    assert parse_transcript_response(speech([segment_text(text)])) == text


def test_segment_text_is_authoritative_with_optional_word_timestamps():
    part = annotations("Расход пять тысяч рублей кофе")
    part["audioTranscription"]["text"] = "Расход пять тысяч рублей, кофе."
    assert parse_transcript_response(speech([part])) == "Расход пять тысяч рублей, кофе."


def test_segment_text_preserves_order_across_parts():
    assert parse_transcript_response(speech([
        segment_text("расход пять"), segment_text("тысяч рублей кофе")
    ])) == "расход пять тысяч рублей кофе"


@pytest.mark.parametrize("text", [None, [], 5000, "", " ", "x" * 10001],
                         ids=["null", "list", "number", "empty", "blank", "oversize"])
def test_invalid_required_segment_text_never_falls_back_to_words(text, caplog):
    part = annotations("private-spoken-source")
    part["audioTranscription"]["text"] = text
    with pytest.raises(ValueError):
        parse_transcript_response(speech([part]))
    assert "private-spoken-source" not in caplog.text


def test_segment_text_limit_applies_to_complete_transcript():
    with pytest.raises(ValueError):
        parse_transcript_response(speech([
            segment_text("x" * 5000), segment_text("y" * 5000)
        ]))


def test_segment_text_never_merges_separate_plain_text_source():
    with pytest.raises(ValueError):
        parse_transcript_response(speech([
            segment_text("расход 5000 рублей"), {"text": "расход 50 рублей"}
        ]))


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
@pytest.mark.parametrize("make_part", [annotations, segment_text])
def test_word_annotations_require_completed_candidate(finish, make_part):
    with pytest.raises(ValueError):
        parse_transcript_response(speech([make_part("расход 5000 рублей")], finish))


@pytest.mark.parametrize("make_part", [annotations, segment_text])
def test_financial_json_boundary_never_accepts_word_annotations(make_part):
    with pytest.raises(ValueError):
        parse_response(speech([make_part('{"transactions":[]}')]))


@pytest.mark.asyncio
@pytest.mark.parametrize("make_part", [annotations, segment_text])
@pytest.mark.parametrize("transcript,amount,accepted", [
    ("расход пять тысяч рублей кофе", "5000", True),
    ("расход двести пятьдесят рублей пятьдесят копеек кофе", "250.50", True),
    ("расход пять тысяч рублей кофе", "50", False),
])
async def test_router_word_annotations_to_guarded_pending_draft(
        audio_context, monkeypatch, transcript, amount, accepted, make_part):
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
            return httpx.Response(200, json=speech([make_part(transcript)]))
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
            assert draft is not None and draft.status == "clarifying"
            from app.services.bot_drafts import confirm_draft
            with pytest.raises(ValueError):
                await confirm_draft(db, 1, draft.id)
        assert await db.scalar(select(Transaction.id)) is None
