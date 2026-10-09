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


def _completed_parts(body):
    """Share envelope/STOP validation across JSON and speech response formats."""
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
    return parts


def _plain_text(parts):
    texts = [part.get("text") for part in parts if not part.get("thought") and "text" in part]
    if not texts or any(not isinstance(text, str) for text in texts):
        _fail("content", "missing_text", finish="STOP")
    text = "".join(texts)
    if not text.strip():
        _fail("content", "missing_text", finish="STOP")
    return text


def parse_text_response(body):
    """Accept only complete, non-thought text; JSON validation is separate."""
    return _plain_text(_completed_parts(body))


def _segment_transcript(annotation):
    if not isinstance(annotation, dict):
        _fail("content", "invalid_transcript", finish="STOP")
    # REST AudioTranscription.text is the segment transcript. Optional words
    # carry timing metadata; concatenating both would duplicate spoken money.
    if "text" in annotation:
        text = annotation["text"]
        if not isinstance(text, str) or not text.strip():
            _fail("content", "invalid_transcript", finish="STOP")
        return text.strip()
    # Keep the word-only format shown in Google's transcription guide.
    entries = annotation.get("words")
    if not isinstance(entries, list) or not entries:
        _fail("content", "invalid_transcript", finish="STOP")
    words, size = [], 0
    for entry in entries:
        word = entry.get("word") if isinstance(entry, dict) else None
        if not isinstance(word, str) or not word.strip():
            _fail("content", "invalid_transcript", finish="STOP")
        word = word.strip()
        size += len(word) + bool(words)
        if size > 10000:
            _fail("content", "too_long", finish="STOP")
        words.append(word)
    return " ".join(words)


def parse_transcript_response(body):
    """Read complete plain text or ordered audio transcript segments."""
    parts = [part for part in _completed_parts(body) if not part.get("thought")]
    if not any("audioTranscription" in part for part in parts):
        text = _plain_text(parts).strip()
    else:
        # Mixing a separate text transcript with word annotations may duplicate
        # speech or discard a partial segment. Fail rather than infer alignment.
        segments, size = [], 0
        for part in parts:
            if "text" in part and (not isinstance(part["text"], str) or part["text"].strip()):
                _fail("content", "mixed_transcript", finish="STOP")
            segment = _segment_transcript(part.get("audioTranscription"))
            size += len(segment) + bool(segments)
            if size > 10000:
                _fail("content", "too_long", finish="STOP")
            segments.append(segment)
        text = " ".join(segments)
    if len(text) > 10000:
        _fail("content", "too_long", finish="STOP")
    return text


def parse_response(body):
    text = parse_text_response(body)
    try:
        raw = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        _fail("proposal", "invalid_json", finish="STOP")
    if not isinstance(raw, dict):
        _fail("proposal", "invalid_shape", finish="STOP")
    return raw


async def _request_body(url: str, payload: dict, api_key: str, *, timeout_seconds: int = 45):
    try:
        async with cloud_slot(), httpx.AsyncClient(timeout=httpx.Timeout(timeout_seconds, connect=10)) as client:
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
    return body


@timed_operation("gemini")
async def generate_json(url: str, payload: dict, api_key: str) -> dict:
    return parse_response(await _request_body(url, payload, api_key))


@timed_operation("gemini_transcribe")
async def generate_transcript(url: str, payload: dict, api_key: str) -> str:
    return parse_transcript_response(await _request_body(url, payload, api_key, timeout_seconds=20))
