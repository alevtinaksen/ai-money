"""Provider diagnostics distinguish failures without exposing response/input data."""
import json

import httpx
import pytest

from app.services.gemini_response import generate_json, parse_response

PRIVATE = "synthetic-private-transcript-key-250.50"


@pytest.mark.parametrize("body,code", [
    ([], "stage=envelope reason=invalid_shape"),
    ({"candidates": [], "promptFeedback": {"blockReason": "SAFETY", "blockReasonMessage": PRIVATE}}, "block=SAFETY"),
    ({"candidates": [{}]}, "stage=candidate reason=unfinished"),
    ({"candidates": [{"finishReason": PRIVATE}]}, "finish=UNKNOWN"),
    ({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": PRIVATE}]}}]}, "stage=proposal reason=invalid_json"),
    ({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": []}]}}]}, "stage=content reason=missing_text"),
    ({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "[]"}]}}]}, "stage=proposal reason=invalid_shape"),
])
def test_malformed_envelopes_have_private_safe_codes(body, code, caplog):
    with pytest.raises(ValueError) as caught:
        parse_response(body)
    assert code in caplog.text
    assert PRIVATE not in caplog.text + str(caught.value)
    assert all(not record.exc_info for record in caplog.records)


@pytest.mark.asyncio
@pytest.mark.parametrize("failure,code", [
    ("quota", "stage=http reason=status status=429"),
    ("timeout", "stage=http reason=timeout"),
    ("transport", "stage=http reason=transport"),
    ("envelope", "stage=envelope reason=invalid_json"),
])
async def test_http_failures_never_log_provider_bodies_or_exception_text(monkeypatch, caplog, failure, code):
    async def provider(request):
        if failure == "timeout":
            raise httpx.ReadTimeout(PRIVATE, request=request)
        if failure == "transport":
            raise httpx.ConnectError(PRIVATE, request=request)
        return httpx.Response(429 if failure == "quota" else 200, text=PRIVATE)
    original = httpx.AsyncClient
    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: original(**kw, transport=httpx.MockTransport(provider)))
    with pytest.raises(ValueError) as caught:
        await generate_json("https://example.test/generate", {"text": PRIVATE}, PRIVATE)
    assert code in caplog.text
    assert PRIVATE not in caplog.text + str(caught.value)
    assert all(not record.exc_info for record in caplog.records)


def test_completed_json_ignores_thought_parts():
    raw = {"transactions": [{"amount": "250.50"}]}
    body = {"candidates": [{"finishReason": "STOP", "content": {"parts": [
        {"thought": True, "text": PRIVATE}, {"text": json.dumps(raw)}]}}]}
    assert parse_response(body) == raw
