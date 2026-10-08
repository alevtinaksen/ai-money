"""Explicit provider selection and consent gate for every external AI adapter."""
import json
import httpx
from app.core.config import settings
from app.services.ai_limits import cloud_slot

AUDIO_EXTENSIONS = {"audio/ogg": "ogg", "audio/webm": "webm", "audio/wav": "wav",
                    "audio/mpeg": "mp3", "audio/mp4": "m4a"}
AUDIO_ALIASES = {"audio/mp3": "audio/mpeg", "audio/m4a": "audio/mp4",
                 "audio/x-m4a": "audio/mp4", "audio/x-wav": "audio/wav",
                 "application/ogg": "audio/ogg", "audio/opus": "audio/ogg"}


def audio_mime(mime: str | None, filename: str | None = None) -> str:
    """Normalize known aliases; infer generic Telegram documents from extensions."""
    mime = (mime or "").split(";", 1)[0].strip().lower()
    mime = AUDIO_ALIASES.get(mime, mime)
    if mime in {"", "application/octet-stream"} and filename:
        extension = filename.rsplit(".", 1)[-1].lower()
        mime = next((key for key, value in AUDIO_EXTENSIONS.items() if value == extension), "")
        if extension in {"opus", "oga"}:
            mime = "audio/ogg"
    if mime not in AUDIO_EXTENSIONS:
        raise ValueError("Поддерживаются аудиофайлы OGG/Opus, MP3, WAV, M4A и WebM")
    return mime


def validate_audio(data: bytes, mime: str) -> str:
    if not data or len(data) > settings.MAX_UPLOAD_BYTES:
        raise ValueError("Файл пустой или больше 5 МБ")
    mime = audio_mime(mime)
    # Check the container before uploading. Complete codec decoding remains the
    # provider's responsibility; a matching header alone does not prove audio.
    signatures = {
        "audio/ogg": len(data) >= 27 and data.startswith(b"OggS"),
        "audio/webm": len(data) >= 8 and data.startswith(b"\x1a\x45\xdf\xa3"),
        "audio/wav": len(data) >= 44 and data.startswith(b"RIFF") and data[8:12] == b"WAVE",
        "audio/mpeg": len(data) >= 10 and (data.startswith(b"ID3")
            or (data[0] == 0xff and data[1] & 0xe0 == 0xe0)),
        "audio/mp4": len(data) >= 24 and data[4:8] == b"ftyp",
    }
    if not signatures[mime]:
        raise ValueError("Аудиофайл повреждён или его содержимое не соответствует формату")
    return mime


def require_provider(provider: str):
    if settings.AI_PROVIDER == "disabled" or not settings.AI_UPLOAD_CONSENT:
        raise ValueError("Облачное распознавание отключено или нет согласия на передачу данных")
    if settings.AI_PROVIDER not in {"auto", provider}:
        raise ValueError("Выбран другой поставщик AI")
    if not getattr(settings, f"{provider.upper()}_API_KEY", None):
        raise ValueError("Не настроен ключ выбранного поставщика AI")


def provider_for(kind: str, *, optional=False) -> str | None:
    if settings.AI_PROVIDER == "disabled" or not settings.AI_UPLOAD_CONSENT:
        if optional:
            return None
        raise ValueError("Облачное распознавание отключено или нет согласия на передачу данных")
    candidates = ([settings.AI_PROVIDER] if settings.AI_PROVIDER != "auto"
                  else (["gemini"] if kind == "image" else ["groq", "gemini"]))
    for provider in candidates:
        if kind == "image" and provider != "gemini":
            continue
        if getattr(settings, f"{provider.upper()}_API_KEY", None):
            return provider
    raise ValueError("Выбранный поставщик не настроен или не поддерживает этот файл")


async def transcribe_groq(data: bytes, mime="audio/ogg") -> str:
    require_provider("groq")
    mime = validate_audio(data, mime)
    try:
        async with cloud_slot(), httpx.AsyncClient(timeout=httpx.Timeout(45, connect=10)) as client:
            response = await client.post("https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                data={"model": "whisper-large-v3-turbo", "language": "ru"},
                files={"file": (f"audio.{AUDIO_EXTENSIONS[mime]}", data, mime)})
            response.raise_for_status()
            text = response.json()["text"]
            if not isinstance(text, str) or not text.strip():
                raise ValueError("Пустой ответ распознавания")
            return text.strip()
    except (httpx.HTTPError, TimeoutError, KeyError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError("Распознавание недоступно. Ничего не записано; повторите позже") from exc
