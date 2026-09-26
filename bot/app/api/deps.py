"""Signed Telegram auth or explicit loopback-only development sessions."""
import secrets
import time
from urllib.parse import urlparse
from fastapi import Header, HTTPException, Request
from app.core.config import settings
from app.core.security import validate_telegram_init_data

_local_sessions: dict[str, float] = {}
_LOOPBACK = {"localhost", "127.0.0.1", "::1"}


def local_request_allowed(request: Request) -> bool:
    origin = request.headers.get("origin")
    return bool(
        settings.APP_ENV == "development" and settings.ALLOW_LOCAL_LOGIN
        and settings.HOST in _LOOPBACK
        and request.client and request.client.host in _LOOPBACK
        and request.url.hostname in _LOOPBACK
        and (not origin or urlparse(origin).netloc in {
            "localhost:5173", "127.0.0.1:5173", "localhost:8000", "127.0.0.1:8000"
        })
    )


def issue_local_token(request: Request) -> dict:
    if not local_request_allowed(request):
        raise HTTPException(403, "Локальный вход доступен только на этом компьютере")
    now = time.time()
    for key, expiry in list(_local_sessions.items()):
        if expiry <= now:
            _local_sessions.pop(key, None)
    if len(_local_sessions) >= 32:
        raise HTTPException(429, "Слишком много локальных сессий")
    token = secrets.token_urlsafe(32)
    _local_sessions[token] = now + 3600
    return {"access_token": token, "token_type": "Bearer", "expires_in": 3600}


async def get_current_user_id(request: Request, authorization: str | None = Header(None)) -> int:
    if authorization:
        scheme, _, value = authorization.partition(" ")
        if scheme.lower() == "tma":
            user = validate_telegram_init_data(value, settings.BOT_TOKEN, max_age=settings.AUTH_MAX_AGE)
            if user:
                return user["id"]
        if (scheme.lower() == "bearer" and local_request_allowed(request)
                and _local_sessions.get(value, 0) > time.time()):
            return 1
    raise HTTPException(401, "Откройте приложение из Telegram или войдите локально")
