"""Verbatim speech boundary; financial interpretation belongs to AIParserService."""
import base64

from app.core.config import settings
from app.services.ai_provider import require_provider, validate_audio
from app.services.gemini_response import generate_transcript

TRANSCRIBE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-transcribe:generateContent"


async def transcribe_gemini(data: bytes, mime: str) -> str:
    require_provider("gemini")
    mime = validate_audio(data, mime)
    payload = {
        "contents": [{"role": "user", "parts": [{"inlineData": {
            "mimeType": "audio/m4a" if mime == "audio/mp4" else mime,
            "data": base64.b64encode(data).decode(),
        }}]}],
        # SMART rewrites corrections/numbers. Preserve the spoken source for
        # the existing Decimal comparison instead of normalizing it in STT.
        "generationConfig": {"audioTranscriptionConfig": {
            "languageCodes": ["ru-RU"], "mode": "VERBATIM",
        }},
    }
    return await generate_transcript(TRANSCRIBE_URL, payload, settings.GEMINI_API_KEY)
