"""Gemini response boundary: diagnostic codes never include user/provider text."""
import json
import logging

import httpx

from app.services.ai_limits import cloud_slot
from app.services.runtime_timing import timed_operation

logger = logging.getLogger(__name__)
ERROR_MESSAGE = "Распознавание недоступно или ответ некорректен. Ничего не записано; повторите позже."
FINISH_REASONS = {"STOP", "MAX_TOKENS", "SAFETY", "RECITATION", "LANGUAGE", "OTHER",
                  "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "MALFORMED_FUNCTION_CALL",
                  "IMAGE_SAFETY", "UNEXPECTED_TOOL_CALL", "TOO_MANY_TOOL_CALLS"}
BLOCK_REASONS = {"SAFETY", "OTHER", "BLOCKLIST", "PROHIBITED_CONTENT", "IMAGE_SAFETY"}


def _enum(value, allowed):
    return value if isinstance(value, str) and value in allowed else "UNKNOWN"


def _fail(stage, reason, *, status=0, finish="UNKNOWN", block="UNKNOWN"):
    # No exception rendering, URLs, response bodies, transcripts or free-form reasons.
    logger.warning("gemini_failure stage=%s reason=%s status=%d finish=%s block=%s",
                   stage, reason, status, finish, block)
    raise ValueError(ERROR_MESSAGE) from None


def parse_response(body):
    if not isinstance(body, dict):
        _fail("envelope", "invalid_shape")
    feedback = body.get("promptFeedback")
    block = _enum(feedback.get("blockReason"), BLOCK_REASONS) if isinstance(feedback, dict) else "UNKNOWN"
    candidates = body.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        _fail("candidate", "missing", block=block)
    candidate = candidates[0]
    if not isinstance(candidate, dict):
        _fail("candidate", "invalid_shape", block=block)
    finish = _enum(candidate.get("finishReason"), FINISH_REASONS)
    # Even valid JSON can be a partial package when generation hit its limit.
    if finish != "STOP":
        _fail("candidate", "unfinished", finish=finish, block=block)
    content = candidate.get("content")
    parts = content.get("parts") if isinstance(content, dict) else None
    if not isinstance(parts, list) or any(not isinstance(part, dict) for part in parts):
        _fail("content", "invalid_shape", finish=finish)
    texts = [part.get("text") for part in parts if not part.get("thought") and "text" in part]
    if not texts or any(not isinstance(text, str) for text in texts):
        _fail("content", "missing_text", finish=finish)
    try:
        raw = json.loads("".join(texts))
    except (json.JSONDecodeError, ValueError):
        _fail("proposal", "invalid_json", finish=finish)
    if not isinstance(raw, dict):
        _fail("proposal", "invalid_shape", finish=finish)
    return raw


@timed_operation("gemini")
async def generate_json(url: str, payload: dict, api_key: str) -> dict:
    try:
        async with cloud_slot(), httpx.AsyncClient(timeout=httpx.Timeout(45, connect=10)) as client:
            response = await client.post(url, json=payload, headers={"x-goog-api-key": api_key})
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        _fail("http", "status", status=exc.response.status_code)
    except (httpx.TimeoutException, TimeoutError):
        _fail("http", "timeout")
    except httpx.HTTPError:
        _fail("http", "transport")
    try:
        body = response.json()
    except (json.JSONDecodeError, ValueError):
        _fail("envelope", "invalid_json")
    return parse_response(body)
